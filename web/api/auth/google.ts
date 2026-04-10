import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OAuth2Client } from "google-auth-library";
import { SESSION_COOKIE, createSessionToken, cookieAttrs } from "../lib/session";

function emailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const domains = (process.env.STAFF_GOOGLE_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return false;
  const lower = email.toLowerCase();
  return domains.some((d) => lower.endsWith(`@${d}`));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const sessionSecret = process.env.PASSAGE_SESSION_SECRET;
  if (!clientId || !sessionSecret) {
    res.status(501).json({ error: "Google staff sign-in is not configured." });
    return;
  }

  let body: { credential?: string };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body as string) : (req.body as typeof body);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const credential = typeof body.credential === "string" ? body.credential : "";
  if (!credential) {
    res.status(400).json({ error: "Missing credential" });
    return;
  }

  const oAuth2Client = new OAuth2Client(clientId);
  let email: string | undefined;
  try {
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    email = payload?.email;
  } catch {
    res.status(401).json({ error: "Invalid Google credential" });
    return;
  }

  if (!emailAllowed(email)) {
    res.status(403).json({ error: "This Google account is not authorized for staff access." });
    return;
  }

  const { token, maxAge } = createSessionToken(sessionSecret);
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(maxAge, secure)}`,
  );
  res.status(200).json({ ok: true, email });
}
