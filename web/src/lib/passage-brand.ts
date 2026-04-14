export const PASSAGE_PURPLE = "#7B4F9E";
export const PASSAGE_DARK_PURPLE = "#4A2D6B";

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getPassageLogoSvg({
  size = 64,
  fill = PASSAGE_PURPLE,
  bg = "transparent",
  text = "P",
}: {
  size?: number;
  fill?: string;
  bg?: string;
  text?: string;
}) {
  // Fallback mark used when the real /passage-logo.png isn't present locally.
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="32" fill="${bg}"/>
  <circle cx="32" cy="32" r="30" fill="${fill}" opacity="0.18"/>
  <circle cx="32" cy="32" r="22" fill="${fill}" opacity="0.22"/>
  <circle cx="32" cy="32" r="14" fill="${fill}" opacity="0.35"/>
  <text x="32" y="40" text-anchor="middle" font-family="DM Sans, system-ui, -apple-system" font-weight="800" font-size="26" fill="${fill}">${text}</text>
</svg>
`.trim();
}

export function getPassageCursorDataUrl({
  fill = PASSAGE_PURPLE,
}: {
  fill?: string;
}) {
  const svg = getPassageLogoSvg({ size: 32, fill, bg: "transparent", text: " " });
  return svgToDataUrl(svg);
}

export function getPassageWatermarkDataUrl({
  fill = PASSAGE_PURPLE,
}: {
  fill?: string;
}) {
  const svg = getPassageLogoSvg({ size: 256, fill, bg: "transparent", text: " " });
  return svgToDataUrl(svg);
}

