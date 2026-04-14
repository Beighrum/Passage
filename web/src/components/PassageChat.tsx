import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import { Link } from "react-router-dom";
import { PassageLogoMark } from "./PassageLogoMark";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { getOrCreateThreadId, resetThreadId } from "../lib/threadStorage";
import type { ChatMessage, ImageMediaType, UserContentPart } from "../../shared/chatMessages";
import { isImageMediaType } from "../../shared/chatMessages";
import { getPassageWatermarkDataUrl } from "@/lib/passage-brand";
import { AiAssistantCard } from "@/components/ui/ai-assistant-card";

const PURPLE = "#7B4F9E";
const DARK_PURPLE = "#4A2D6B";
const LIGHT_PURPLE = "#F3EBF9";
const TINT_PURPLE = "#F8F3FD";
const CHARCOAL = "#2D2D2D";
const SOFT_WHITE = "#FAFAFA";

const TypingIndicator = () => (
  <div style={{ display: "flex", gap: 4, padding: "12px 16px", alignItems: "center" }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: PURPLE,
          opacity: 0.5,
          animation: `typing 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
    <style>{`
      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }
    `}</style>
  </div>
);

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
  const mode = variant;
  const [threadId, setThreadId] = useState(() => getOrCreateThreadId(variant));
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "assistant",
      content: variant === "public" ? publicIntro : internalIntro,
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && pendingImages.length === 0) return;

    const parts: UserContentPart[] = [];
    if (text) parts.push({ type: "text", text });
    for (const p of pendingImages) parts.push(p.part);

    let userMsg: ChatMessage;
    if (parts.length === 1 && parts[0].type === "text") {
      userMsg = { role: "user", content: parts[0].text };
    } else {
      userMsg = { role: "user", content: parts };
    }

    revokePreviews(pendingImages);
    setPendingImages([]);
    setInput("");

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handlePasteImages = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const f = items[i].getAsFile();
      if (f?.type.startsWith("image/")) files.push(f);
    }
    if (files.length === 0) return;
    e.preventDefault();
    void addImageFiles(files);
  };

  const quickActions =
    mode === "internal"
      ? ["Triage a NOFA", "Draft grant narrative", "Check strategic alignment", "Board prep"]
      : ["Upcoming shows", "Buy tickets", "About Passage", "Accessibility info"];

  const staffLogout =
    variant === "internal" ? (
      <button
        type="button"
        onClick={() => {
          void (async () => {
            try {
              await fetch("/api/logout", { method: "POST", credentials: "include" });
            } finally {
              window.location.href = "/staff";
            }
          })();
        }}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#999",
          background: "none",
          border: "none",
          cursor: "pointer",
          textDecoration: "underline",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Sign out
      </button>
    ) : null;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: `linear-gradient(180deg, ${LIGHT_PURPLE} 0%, ${SOFT_WHITE} 30%)`,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@1,600&display=swap"
        rel="stylesheet"
      />

      {variant === "public" ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            backgroundImage: `url("${getPassageWatermarkDataUrl({ fill: PURPLE })}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "320px 320px",
            opacity: 0.06,
          }}
        />
      ) : null}

      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${PURPLE}15`,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PassageLogoMark size={40} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, lineHeight: 1.2 }}>
              Passage Assistant
            </div>
            <div style={{ fontSize: 10, color: "#999", letterSpacing: 0.5 }}>
              {mode === "internal" ? "Internal · Staff Access" : "Public · Audience Access"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={startNewChat}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            New chat
          </button>
          {variant === "public" && (
            <Link
              to="/staff"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: PURPLE,
                textDecoration: "none",
                letterSpacing: 0.4,
              }}
            >
              Staff login
            </Link>
          )}
          {staffLogout}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 16px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          opacity: booting ? 0.35 : 1,
          pointerEvents: booting ? "none" : "auto",
          transition: "opacity 0.2s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        {variant === "internal" && messages.length <= 1 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 12px" }}>
            <AiAssistantCard
              name="Brishen"
              onPrompt={(text) => {
                setInput(text);
                window.setTimeout(() => inputRef.current?.focus(), 50);
              }}
            />
          </div>
        ) : null}

        {booting && (
          <div
            style={{
              fontSize: 13,
              color: "#888",
              textAlign: "center",
              padding: 8,
            }}
          >
            Loading saved conversation…
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "12px 16px",
                borderRadius: 16,
                ...(msg.role === "user"
                  ? {
                      background: `linear-gradient(135deg, ${PURPLE}, ${DARK_PURPLE})`,
                      color: "#fff",
                      borderBottomRightRadius: 4,
                    }
                  : {
                      background: TINT_PURPLE,
                      color: CHARCOAL,
                      borderBottomLeftRadius: 4,
                      boxShadow: "0 8px 18px rgba(33, 13, 56, 0.08)",
                      border: `1px solid ${PURPLE}1f`,
                    }),
                fontSize: 14,
                lineHeight: 1.55,
                whiteSpace: msg.role === "user" ? "pre-wrap" : "normal",
              }}
            >
              {msg.role === "user" ? (
                <UserMessageBody content={msg.content} />
              ) : (
                <AssistantMarkdown content={msg.content} linkColor={PURPLE} />
              )}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.role === "user" && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                borderBottomLeftRadius: 4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                border: `1px solid ${PURPLE}10`,
              }}
            >
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && (
        <div
          style={{
            padding: "0 16px 8px",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {quickActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setInput(action);
                window.setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="quickAction"
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: 12,
                background: "rgba(255,255,255,0.9)",
                border: `1px solid ${PURPLE}3a`,
                color: DARK_PURPLE,
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "12px 16px 16px",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${PURPLE}10`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {apiError && (
          <div
            role="alert"
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              fontSize: 13,
              color: "#8b2942",
              background: "#fdeef0",
              borderRadius: 10,
              border: "1px solid #f0c4cb",
            }}
          >
            {apiError}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) void addImageFiles([...list]);
            e.target.value = "";
          }}
        />
        {pendingImages.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 10,
              alignItems: "center",
            }}
          >
            {pendingImages.map((p) => (
              <div key={p.id} style={{ position: "relative" }}>
                <img
                  src={p.previewUrl}
                  alt=""
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: `1px solid ${PURPLE}30`,
                    display: "block",
                  }}
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => removePendingImage(p.id)}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "none",
                    background: CHARCOAL,
                    color: "#fff",
                    fontSize: 14,
                    lineHeight: 1,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            background: "#fff",
            borderRadius: 14,
            padding: "4px 4px 4px 8px",
            border: `1.5px solid ${PURPLE}25`,
            boxShadow: "0 2px 12px rgba(123,79,158,0.06)",
            transition: "border-color 0.2s ease",
          }}
        >
          <button
            type="button"
            aria-label="Attach image"
            title="Attach image"
            onClick={() => fileInputRef.current?.click()}
            disabled={pendingImages.length >= MAX_ATTACH || sending}
            style={{
              width: 40,
              height: 40,
              marginBottom: 2,
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: pendingImages.length >= MAX_ATTACH ? "#ccc" : PURPLE,
              cursor: pendingImages.length >= MAX_ATTACH || sending ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePasteImages}
            placeholder={
              mode === "internal"
                ? "Ask about grants, programming, strategy..."
                : "Ask about shows, tickets, venue..."
            }
            rows={1}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              padding: "10px 0",
              background: "transparent",
              color: CHARCOAL,
              lineHeight: 1.4,
              maxHeight: 120,
              overflowY: "auto",
            }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={(!input.trim() && pendingImages.length === 0) || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background:
                (input.trim() || pendingImages.length > 0) && !sending
                  ? `linear-gradient(135deg, ${PURPLE}, ${DARK_PURPLE})`
                  : "#E0D5E8",
              cursor:
                (input.trim() || pendingImages.length > 0) && !sending ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#bbb",
            marginTop: 8,
            letterSpacing: 0.3,
          }}
        >
          Passage Theatre Assistant · Images: paste or attach (JPEG, PNG, GIF, WebP) · Built by BeighTech
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea::placeholder { color: #aaa; }
        .quickAction:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(74,45,107,0.10); border-color: ${PURPLE}66; }
        .quickAction:active { transform: translateY(0); box-shadow: none; }
        .quickAction:focus-visible { outline: 2px solid ${PURPLE}66; outline-offset: 2px; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${PURPLE}30; border-radius: 4px; }
      `}</style>
    </div>
  );
}
