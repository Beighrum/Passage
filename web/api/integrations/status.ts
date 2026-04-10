import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isRedisConfigured } from "../lib/threadStore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.status(200).json({
    upstashRedis: isRedisConfigured(),
    googleStaffSignIn: !!(process.env.GOOGLE_CLIENT_ID && process.env.STAFF_GOOGLE_ALLOWED_DOMAINS),
    cronWebhook: !!process.env.CRON_SECRET,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    driveRag: false,
    note: "driveRag becomes true when Phase 3b ingestion + vector search is wired.",
  });
}
