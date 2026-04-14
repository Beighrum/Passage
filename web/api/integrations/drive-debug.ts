import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServiceAccountCredentials, getInternalDriveRoots, getPublicDriveRoots } from "../lib/driveConfig.js";
import { createDriveClient, listFilesRecursive } from "../lib/driveClient.js";
import { buildDriveIndexForScope } from "../lib/driveRag.js";
import { getRedis } from "../lib/threadStore.js";

type RootReport = {
  id: string;
  source: string;
  filesListed: number;
  sampleNames: string[];
  error?: string;
};

function authOk(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!authOk(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const creds = getServiceAccountCredentials();
  const redis = getRedis();
  const publicRoots = getPublicDriveRoots();
  const internalRoots = getInternalDriveRoots();

  if (!creds) {
    res.status(500).json({ ok: false, error: "Missing or invalid GOOGLE_SERVICE_ACCOUNT_JSON_B64" });
    return;
  }
  if (!redis) {
    res.status(500).json({ ok: false, error: "Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN" });
    return;
  }

  const drive = createDriveClient(creds);
  const maxGather = Number(process.env.DRIVE_RAG_MAX_LIST_FILES ?? 600) || 600;
  const gatherState = { n: 0 };

  const reportRoots = async (roots: { id: string; source: string }[]): Promise<RootReport[]> => {
    const out: RootReport[] = [];
    for (const r of roots) {
      try {
        const files = await listFilesRecursive(drive, r.id, 0, maxGather, gatherState);
        out.push({
          id: r.id,
          source: r.source,
          filesListed: files.length,
          sampleNames: (files ?? []).slice(0, 10).map((f) => f.name ?? "unknown"),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        out.push({ id: r.id, source: r.source, filesListed: 0, sampleNames: [], error: msg });
      }
    }
    return out;
  };

  const before = {
    public: await reportRoots(publicRoots),
    internal: await reportRoots(internalRoots),
  };

  const doReindex = req.query.reindex === "1";
  const reindexResults = doReindex
    ? {
        public: publicRoots.length ? await buildDriveIndexForScope("public") : { ok: false, error: "No public roots" },
        internal: internalRoots.length ? await buildDriveIndexForScope("internal") : { ok: false, error: "No internal roots" },
      }
    : null;

  res.status(200).json({
    ok: true,
    env: {
      driveConfigured: true,
      publicRoots: publicRoots.map((r) => ({ id: r.id, source: r.source })),
      internalRoots: internalRoots.map((r) => ({ id: r.id, source: r.source })),
      maxGather,
    },
    before,
    reindex: reindexResults,
    note: "If filesListed is 0 with an error, the service account cannot see that folder (share permissions or wrong folder ID).",
  });
}

