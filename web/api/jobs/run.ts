import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Generic hook for Cowork, n8n, or Vercel Cron: refresh grants, reindex Drive, etc.
 * Extend the handler body with your own job branches.
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

  // Add branches: if (job === "guideStarPoll") { ... }
  res.status(200).json({
    ok: true,
    job,
    at: new Date().toISOString(),
    message: "Accepted. Implement job logic in api/jobs/run.ts or call n8n webhooks from here.",
  });
}
