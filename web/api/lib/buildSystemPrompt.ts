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
      "- When an answer uses retrieved indexed Passage documents (server-injected excerpts), you may reference the document by filename.",
      "- Do not imply access to private staff systems; frame facts as from Passage’s published or indexed materials.",
      "- For anything not supported by excerpts or the public site, direct users to the Box Office or passagetheatre.org.",
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
