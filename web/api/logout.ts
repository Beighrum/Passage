import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SESSION_COOKIE, clearCookieAttrs } from "./lib/session";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${clearCookieAttrs(secure)}`);
  res.status(200).json({ ok: true });
}
