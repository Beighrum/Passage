import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { buildSystemPrompt } from "./lib/buildSystemPrompt.js";
import { loadUnifiedPrompt } from "./lib/loadPrompt.js";
import { SESSION_COOKIE, parseCookieHeader, verifySessionToken } from "./lib/session.js";
import type { UserContentPart } from "./lib/chatTypes.js";
import { flattenUserText } from "../shared/chatMessages.js";
import { saveThread } from "./lib/threadStore.js";
import { textFromAnthropicMessage } from "./lib/extractText.js";
import { isUuidLike } from "./lib/uuid.js";
import { retrieveDriveRagContext } from "./lib/driveRag.js";
import { parseChatMessages, sanitizeMessagesForStorage } from "./lib/validateChatMessages.js";

function toAnthropicUserBlocks(content: string | UserContentPart[]): ContentBlockParam[] {
  if (typeof content === "string") {
    const t = content.trim();
    if (!t) return [];
    return [{ type: "text", text: content }];
  }
  const blocks: ContentBlockParam[] = [];
  for (const p of content) {
    if (p.type === "text") {
      if (p.text.trim()) blocks.push({ type: "text", text: p.text });
    } else {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: p.media_type, data: p.data },
      });
    }
  }
  return blocks;
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.PASSAGE_SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server configuration missing." });
    return;
  }

  const raw = parseBody(req);
  const variant = raw.variant === "internal" ? "internal" : "public";
  const stream = raw.stream === true;
  const threadId = typeof raw.threadId === "string" ? raw.threadId : "";

  if (variant === "internal") {
    const c = parseCookieHeader(req.headers.cookie, SESSION_COOKIE);
    if (!verifySessionToken(secret, c)) {
      res.status(401).json({ error: "Staff session required" });
      return;
    }
  }

  const messages = parseChatMessages(raw.messages);
  if (!messages || messages.length === 0) {
    res.status(400).json({ error: "No messages" });
    return;
  }

  let full: string;
  try {
    full = loadUnifiedPrompt();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load system prompt" });
    return;
  }

  let systemPrompt: string;
  try {
    systemPrompt = buildSystemPrompt(full, variant);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Bad prompt configuration" });
    return;
  }

  let thread = [...messages];
  let extraSystem = "";
  while (thread.length > 0 && thread[0].role === "assistant") {
    extraSystem += (extraSystem ? "\n\n" : "") + thread[0].content;
    thread = thread.slice(1);
  }
  if (extraSystem) {
    systemPrompt += `\n\n---\nThe interface already showed the user this assistant copy (do not repeat verbatim unless they ask):\n${extraSystem}\n`;
  }

  const lastUserForRag = [...thread].reverse().find((m) => m.role === "user");
  const ragQuery =
    lastUserForRag?.role === "user" ? flattenUserText(lastUserForRag.content) : "";
  if (ragQuery.trim()) {
    try {
      const rag = await retrieveDriveRagContext(ragQuery, variant === "internal" ? "internal" : "public");
      if (rag) {
        const intro =
          variant === "internal"
            ? "Drive / indexed excerpts (cite filenames; do not invent grant stats, partners, or outcomes not present in excerpts):"
            : "Indexed Passage excerpts — PUBLIC: Use audience-appropriate facts only (shows, tickets, venue, accessibility, public-facing policies, marketing/social summaries). If retrieved text looks internal (grants, board, confidential HR), do not quote it; answer from general Passage public knowledge or direct to the Box Office / website. For ticket purchases always give the official ticketing link and Box Office contact.";
        systemPrompt += `\n\n---\n${intro}\n\n${rag}\n`;
      }
    } catch (e) {
      console.error("driveRag", e);
    }
  }

  if (thread.length === 0) {
    res.status(400).json({ error: "Nothing to send after removing UI preamble." });
    return;
  }

  const claudeMessages: Anthropic.MessageParam[] = [];
  for (const m of thread) {
    if (m.role === "assistant") {
      if (typeof m.content !== "string" || !m.content.trim()) continue;
      claudeMessages.push({ role: "assistant", content: m.content });
      continue;
    }
    if (m.role === "user") {
      const blocks = toAnthropicUserBlocks(m.content);
      if (blocks.length === 0) continue;
      claudeMessages.push({ role: "user", content: blocks });
    }
  }

  if (claudeMessages.length === 0) {
    res.status(400).json({ error: "No valid turns" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set." });
    return;
  }

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  const anthropic = new Anthropic({ apiKey });

  const persist = async (assistantText: string) => {
    if (!isUuidLike(threadId)) return;
    const saved = sanitizeMessagesForStorage([...messages, { role: "assistant", content: assistantText }]);
    await saveThread(variant, threadId, saved);
  };

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      const streamIter = anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: claudeMessages,
      });

      for await (const event of streamIter) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const t = event.delta.text;
          res.write(`data: ${JSON.stringify({ type: "delta", text: t })}\n\n`);
        }
      }

      const finalMessage = await streamIter.finalMessage();
      const fullText = textFromAnthropicMessage(finalMessage);
      res.write(`data: ${JSON.stringify({ type: "done", fullText })}\n\n`);
      await persist(fullText);
      res.end();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Stream failed";
      res.write(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
      res.end();
    }
    return;
  }

  try {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const text = textFromAnthropicMessage(resp);
    await persist(text);
    res.status(200).json({ text });
  } catch (err: unknown) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Claude request failed";
    res.status(502).json({ error: msg });
  }
}
