import type { drive_v3 } from "googleapis";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

/**
 * PDF text extraction lives in this file alone so `/api/chat` never loads `pdf-parse`
 * (Vercel bundles traced deps; pdf-parse v2 pulls pdfjs/canvas and crashes serverless).
 * Only `buildDriveIndexForScope` dynamic-imports this module.
 */
async function pdfBufferToText(buf: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = mod.default as (data: Buffer) => Promise<{ text?: string }>;
  const data = await pdfParse(buf);
  return data.text ?? "";
}

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
