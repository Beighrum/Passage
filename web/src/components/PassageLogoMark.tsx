type PassageLogoMarkProps = {
  /** Display size in CSS pixels (image is square). */
  size?: number;
  className?: string;
};

/**
 * Official Passage Theatre Company mark — circular dark treatment with Mill Hill Playhouse.
 * Asset: /public/passage-logo.png
 */
export function PassageLogoMark({ size = 40, className }: PassageLogoMarkProps) {
  const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="32" fill="transparent"/>
      <circle cx="32" cy="32" r="28" fill="#7B4F9E" opacity="0.18"/>
      <circle cx="32" cy="32" r="20" fill="#7B4F9E" opacity="0.22"/>
      <circle cx="32" cy="32" r="12" fill="#7B4F9E" opacity="0.35"/>
      <text x="32" y="40" text-anchor="middle" font-family="DM Sans, system-ui, -apple-system" font-weight="800" font-size="26" fill="#7B4F9E">P</text>
    </svg>
  `.trim())}`;

  return (
    <img
      className={className}
      src="/passage-logo.png"
      alt="Passage Theatre Company — Trenton, New Jersey, est. 1985"
      width={size}
      height={size}
      onError={(e) => {
        // If the real asset isn't present locally, fall back to a simple purple mark.
        const img = e.currentTarget;
        if (img.src !== fallbackSvg) img.src = fallbackSvg;
      }}
      style={{
        width: `min(${size}px, 85vw)`,
        height: `min(${size}px, 85vw)`,
        objectFit: "contain",
        display: "block",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    />
  );
}
