import { Redis } from "@upstash/redis";
import type { ChatMessage } from "./chatTypes.js";

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function threadKey(variant: "public" | "internal", threadId: string): string {
  return `passage:chat:${variant}:${threadId}`;
}

export async function loadThread(variant: "public" | "internal", threadId: string): Promise<ChatMessage[] | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(threadKey(variant, threadId));
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as ChatMessage[];
  } catch {
    return null;
  }
}

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

export async function saveThread(
  variant: "public" | "internal",
  threadId: string,
  messages: ChatMessage[],
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(threadKey(variant, threadId), JSON.stringify(messages), { ex: DEFAULT_TTL_SEC });
}

export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
