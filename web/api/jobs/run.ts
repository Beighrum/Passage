import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { RagScope } from "../lib/driveRag.js";
import { buildDriveIndexesForConfigured, buildDriveIndexForScope } from "../lib/driveRag.js";

/**
 * Generic hook for Cowork, n8n, or Vercel Cron: refresh grants, reindex Drive, etc.
 *
 * POST body JSON examples:
 * - `{ "job": "reindex-drive" }` — reindex all configured folders (public + internal when both env vars set)
 * - `{ "job": "reindex-drive", "scope": "both" }` — same
 * - `{ "job": "reindex-drive", "scope": "public" }` or `"internal"` — one index only
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
  let scope: string | undefined;
  try {
    const body =
      typeof req.body === "string" && req.body.length > 0
        ? (JSON.parse(req.body) as { job?: string; scope?: string })
        : ((req.body as { job?: string; scope?: string }) ?? {});
    if (typeof body.job === "string") job = body.job;
    if (typeof body.scope === "string") scope = body.scope;
  } catch {
    /* ignore */
  }

  if (job === "reindex-drive") {
    try {
      const s = scope?.toLowerCase();
      if (s === "public" || s === "internal") {
        const ragScope = s as RagScope;
        const result = await buildDriveIndexForScope(ragScope);
        res.status(result.ok ? 200 : 500).json({
          ok: result.ok,
          job,
          scope: ragScope,
          at: new Date().toISOString(),
          error: result.error,
          stats: result.stats,
        });
        return;
      }

      const multi = !s || s === "both";
      if (!multi) {
        res.status(400).json({
          ok: false,
          error: 'Invalid scope. Use "public", "internal", "both", or omit.',
        });
        return;
      }

      const combined = await buildDriveIndexesForConfigured();
      res.status(combined.ok ? 200 : 500).json({
        ok: combined.ok,
        job,
        scope: "both",
        at: new Date().toISOString(),
        error: combined.error,
        results: combined.results,
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
    message: 'No handler for this job. Supported: reindex-drive (optional scope: public | internal | both).',
  });
}
