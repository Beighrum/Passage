import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadThread } from "./lib/threadStore.js";
import { SESSION_COOKIE, parseCookieHeader, verifySessionToken } from "./lib/session.js";
import { isUuidLike } from "./lib/uuid.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.PASSAGE_SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server configuration missing." });
    return;
  }

  const threadId = typeof req.query.threadId === "string" ? req.query.threadId : "";
  const variant = req.query.variant === "internal" ? "internal" : "public";

  if (!isUuidLike(threadId)) {
    res.status(400).json({ error: "Invalid threadId" });
    return;
  }

  if (variant === "internal") {
    const raw = parseCookieHeader(req.headers.cookie, SESSION_COOKIE);
    if (!verifySessionToken(secret, raw)) {
      res.status(401).json({ error: "Staff session required" });
      return;
    }
  }

  const messages = await loadThread(variant, threadId);
  if (!messages || messages.length === 0) {
    res.status(404).json({ error: "No saved thread" });
    return;
  }

  res.status(200).json({ messages });
}
