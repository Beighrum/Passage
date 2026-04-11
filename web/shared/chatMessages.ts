/** Wire format for /api/chat — shared by Vite app and API (keep in sync manually if split). */

export const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

export type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image"; media_type: ImageMediaType; data: string };

export type ChatMessage =
  | { role: "assistant"; content: string }
  | { role: "user"; content: string | UserContentPart[] };

export function flattenUserText(content: string | UserContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export function isImageMediaType(s: string): s is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(s);
}
