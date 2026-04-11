import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPT_FILE = "passage-phase3-system-prompt.md";

/** Vercel cwd is not always `web/`; resolve from this file so bundled `prompts/` is found. */
export function loadUnifiedPrompt(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "..", "prompts", PROMPT_FILE),
    join(process.cwd(), "prompts", PROMPT_FILE),
    join(process.cwd(), "web", "prompts", PROMPT_FILE),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error(`Unified prompt missing. Tried: ${candidates.join(" | ")}`);
}
