import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildDriveIndex } from "../lib/driveRag.js";

/**
 * Generic hook for Cowork, n8n, or Vercel Cron: refresh grants, reindex Drive, etc.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(501).json({ error: "CRON_SECRET is not configured." });
    return;
  }

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let job = "default";
  try {
    const body =
      typeof req.body === "string" && req.body.length > 0
        ? (JSON.parse(req.body) as { job?: string })
        : ((req.body as { job?: string }) ?? {});
    if (typeof body.job === "string") job = body.job;
  } catch {
    /* ignore */
  }

  if (job === "reindex-drive") {
    try {
      const result = await buildDriveIndex();
      res.status(result.ok ? 200 : 500).json({
        ok: result.ok,
        job,
        at: new Date().toISOString(),
        error: result.error,
        stats: result.stats,
      });
    } catch (e) {
      console.error("reindex-drive", e);
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({
        ok: false,
        job,
        at: new Date().toISOString(),
        error: msg,
      });
    }
    return;
  }

  res.status(200).json({
    ok: true,
    job,
    at: new Date().toISOString(),
    message: "No handler for this job. Supported: reindex-drive.",
  });
}
