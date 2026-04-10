import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isDriveRagEnvConfigured } from "../lib/driveConfig.js";
import { hasDriveIndexInRedis } from "../lib/driveRag.js";
import { isRedisConfigured } from "../lib/threadStore.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const driveConfigured = isDriveRagEnvConfigured();
  const driveIndexed = driveConfigured ? await hasDriveIndexInRedis() : false;

  res.status(200).json({
    upstashRedis: isRedisConfigured(),
    googleStaffSignIn: !!(process.env.GOOGLE_CLIENT_ID && process.env.STAFF_GOOGLE_ALLOWED_DOMAINS),
    cronWebhook: !!process.env.CRON_SECRET,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    driveRag: {
      configured: driveConfigured,
      indexed: driveIndexed,
    },
  });
}
