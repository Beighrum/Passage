import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadUnifiedPrompt(): string {
  return readFileSync(join(process.cwd(), "prompts", "passage-phase3-system-prompt.md"), "utf8");
}
