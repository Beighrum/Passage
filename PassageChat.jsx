import { useState, useRef, useEffect } from "react";

const PURPLE = "#7B4F9E";
const DARK_PURPLE = "#4A2D6B";
const LIGHT_PURPLE = "#F3EBF9";
const GOLD = "#C9A84C";
const CHARCOAL = "#2D2D2D";
const SOFT_WHITE = "#FAFAFA";

const PassageLogo = () => (
  <svg viewBox="0 0 200 40" style={{ width: 160, height: 32 }}>
    <text x="0" y="30" fontFamily="Georgia, serif" fontSize="28" fontWeight="bold" fontStyle="italic" fill={PURPLE}>
      Passage
    </text>
    <text x="142" y="30" fontFamily="Georgia, serif" fontSize="10" fill="#999" letterSpacing="1">
      
    </text>
    <line x1="0" y1="36" x2="128" y2="36" stroke={PURPLE} strokeWidth="1.5" />
    <text x="0" y="39" fontFamily="sans-serif" fontSize="5.5" fill="#888" letterSpacing="3.2">
      T H E A T R E &nbsp; C O M P A N Y
    </text>
  </svg>
);

const TypingIndicator = () => (
  <div style={{ display: "flex", gap: 4, padding: "12px 16px", alignItems: "center" }}>
    {[0, 1, 2].map(i => (
      <div
        key={i}
        style={{
          width: 7, height: 7, borderRadius: "50%", background: PURPLE, opacity: 0.5,
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

const ModeToggle = ({ mode, setMode }) => (
  <div style={{
    display: "flex", borderRadius: 8, overflow: "hidden",
    border: `1px solid ${PURPLE}22`, background: "#fff",
  }}>
    {["internal", "public"].map(m => (
      <button
        key={m}
        onClick={() => setMode(m)}
        style={{
          padding: "6px 14px", fontSize: 11, fontWeight: mode === m ? 700 : 400,
          fontFamily: "'DM Sans', sans-serif",
          background: mode === m ? PURPLE : "transparent",
          color: mode === m ? "#fff" : CHARCOAL,
          border: "none", cursor: "pointer", textTransform: "uppercase",
          letterSpacing: 1, transition: "all 0.2s ease",
        }}
      >
        {m}
      </button>
    ))}
  </div>
);

const initialMessages = [
  {
    role: "assistant",
    content: "Welcome to the Passage Theatre Assistant. I'm connected to Passage's institutional knowledge — grant narratives, strategic plan, programming, and policies.\n\nHow can I help today?",
  },
];

export default function PassageChat() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("internal");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate response for prototype — replace with Claude API call in production
    setTimeout(() => {
      const responses = {
        internal: [
          "I've reviewed the Strategic Plan FY 2026-2028 and the latest 990. Based on Passage's four strategic goals, here's how I'd map this to the funder's priorities...",
          "Looking at the awarded Geraldine Dodge narrative, I can adapt the community impact language to this NOFA. Let me pull the relevant sections from the knowledge base...",
          "According to the Strategic Plan, Goal 3 focuses on stabilizing funding while growing local support. The key activities include developing a comprehensive sponsorship and grant application strategy. This aligns directly with the funder's stated priorities.",
          "The Needs Statement documents that 26% of Trenton's population are minors, and 28% live below the poverty line. Vision & Voice served 30 families with 80%+ showing growth in assessed areas. I can build the narrative around these documented outcomes.",
        ],
        public: [
          "Passage Theatre's next production is part of Season 41: Not Afraid. You can purchase tickets at passagetheatre.org/tickets or call the Box Office at (609) 392-0766.",
          "The Mill Hill Playhouse is located at 205 E Front Street, Trenton, NJ. There's accessible parking on Front Street, a ramp entrance on the South Montgomery side, and an elevator to the theatre. For accommodations, contact admin@passagetheatre.org at least 2 days in advance.",
          "Passage Theatre is Trenton's only professional equity theatre, founded in 1985. Our mission is to create socially-relevant plays and arts programming that deeply resonate with our communities. We organize programming under three pillars: TrentonPREMIERES, TrentonMAKES, and TrentonPRESENTS.",
        ],
      };
      const pool = responses[mode];
      const reply = pool[Math.floor(Math.random() * pool.length)];
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = mode === "internal"
    ? ["Triage a NOFA", "Draft grant narrative", "Check strategic alignment", "Board prep"]
    : ["Upcoming shows", "Buy tickets", "About Passage", "Accessibility info"];

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: `linear-gradient(180deg, ${LIGHT_PURPLE} 0%, ${SOFT_WHITE} 30%)`,
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@1,600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "14px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: `1px solid ${PURPLE}15`,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${DARK_PURPLE}, ${PURPLE})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontFamily: "Georgia, serif", fontStyle: "italic",
            fontSize: 18, fontWeight: "bold",
          }}>
            P
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, lineHeight: 1.2 }}>
              Passage Assistant
            </div>
            <div style={{ fontSize: 10, color: "#999", letterSpacing: 0.5 }}>
              {mode === "internal" ? "Internal · Staff Access" : "Public · Audience Access"}
            </div>
          </div>
        </div>
        <ModeToggle mode={mode} setMode={(m) => {
          setMode(m);
          setMessages([{
            role: "assistant",
            content: m === "internal"
              ? "Switched to Internal Mode. I have access to grant narratives, strategic plan, financials, and institutional documents. How can I help?"
              : "Switched to Public Mode. I can help with show info, tickets, venue details, and general questions about Passage Theatre."
          }]);
        }} />
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: "auto", padding: "16px 16px 8px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div style={{
              maxWidth: "82%", padding: "12px 16px", borderRadius: 16,
              ...(msg.role === "user"
                ? {
                    background: `linear-gradient(135deg, ${PURPLE}, ${DARK_PURPLE})`,
                    color: "#fff", borderBottomRightRadius: 4,
                  }
                : {
                    background: "#fff", color: CHARCOAL,
                    borderBottomLeftRadius: 4,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    border: `1px solid ${PURPLE}10`,
                  }),
              fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              background: "#fff", borderRadius: 16, borderBottomLeftRadius: 4,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${PURPLE}10`,
            }}>
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div style={{
          padding: "0 16px 8px", display: "flex", gap: 8,
          flexWrap: "wrap", justifyContent: "center",
        }}>
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                setInput(action);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              style={{
                padding: "8px 14px", borderRadius: 20, fontSize: 12,
                background: "#fff", border: `1px solid ${PURPLE}30`,
                color: PURPLE, cursor: "pointer", fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => {
                e.target.style.background = LIGHT_PURPLE;
                e.target.style.borderColor = PURPLE;
              }}
              onMouseLeave={e => {
                e.target.style.background = "#fff";
                e.target.style.borderColor = `${PURPLE}30`;
              }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "12px 16px 16px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderTop: `1px solid ${PURPLE}10`,
      }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 10,
          background: "#fff", borderRadius: 14, padding: "4px 4px 4px 16px",
          border: `1.5px solid ${PURPLE}25`,
          boxShadow: "0 2px 12px rgba(123,79,158,0.06)",
          transition: "border-color 0.2s ease",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "internal" ? "Ask about grants, programming, strategy..." : "Ask about shows, tickets, venue..."}
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              padding: "10px 0", background: "transparent", color: CHARCOAL,
              lineHeight: 1.4, maxHeight: 120, overflowY: "auto",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            style={{
              width: 40, height: 40, borderRadius: 10, border: "none",
              background: input.trim() && !isTyping
                ? `linear-gradient(135deg, ${PURPLE}, ${DARK_PURPLE})`
                : "#E0D5E8",
              cursor: input.trim() && !isTyping ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease", flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div style={{
          textAlign: "center", fontSize: 10, color: "#bbb",
          marginTop: 8, letterSpacing: 0.3,
        }}>
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
