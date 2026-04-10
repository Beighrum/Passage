/**
 * Public sessions omit the INTERNAL mode block and Google Drive section so the model
 * is not primed with staff-only workflows in anonymous traffic.
 */
export function buildSystemPrompt(full: string, variant: "public" | "internal"): string {
  if (variant === "internal") {
    return [
      "ACTIVE_SESSION_MODE: INTERNAL",
      "Follow INTERNAL MODE and all sections below. Google Drive applies when that integration is connected.",
      "",
      full.trim(),
    ].join("\n");
  }

  const internalHeader = "## MODE: INTERNAL";
  const knowledgeHeader = "## KNOWLEDGE BASE PRIORITY";
  const googleHeader = "## GOOGLE DRIVE INTEGRATION";
  const accessHeader = "## ACCESS CONTROL SUMMARY";

  const iStart = full.indexOf(internalHeader);
  const kStart = full.indexOf(knowledgeHeader);
  if (iStart === -1 || kStart === -1) {
    throw new Error("System prompt file missing expected headings (MODE: INTERNAL or KNOWLEDGE BASE).");
  }

  const head = full.slice(0, iStart).trimEnd();
  let tail = full.slice(kStart);

  const gStart = tail.indexOf(googleHeader);
  const aStart = tail.indexOf(accessHeader);
  if (gStart !== -1 && aStart !== -1 && gStart < aStart) {
    tail = `${tail.slice(0, gStart).trimEnd()}\n\n${tail.slice(aStart).trimStart()}`;
  }

  tail = tail.replace(
    /### Source Citation \(Internal Mode Only\)[\s\S]*?(?=\n---)/,
    [
      "### Source citation (public)",
      "- Prefer official website and box office for factual claims; do not cite internal documents.",
    ].join("\n"),
  );

  return [
    "ACTIVE_SESSION_MODE: PUBLIC",
    "Obey MODE: PUBLIC only. Do not provide internal grant tooling, Drive access, or staff-only operational detail.",
    "",
    head,
    "\n\n",
    tail.trim(),
  ].join("");
}
