import { JWT } from "google-auth-library";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import type { ServiceAccountCreds } from "./driveConfig.js";

/** pdf-parse v1 only — v2 pulls pdfjs + canvas and breaks Vercel serverless. Loaded on demand. */
async function pdfBufferToText(buf: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = mod.default as (data: Buffer) => Promise<{ text?: string }>;
  const data = await pdfParse(buf);
  return data.text ?? "";
}

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

const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function extractDriveFileText(
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
): Promise<string> {
  const id = file.id!;
  const name = file.name ?? "unknown";
  const mime = file.mimeType ?? "";

  try {
    if (mime === "application/vnd.google-apps.document") {
      const res = await drive.files.export(
        { fileId: id, mimeType: "text/plain" },
        { responseType: "text" },
      );
      return String(res.data);
    }

    if (mime === "application/pdf") {
      const head = await drive.files.get({
        fileId: id,
        fields: "size",
        supportsAllDrives: true,
      });
      const size = head.data.size ? Number(head.data.size) : 0;
      if (size > MAX_PDF_BYTES) {
        return `[Skipped large PDF (${Math.round(size / 1024 / 1024)} MB): ${name}]`;
      }
      const res = await drive.files.get(
        { fileId: id, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      const buf = Buffer.from(res.data as ArrayBuffer);
      return pdfBufferToText(buf);
    }

    if (mime.startsWith("text/") || mime === "application/json") {
      const res = await drive.files.get(
        { fileId: id, alt: "media", supportsAllDrives: true },
        { responseType: "text" },
      );
      return String(res.data);
    }

    return `[Skipped unsupported type (${mime}): ${name}]`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return `[Could not read ${name}: ${msg}]`;
  }
}
