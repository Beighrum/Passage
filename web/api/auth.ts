import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, createSessionToken, cookieAttrs } from "./lib/session.js";

function safeEqualPassword(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.PASSAGE_SESSION_SECRET;
  const expectedPw = process.env.PASSAGE_INTERNAL_PASSWORD;
  if (!secret || !expectedPw) {
    res.status(500).json({ error: "Server auth is not configured." });
    return;
  }

  let body: { password?: string };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const password = typeof body?.password === "string" ? body.password : "";
  if (!safeEqualPassword(password, expectedPw)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const { token, maxAge } = createSessionToken(secret);
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(maxAge, secure)}`,
  );
  res.status(200).json({ ok: true });
}
