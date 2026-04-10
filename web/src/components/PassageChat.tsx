import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { PassageLogoMark } from "./PassageLogoMark";
import { getOrCreateThreadId, resetThreadId } from "../lib/threadStorage";

const PURPLE = "#7B4F9E";
const DARK_PURPLE = "#4A2D6B";
const LIGHT_PURPLE = "#F3EBF9";
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

type ChatMessage = { role: "user" | "assistant"; content: string };

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
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamAcc = useRef("");

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

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    const nextThread = [...messages, userMsg];
    setMessages(nextThread);
    setInput("");
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
        background: `linear-gradient(180deg, ${LIGHT_PURPLE} 0%, ${SOFT_WHITE} 30%)`,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@1,600&display=swap"
        rel="stylesheet"
      />

      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${PURPLE}15`,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
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
        }}
      >
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
                      background: "#fff",
                      color: CHARCOAL,
                      borderBottomLeftRadius: 4,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      border: `1px solid ${PURPLE}10`,
                    }),
                fontSize: 14,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
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
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: 12,
                background: "#fff",
                border: `1px solid ${PURPLE}30`,
                color: PURPLE,
                cursor: "pointer",
                fontWeight: 500,
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            background: "#fff",
            borderRadius: 14,
            padding: "4px 4px 4px 16px",
            border: `1.5px solid ${PURPLE}25`,
            boxShadow: "0 2px 12px rgba(123,79,158,0.06)",
            transition: "border-color 0.2s ease",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
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
            disabled={!input.trim() || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background:
                input.trim() && !sending
                  ? `linear-gradient(135deg, ${PURPLE}, ${DARK_PURPLE})`
                  : "#E0D5E8",
              cursor: input.trim() && !sending ? "pointer" : "default",
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
          Passage Theatre Assistant · Built by BeighTech
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea::placeholder { color: #aaa; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${PURPLE}30; border-radius: 4px; }
      `}</style>
    </div>
  );
}
