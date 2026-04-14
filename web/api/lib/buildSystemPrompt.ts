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

  const body = [
    "ACTIVE_SESSION_MODE: PUBLIC",
    "Obey MODE: PUBLIC only. Do not provide internal grant tooling, Drive access, or staff-only operational detail.",
    "",
    head,
    "\n\n",
    tail.trim(),
  ].join("");

  // Earlier sections say "knowledge base" and CORE RULES say "not in the knowledge base" — models often treat that as
  // Drive-only and refuse to use in-prompt show copy. This block wins (last-instructions priority).
  const publicOverride = [
    "",
    "---",
    "PRIORITY OVERRIDE (PUBLIC — READ LAST)",
    'In PUBLIC mode, "knowledge base" includes this entire system prompt, especially MODE: PUBLIC (including **Current programming highlights**), PASSAGE THEATRE — VOICE & IDENTITY, and official URLs/phone numbers listed here.',
    "When the user asks about Passage shows, season, programming, or what is playing: answer from those sections first. Summarize mainstage titles (e.g. Dutchman / The Slave, Muleheaded), pillars, and links. Do **not** say you have no information, cannot help, or lack a knowledge base because Drive retrieval is empty.",
    "For exact performance dates/times not printed in this prompt, give https://www.passagetheatre.org/shows-events and Box Office (609) 392-0766 — that is not 'I don't know'; it is the correct handoff to the live calendar.",
    "Do not invent specific performance dates, prices, or casting not stated in this prompt or on passagetheatre.org.",
  ].join("\n");

  return body + publicOverride;
}
