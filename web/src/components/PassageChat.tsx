import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PassageLogoMark } from "./PassageLogoMark";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { getOrCreateThreadId, resetThreadId } from "../lib/threadStorage";
import type { ChatMessage, ImageMediaType, UserContentPart } from "../../shared/chatMessages";
import { isImageMediaType } from "../../shared/chatMessages";
import { getPassageWatermarkDataUrl } from "@/lib/passage-brand";
import ClaudeChatInput from "@/components/ui/claude-style-chat-input";
import { cn } from "@/lib/utils";

const PURPLE = "#7B4F9E";

const publicIntro =
  "Welcome to the Passage Theatre Assistant.\n\nI can help with shows, tickets, the venue, accessibility, and general questions about Passage in Trenton.\n\nHow can I help today?";

const internalIntro =
  "Welcome to the Passage Theatre Assistant. I'm connected to Passage's institutional knowledge — grant narratives, strategic plan, programming, and policies.\n\nHow can I help today?";

const MAX_ATTACH = 6;
const MAX_IMAGE_BYTES = 4_500_000;

type PendingImage = { id: string; previewUrl: string; part: UserContentPart };

async function fileToImagePart(file: File): Promise<UserContentPart | null> {
  if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) return null;
  const rawType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!isImageMediaType(rawType)) return null;
  const media_type = rawType as ImageMediaType;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { type: "image", media_type, data: btoa(binary) };
}

function UserMessageBody({ content }: { content: string | UserContentPart[] }) {
  if (typeof content === "string") {
    return <>{content}</>;
  }
  return (
    <>
      {content.map((p, i) =>
        p.type === "text" ? (
          <span key={i} style={{ whiteSpace: "pre-wrap", display: "block" }}>
            {p.text}
          </span>
        ) : (
          <img
            key={i}
            src={`data:${p.media_type};base64,${p.data}`}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: 240,
              borderRadius: 8,
              display: "block",
              marginTop: i > 0 ? 8 : 0,
            }}
          />
        ),
      )}
    </>
  );
}

export type PassageChatProps = {
  variant: "public" | "internal";
};

