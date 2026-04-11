import type { ChatMessage, UserContentPart } from "../../shared/chatMessages.js";
import { isImageMediaType } from "../../shared/chatMessages.js";

const MAX_MESSAGES = 200;
const MAX_TEXT_LEN = 120_000;
const MAX_USER_BLOCKS = 24;
const MAX_IMAGES = 6;
const MAX_BASE64_CHARS = 5_000_000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseUserContent(raw: unknown): string | UserContentPart[] | null {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t.length > MAX_TEXT_LEN) return null;
    return raw;
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_USER_BLOCKS) return null;

  let imageCount = 0;
  const parts: UserContentPart[] = [];

  for (const item of raw) {
    if (!isRecord(item)) return null;
    const type = item.type;
    if (type === "text") {
      const text = typeof item.text === "string" ? item.text : "";
      if (!text.trim() || text.length > MAX_TEXT_LEN) return null;
      parts.push({ type: "text", text });
    } else if (type === "image") {
      if (imageCount >= MAX_IMAGES) return null;
      const media_type = typeof item.media_type === "string" ? item.media_type : "";
      const data = typeof item.data === "string" ? item.data : "";
      if (!isImageMediaType(media_type) || !data || data.length > MAX_BASE64_CHARS) return null;
      imageCount += 1;
      parts.push({ type: "image", media_type, data });
    } else {
      return null;
    }
  }

  if (parts.length === 0) return null;
  return parts;
}

/** Returns null if the payload is invalid or abusive. */
export function parseChatMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const out: ChatMessage[] = [];

  for (const m of raw) {
    if (!isRecord(m)) return null;
    const role = m.role;
    if (role === "assistant") {
      const content = typeof m.content === "string" ? m.content : "";
      if (!content.trim() || content.length > MAX_TEXT_LEN) return null;
      out.push({ role: "assistant", content });
    } else if (role === "user") {
      const content = parseUserContent(m.content);
      if (content === null) return null;
      out.push({ role: "user", content });
    } else {
      return null;
    }
  }

  return out;
}

/** Strip base64 from user messages before Redis (keeps thread size bounded). */
export function sanitizeMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.role !== "user") return m;
    if (typeof m.content === "string") return m;
    const lines: string[] = [];
    for (const p of m.content) {
      if (p.type === "text") lines.push(p.text);
      else lines.push("[Image]");
    }
    const joined = lines.join("\n").trim();
    return { role: "user", content: joined || "[Image]" };
  });
}
