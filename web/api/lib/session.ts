import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "passage_staff";

const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export function createSessionToken(secret: string): { token: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = Buffer.from(JSON.stringify({ v: 1 as const, exp, staff: true }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, maxAge: MAX_AGE_SEC };
}

export function verifySessionToken(secret: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot === -1) return false;
  const payload = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    if (sig.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return false;
  } catch {
    return false;
  }
  try {
    const raw = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(raw) as { v?: number; exp?: number; staff?: boolean };
    if (data.v !== 1 || !data.staff) return false;
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export function cookieAttrs(maxAge: number, secure: boolean): string {
  const parts = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookieAttrs(secure: boolean): string {
  const parts = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=0`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
