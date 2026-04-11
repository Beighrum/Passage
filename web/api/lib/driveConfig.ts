/**
 * Service account JSON: prefer base64 to avoid escaping issues in Vercel.
 * Set GOOGLE_SERVICE_ACCOUNT_JSON_B64= (output of: base64 -i service-account.json | tr -d '\n')
 * Or GOOGLE_SERVICE_ACCOUNT_JSON= single-line escaped JSON (fragile).
 */
export type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

export function getServiceAccountCredentials(): ServiceAccountCreds | null {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  try {
    if (b64) {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json) as ServiceAccountCreds;
    }
    if (raw) {
      return JSON.parse(raw) as ServiceAccountCreds;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Accepts a bare folder ID or a full `https://drive.google.com/.../folders/FOLDER_ID` URL.
 * Rejects placeholders like `.`, short junk, or unparseable URLs (avoids Google error "File not found: .").
 */
export function normalizeDriveFolderId(input: string): string | null {
  let t = input.trim();
  if (!t || t === ".") return null;
  const fromPath = t.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromPath) t = fromPath[1];
  else if (/^https?:\/\//i.test(t)) return null;
  t = t.replace(/^["']|["']$/g, "");
  if (t.length < 10 || t === ".") return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

/** Split comma/semicolon/whitespace-separated Drive folder IDs or URLs */
function splitFolderIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const ids = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const n = normalizeDriveFolderId(part);
    if (n) ids.add(n);
  }
  return [...ids];
}

/**
 * Public assistant index: audience PDFs, social summaries, website snippets, ADA, tickets.
 * `DRIVE_RAG_FOLDER_ID_PUBLIC` may list multiple roots separated by commas.
 */
export function getPublicDriveRootIds(): string[] {
  return splitFolderIds(process.env.DRIVE_RAG_FOLDER_ID_PUBLIC);
}

/**
 * Staff / grant assistant index: merges
 * - `DRIVE_RAG_FOLDER_ID_INTERNAL` (comma-separated OK)
 * - `DRIVE_RAG_FOLDER_ID_GRANTS` (optional extra root, e.g. PASSAGE GRANTS folder)
 * - `DRIVE_RAG_FOLDER_ID_ANNUAL_NEWSLETTER` (optional)
 * If none of the above yield IDs, falls back to legacy `DRIVE_RAG_FOLDER_ID`.
 */
export function getInternalDriveRootIds(): string[] {
  const ids = new Set<string>();
  for (const id of splitFolderIds(process.env.DRIVE_RAG_FOLDER_ID_INTERNAL)) ids.add(id);
  const g = normalizeDriveFolderId(process.env.DRIVE_RAG_FOLDER_ID_GRANTS ?? "");
  if (g) ids.add(g);
  const n = normalizeDriveFolderId(process.env.DRIVE_RAG_FOLDER_ID_ANNUAL_NEWSLETTER ?? "");
  if (n) ids.add(n);
  if (ids.size === 0) {
    for (const id of splitFolderIds(process.env.DRIVE_RAG_FOLDER_ID)) ids.add(id);
  }
  return [...ids];
}

/** Display string for indexed payload (joined IDs) */
export function getDriveRagFolderIdPublic(): string | null {
  const a = getPublicDriveRootIds();
  return a.length ? a.join(",") : null;
}

export function getDriveRagFolderIdInternal(): string | null {
  const a = getInternalDriveRootIds();
  return a.length ? a.join(",") : null;
}

/** @deprecated */
export function getDriveRagFolderIdLegacy(): string | null {
  const id = process.env.DRIVE_RAG_FOLDER_ID?.trim();
  return id || null;
}

/** @deprecated Prefer getDriveRagFolderIdInternal / Public */
export function getDriveRagFolderId(): string | null {
  return getDriveRagFolderIdInternal();
}

export function isDriveRagEnvConfigured(): boolean {
  const creds = getServiceAccountCredentials();
  if (!creds) return false;
  return getPublicDriveRootIds().length > 0 || getInternalDriveRootIds().length > 0;
}
