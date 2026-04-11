import { getRedis } from "./threadStore.js";
import { getDriveRagFolderId, getServiceAccountCredentials } from "./driveConfig.js";
import { createDriveClient, extractDriveFileText, listFilesRecursive } from "./driveClient.js";

const INDEX_KEY = "passage:drive:rag:index:v1";
/** Default 25: Vercel Hobby serverless max ~10s; full PDF extraction cannot index hundreds of files in one run. */
function maxFilesToIndex(): number {
  const n = Number(process.env.DRIVE_RAG_MAX_FILES);
  if (Number.isFinite(n) && n > 0) return Math.min(120, Math.floor(n));
  return 25;
}

function maxFilesToGather(): number {
  const n = Number(process.env.DRIVE_RAG_MAX_LIST_FILES);
  if (Number.isFinite(n) && n > 0) return Math.min(2000, Math.floor(n));
  return 600;
}

const MAX_CHARS_PER_FILE = 14_000;
const MAX_CONTEXT_CHARS = 24_000;
const TOP_CHUNKS = 8;

export type DriveIndexedFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  text: string;
};

export type DriveIndexPayload = {
  builtAt: string;
  folderId: string;
  files: DriveIndexedFile[];
};

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "is",
  "was",
  "are",
  "with",
  "be",
  "by",
  "that",
  "this",
  "it",
  "we",
  "our",
  "from",
  "has",
  "have",
  "not",
  "passage",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export async function buildDriveIndex(): Promise<{ ok: boolean; error?: string; stats?: { files: number } }> {
  try {
    const creds = getServiceAccountCredentials();
    const folderId = getDriveRagFolderId();
    if (!creds || !folderId) {
      return { ok: false, error: "Missing GOOGLE_SERVICE_ACCOUNT_JSON_B64 or DRIVE_RAG_FOLDER_ID" };
    }

    const redis = getRedis();
    if (!redis) {
      return { ok: false, error: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required for Drive RAG index" };
    }

    const maxIndex = maxFilesToIndex();
    const maxGather = maxFilesToGather();

    const drive = createDriveClient(creds);
    let all = await listFilesRecursive(drive, folderId, 0, maxGather);
    all.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
    all = all.slice(0, maxIndex);

    const files: DriveIndexedFile[] = [];
    for (const f of all) {
      let text = await extractDriveFileText(drive, f);
      if (text.length > MAX_CHARS_PER_FILE) {
        text = text.slice(0, MAX_CHARS_PER_FILE) + "\n…[truncated]";
      }
      files.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        modifiedTime: f.modifiedTime ?? undefined,
        text,
      });
    }

    const payload: DriveIndexPayload = {
      builtAt: new Date().toISOString(),
      folderId,
      files,
    };

    await redis.set(INDEX_KEY, JSON.stringify(payload));
    return { ok: true, stats: { files: files.length } };
  } catch (e) {
    console.error("buildDriveIndex", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

async function loadIndex(): Promise<DriveIndexPayload | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(INDEX_KEY);
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as DriveIndexPayload;
  } catch {
    return null;
  }
}

function scoreFile(queryTokens: string[], f: DriveIndexedFile): number {
  const hay = `${f.name} ${f.text}`.toLowerCase();
  let s = 0;
  for (const t of queryTokens) {
    if (hay.includes(t)) s += 1;
  }
  return s;
}

function excerptAround(text: string, queryTokens: string[], maxLen: number): string {
  const lower = text.toLowerCase();
  let pos = 0;
  for (const t of queryTokens) {
    const i = lower.indexOf(t);
    if (i >= 0) {
      pos = Math.max(0, i - 200);
      break;
    }
  }
  const slice = text.slice(pos, pos + maxLen);
  return pos > 0 ? `…${slice}` : slice;
}

/**
 * Returns markdown-ish context for internal assistant only. Caller adds citation rules.
 */
export async function retrieveDriveRagContext(userQuery: string): Promise<string | null> {
  if (!isDriveRagReady()) return null;
  const idx = await loadIndex();
  if (!idx || idx.files.length === 0) {
    return (
      "Drive knowledge base: not indexed yet. Ask an admin to run POST /api/jobs/run with job reindex-drive (CRON_SECRET)."
    );
  }

  const queryTokens = tokenize(userQuery);
  if (queryTokens.length === 0) return null;

  const scored = idx.files
    .map((f) => ({ f, score: scoreFile(queryTokens, f) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_CHUNKS);

  if (scored.length === 0) {
    return `Drive knowledge base (indexed ${idx.builtAt}, ${idx.files.length} files): no keyword overlap with this query. Answer from general Passage knowledge; do not invent grant details.`;
  }

  const parts: string[] = [
    `Drive knowledge base (indexed ${idx.builtAt}, folder ${idx.folderId}). Cite filenames when using excerpts.`,
  ];
  for (const { f } of scored) {
    const ex = excerptAround(f.text, queryTokens, 3200);
    parts.push(`### ${f.name}\n${ex}`);
  }
  let out = parts.join("\n\n");
  if (out.length > MAX_CONTEXT_CHARS) {
    out = out.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }
  return out;
}

export function isDriveRagReady(): boolean {
  const creds = getServiceAccountCredentials();
  const folder = getDriveRagFolderId();
  const redis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  return !!(creds && folder && redis);
}

export async function hasDriveIndexInRedis(): Promise<boolean> {
  const idx = await loadIndex();
  return !!(idx && idx.files.length > 0);
}
