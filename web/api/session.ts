import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SESSION_COOKIE, parseCookieHeader, verifySessionToken } from "./lib/session";

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
  const raw = parseCookieHeader(req.headers.cookie, SESSION_COOKIE);
  const ok = verifySessionToken(secret, raw);
  if (!ok) {
    res.status(401).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true });
}
