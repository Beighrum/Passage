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
  return (
    <img
      className={className}
      src="/passage-logo.png"
      alt="Passage Theatre Company — Trenton, New Jersey, est. 1985"
      width={size}
      height={size}
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
