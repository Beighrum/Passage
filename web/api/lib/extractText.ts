import type { Message, TextBlock } from "@anthropic-ai/sdk/resources/messages";

export function textFromAnthropicMessage(msg: Message): string {
  return msg.content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
