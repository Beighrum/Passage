import { JWT } from "google-auth-library";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import type { ServiceAccountCreds } from "./driveConfig.js";

export function createDriveClient(creds: ServiceAccountCreds) {
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Walks subfolders. Stops after `maxGather` **files** (not folders) to avoid timeouts on huge trees.
 */
export async function listFilesRecursive(
  drive: drive_v3.Drive,
  folderId: string,
  depth = 0,
  maxGather = 600,
  state?: { n: number },
): Promise<drive_v3.Schema$File[]> {
  const st = state ?? { n: 0 };
  if (depth > 40 || st.n >= maxGather) return [];
  const acc: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    if (st.n >= maxGather) break;
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (st.n >= maxGather) break;
      if (!f.id || !f.name || !f.mimeType) continue;
      if (f.mimeType === "application/vnd.google-apps.folder") {
        acc.push(...(await listFilesRecursive(drive, f.id, depth + 1, maxGather, st)));
      } else {
        acc.push(f);
        st.n += 1;
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && st.n < maxGather);
  return acc;
}