export default function PassageChat({ variant }: PassageChatProps) {
  const [threadId, setThreadId] = useState(() => getOrCreateThreadId(variant));
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "assistant",
      content: variant === "public" ? publicIntro : internalIntro,
    },
  ]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAcc = useRef("");
  const pendingRef = useRef<PendingImage[]>([]);
  pendingRef.current = pendingImages;

  const revokePreviews = (items: PendingImage[]) => {
    for (const p of items) URL.revokeObjectURL(p.previewUrl);
  };

  useEffect(() => {
    return () => revokePreviews(pendingRef.current);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    const tid = getOrCreateThreadId(variant);
    setThreadId(tid);
    setMessages([
      {
        role: "assistant",
        content: variant === "public" ? publicIntro : internalIntro,
      },
    ]);
    setBooting(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/thread?threadId=${encodeURIComponent(tid)}&variant=${encodeURIComponent(variant)}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { messages?: ChatMessage[] };
        if (data.messages?.length) {
          setMessages(data.messages);
        }
      } catch {
        /* keep default intro */
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant]);

  const startNewChat = () => {
    revokePreviews(pendingImages);
    setPendingImages([]);
    const tid = resetThreadId(variant);
    setThreadId(tid);
    setMessages([
      {
        role: "assistant",
        content: variant === "public" ? publicIntro : internalIntro,
      },
    ]);
    setApiError(null);
  };

  const addImageFiles = async (files: File[]) => {
    const room = MAX_ATTACH - pendingImages.length;
    if (room <= 0) return;
    const next: PendingImage[] = [];
    let remaining = room;
    for (const file of files) {
      if (remaining <= 0) break;
      const part = await fileToImagePart(file);
      if (!part) continue;
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      next.push({ id, previewUrl, part });
      remaining -= 1;
    }
    if (next.length) setPendingImages((p) => [...p, ...next]);
  };

  // pendingImages removal is handled when sending (revokePreviews) for now

  const sendParts = async (parts: UserContentPart[] | string) => {
    const normalizedParts: UserContentPart[] =
      typeof parts === "string" ? [{ type: "text", text: parts }] : parts;
    const textOnly = normalizedParts.length === 1 && normalizedParts[0]?.type === "text";

    let userMsg: ChatMessage;
    if (textOnly) {
      userMsg = { role: "user", content: (normalizedParts[0] as { type: "text"; text: string }).text };
    } else {
      userMsg = { role: "user", content: normalizedParts };
    }

    revokePreviews(pendingImages);
    setPendingImages([]);

    const nextThread = [...messages, userMsg];
    setMessages(nextThread);
    setApiError(null);
    streamAcc.current = "";
    setSending(true);

      const payload = {
      variant,
      threadId,
      stream: true,
      messages: nextThread,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setApiError(errBody.error ?? `Request failed (${res.status})`);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const ct = res.headers.get("content-type") ?? "";

      if (ct.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let started = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const block of chunks) {
            const line = block.startsWith("data: ") ? block.slice(6) : block;
            if (!line.trim()) continue;
            let parsed: { type?: string; text?: string; error?: string; fullText?: string };
            try {
              parsed = JSON.parse(line) as typeof parsed;
            } catch {
              continue;
            }
            if (parsed.type === "delta" && parsed.text) {
              streamAcc.current += parsed.text;
              const acc = streamAcc.current;
              if (!started) {
                started = true;
                setMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              } else {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: acc };
                  return copy;
                });
              }
            }
            if (parsed.type === "error") {
              setApiError(parsed.error ?? "Stream error");
              setMessages((prev) => prev.slice(0, -1));
              return;
            }
            if (parsed.type === "done" && typeof parsed.fullText === "string") {
              streamAcc.current = parsed.fullText;
              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: parsed.fullText! };
                return copy;
              });
            }
          }
        }
        return;
      }

      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? `Request failed (${res.status})`);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!data.text?.trim()) {
        setApiError("Empty response from assistant.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.text as string }]);
    } catch {
      setApiError("Could not reach the assistant. Check your connection and try again.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") return prev.slice(0, -2);
        return prev.slice(0, -1);
      });
    } finally {
      setSending(false);
    }
  };

  const hasRealChat = messages.filter((m) => m.role === "user").length > 0;

  return (
    <div className="min-h-[100dvh] w-full relative">
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@1,600&display=swap"
        rel="stylesheet"
      />

      {/* subtle logo watermark for both */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("${getPassageWatermarkDataUrl({ fill: PURPLE })}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "320px 320px",
        }}
      />

      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/50 border-b border-bg-300">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PassageLogoMark size={34} />
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-text-200">Passage Assistant</div>
              <div className="text-[11px] text-text-400">
                {variant === "internal" ? "Internal · Staff Access" : "Public · Audience Access"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={startNewChat}
              className="text-text-300 hover:text-text-200 hover:bg-bg-200 px-2 py-1 rounded-lg transition-colors"
            >
              New chat
            </button>
            {variant === "public" ? (
              <Link
                to="/staff"
                className="text-accent hover:text-accent-hover px-2 py-1 rounded-lg transition-colors"
              >
                Staff login
              </Link>
            ) : (
              <button
                type="button"
                className="text-text-300 hover:text-text-200 hover:bg-bg-200 px-2 py-1 rounded-lg transition-colors"
                onClick={() => {
                  void (async () => {
                    try {
                      await fetch("/api/logout", { method: "POST", credentials: "include" });
                    } finally {
                      window.location.href = "/staff";
                    }
                  })();
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {!hasRealChat ? (
          <div className="min-h-[calc(100dvh-64px)] flex flex-col items-center justify-center py-10">
            <div className="w-full max-w-3xl text-center animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <PassageLogoMark size={80} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-light text-text-200 mb-3 tracking-tight">
                {variant === "internal" ? (
                  <>
                    Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}
                    , <span className="text-accent font-normal">Brishen</span>
                  </>
                ) : (
                  <>
                    Welcome to <span className="text-accent font-normal">Passage</span>.
                  </>
                )}
              </h1>
              <p className="text-sm text-text-300 max-w-xl mx-auto">
                {variant === "internal"
                  ? "Grants, programming, strategy, and staff workflows — ask for a draft, a plan, or a quick triage."
                  : "Shows, tickets, the venue, accessibility, and general questions about Passage in Trenton."}
              </p>
            </div>

            <div className="w-full mt-10">
              <ClaudeChatInput
                disabled={sending}
                placeholder={variant === "internal" ? "What can I help you draft or plan?" : "How can I help you today?"}
                onSendMessage={({ message, files }) => {
                  void (async () => {
                    const parts: UserContentPart[] = [];
                    if (message.trim()) parts.push({ type: "text", text: message.trim() });
                    // reuse existing image logic for images
                    if (files.length) {
                      const images = files.map((f) => f.file).filter((f) => f.type.startsWith("image/"));
                      if (images.length) await addImageFiles(images);
                      for (const p of pendingRef.current) parts.push(p.part);
                    }
                    await sendParts(parts.length === 1 && parts[0]?.type === "text" ? message.trim() : parts);
                  })();
                }}
              />
              {apiError ? (
                <div className="mx-auto max-w-2xl mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {apiError}
                </div>
              ) : null}
              <div className="text-center mt-4">
                <p className="text-xs text-text-500">AI can make mistakes. Please check important information.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6">
            {booting ? (
              <div className="text-sm text-text-400 text-center py-4">Loading saved conversation…</div>
            ) : null}

            <div className="space-y-4 pb-8">
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={cn(
                      "max-w-[min(720px,92%)] rounded-2xl px-4 py-3 text-[14px] leading-relaxed border",
                      msg.role === "user"
                        ? "bg-accent text-white border-transparent rounded-br-md shadow-sm"
                        : "bg-bg-100 text-text-100 border-bg-300 rounded-bl-md shadow-[0_8px_18px_rgba(33,13,56,0.06)]",
                    )}
                  >
                    {msg.role === "user" ? (
                      <UserMessageBody content={msg.content} />
                    ) : (
                      <AssistantMarkdown content={msg.content} linkColor={PURPLE} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="sticky bottom-0 pb-6 pt-3 bg-gradient-to-t from-[var(--bg-0)] via-[var(--bg-0)]/90 to-transparent">
              <ClaudeChatInput
                disabled={sending}
                placeholder="Reply…"
                onSendMessage={({ message, files }) => {
                  void (async () => {
                    const parts: UserContentPart[] = [];
                    if (message.trim()) parts.push({ type: "text", text: message.trim() });
                    if (files.length) {
                      const images = files.map((f) => f.file).filter((f) => f.type.startsWith("image/"));
                      if (images.length) await addImageFiles(images);
                      for (const p of pendingRef.current) parts.push(p.part);
                    }
                    await sendParts(parts.length === 1 && parts[0]?.type === "text" ? message.trim() : parts);
                  })();
                }}
              />
              {apiError ? (
                <div className="mx-auto max-w-2xl mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {apiError}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
