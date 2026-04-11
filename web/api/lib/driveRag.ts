import type { drive_v3 } from "googleapis";
import { getRedis } from "./threadStore.js";
import {
  getInternalDriveRootIds,
  getPublicDriveRootIds,
  getServiceAccountCredentials,
} from "./driveConfig.js";
import { createDriveClient, listFilesRecursive } from "./driveClient.js";

export type RagScope = "public" | "internal";

const INDEX_PUBLIC = "passage:drive:rag:index:v2:public";
const INDEX_INTERNAL = "passage:drive:rag:index:v2:internal";
/** Pre-split single index — read fallback for internal only until reindexed */
const INDEX_LEGACY = "passage:drive:rag:index:v1";

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
  scope: RagScope;
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

function indexKeyForScope(scope: RagScope): string {
  return scope === "public" ? INDEX_PUBLIC : INDEX_INTERNAL;
}

function folderIdsForScope(scope: RagScope): string[] {
  return scope === "public" ? getPublicDriveRootIds() : getInternalDriveRootIds();
}

export function isDriveRagReadyForScope(scope: RagScope): boolean {
  const creds = getServiceAccountCredentials();
  const redis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  return !!(creds && redis && folderIdsForScope(scope).length > 0);
}

/**
 * Build one scope’s index. Writes to v2 Redis keys (public vs internal).
 */
export async function buildDriveIndexForScope(
  scope: RagScope,
): Promise<{ ok: boolean; error?: string; stats?: { files: number } }> {
  try {
    const creds = getServiceAccountCredentials();
    const folderIds = folderIdsForScope(scope);
    if (!creds || folderIds.length === 0) {
      const need =
        scope === "public"
          ? "DRIVE_RAG_FOLDER_ID_PUBLIC"
          : "DRIVE_RAG_FOLDER_ID_INTERNAL, DRIVE_RAG_FOLDER_ID_GRANTS, DRIVE_RAG_FOLDER_ID_ANNUAL_NEWSLETTER, or legacy DRIVE_RAG_FOLDER_ID";
      return { ok: false, error: `Missing GOOGLE_SERVICE_ACCOUNT_JSON_B64 or ${need}` };
    }

    const redis = getRedis();
    if (!redis) {
      return { ok: false, error: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required for Drive RAG index" };
    }

    const maxIndex = maxFilesToIndex();
    const maxGather = maxFilesToGather();

    const drive = createDriveClient(creds);
    const { extractDriveFileText } = await import("./driveExtract.js");
    const gatherState = { n: 0 };
    let all: drive_v3.Schema$File[] = [];
    for (const fid of folderIds) {
      if (gatherState.n >= maxGather) break;
      const part = await listFilesRecursive(drive, fid, 0, maxGather, gatherState);
      all.push(...part);
    }
    const seen = new Set<string>();
    all = all.filter((f) => {
      if (!f.id || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    all.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
    all = all.slice(0, maxIndex);

    const folderIdLabel = folderIds.join(",");

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
      folderId: folderIdLabel,
      scope,
      files,
    };

    await redis.set(indexKeyForScope(scope), JSON.stringify(payload));
    return { ok: true, stats: { files: files.length } };
  } catch (e) {
    console.error("buildDriveIndexForScope", scope, e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Reindex public, internal, or both (sequential). */
export async function buildDriveIndexes(
  scopes: RagScope[],
): Promise<{
  ok: boolean;
  results: Partial<Record<RagScope, { ok: boolean; error?: string; stats?: { files: number } }>>;
}> {
  const results: Partial<Record<RagScope, { ok: boolean; error?: string; stats?: { files: number } }>> = {};
  let allOk = true;
  for (const scope of scopes) {
    const r = await buildDriveIndexForScope(scope);
    results[scope] = r;
    if (!r.ok) allOk = false;
  }
  return { ok: allOk, results };
}

/** Reindex every scope that has a folder ID set (typical cron target). */
export async function buildDriveIndexesForConfigured(): Promise<{
  ok: boolean;
  error?: string;
  results: Partial<Record<RagScope, { ok: boolean; error?: string; stats?: { files: number } }>>;
}> {
  const scopes: RagScope[] = [];
  if (folderIdsForScope("public").length > 0) scopes.push("public");
  if (folderIdsForScope("internal").length > 0) scopes.push("internal");
  if (scopes.length === 0) {
    return {
      ok: false,
      error: "No DRIVE_RAG_FOLDER_ID_PUBLIC or DRIVE_RAG_FOLDER_ID_INTERNAL (or legacy DRIVE_RAG_FOLDER_ID)",
      results: {},
    };
  }
  return buildDriveIndexes(scopes);
}

async function loadIndex(scope: RagScope): Promise<DriveIndexPayload | null> {
  const redis = getRedis();
  if (!redis) return null;
  const primaryKey = indexKeyForScope(scope);
  let raw = await redis.get<string>(primaryKey);
  if (!raw && scope === "internal") {
    raw = await redis.get<string>(INDEX_LEGACY);
  }
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as DriveIndexPayload & { scope?: RagScope };
    if (parsed.scope != null && parsed.scope !== scope) return null;
    if (parsed.scope == null) {
      return { ...parsed, scope } as DriveIndexPayload;
    }
    return parsed as DriveIndexPayload;
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
 * @param scope — `public` = audience index; `internal` = grants / institutional index
 */
export async function retrieveDriveRagContext(userQuery: string, scope: RagScope): Promise<string | null> {
  if (!isDriveRagReadyForScope(scope)) return null;

  const idx = await loadIndex(scope);
  if (!idx || idx.files.length === 0) {
    return (
      `Drive knowledge base (${scope}): not indexed yet. Ask an admin to POST /api/jobs/run with ` +
      `{"job":"reindex-drive","scope":"${scope}"} or "both" (Bearer CRON_SECRET).`
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
    return (
      `Drive knowledge base (${scope}, indexed ${idx.builtAt}, ${idx.files.length} files): no keyword overlap with this query. ` +
      `Answer from general Passage knowledge; do not invent grant details.`
    );
  }

  const label =
    scope === "internal"
      ? "INTERNAL grant / institutional index"
      : "PUBLIC audience index (tickets, policies, marketing — audience-safe)";
  const parts: string[] = [
    `${label} (indexed ${idx.builtAt}, folder ${idx.folderId}). Cite filenames when using excerpts.`,
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

export async function hasIndexForScope(scope: RagScope): Promise<boolean> {
  const idx = await loadIndex(scope);
  return !!(idx && idx.files.length > 0);
}

export type DriveRagIndexStatus = {
  public: { configured: boolean; indexed: boolean };
  internal: { configured: boolean; indexed: boolean };
};

export async function getDriveRagIndexStatus(): Promise<DriveRagIndexStatus> {
  const pubConfigured = getPublicDriveRootIds().length > 0;
  const intConfigured = getInternalDriveRootIds().length > 0;
  const [pubIndexed, intIndexed] = await Promise.all([
    pubConfigured ? hasIndexForScope("public") : Promise.resolve(false),
    intConfigured ? hasIndexForScope("internal") : Promise.resolve(false),
  ]);
  return {
    public: { configured: pubConfigured, indexed: pubIndexed },
    internal: { configured: intConfigured, indexed: intIndexed },
  };
}

/** @deprecated Use getDriveRagIndexStatus */
export async function hasDriveIndexInRedis(): Promise<boolean> {
  const s = await getDriveRagIndexStatus();
  return s.public.indexed || s.internal.indexed;
}
