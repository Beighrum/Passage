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

export function getDriveRagFolderId(): string | null {
  const id = process.env.DRIVE_RAG_FOLDER_ID?.trim();
  return id || null;
}

export function isDriveRagEnvConfigured(): boolean {
  return !!(getServiceAccountCredentials() && getDriveRagFolderId());
}
