import { useState, useEffect, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PassageLogoMark } from "../components/PassageLogoMark";
import { useStaffSession } from "../hooks/useStaffSession";
import { GooeyFilter } from "@/components/ui/gooey-filter";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";
import { getPassageCursorDataUrl, getPassageWatermarkDataUrl } from "@/lib/passage-brand";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

const BG = "#2E1A31";
const PURPLE = "#7B4F9E";
const LIGHT = "#F3EBF9";

export default function StaffLogin() {
  const navigate = useNavigate();
  const session = useStaffSession();
  const supa = useSupabaseSession();
  const screenSize = useScreenSize();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) return;

    const onReady = () => {
      const gsi = (
        window as unknown as {
          google?: {
            accounts: {
              id: {
                initialize: (cfg: {
                  client_id: string;
                  callback: (r: { credential: string }) => void;
                }) => void;
                renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
              };
            };
          };
        }
      ).google;
      const el = document.getElementById("google-sign-in");
      if (!gsi?.accounts?.id || !el) return;
      el.innerHTML = "";
      gsi.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential: string }) => {
          setError(null);
          setSubmitting(true);
          try {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ credential: response.credential }),
            });
            const raw = await res.text();
            let data: { error?: string } = {};
            if (raw) {
              try {
                data = JSON.parse(raw) as { error?: string };
              } catch {
                /* ignore */
              }
            }
            if (!res.ok) {
              setError(data.error ?? "Google sign-in failed.");
              return;
            }
            navigate("/staff/chat", { replace: true });
          } finally {
            setSubmitting(false);
          }
        },
      });
      gsi.accounts.id.renderButton(el, {
        theme: "filled_blue",
        size: "large",
        width: 360,
        text: "continue_with",
        locale: "en",
      });
    };

    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    ) as HTMLScriptElement | null;
    if (existing) {
      const w = window as unknown as { google?: { accounts?: { id?: unknown } } };
      if (w.google?.accounts?.id) onReady();
      else existing.addEventListener("load", onReady);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    document.body.appendChild(script);
  }, [googleClientId, navigate]);

  if (session === "loading") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          color: "#fff",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        Loading…
      </div>
    );
  }

  if (session === "yes") {
    return <Navigate to="/staff/chat" replace />;
  }

  if (supa.status === "signed_in") {
    return <Navigate to="/staff/chat" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const raw = await res.text();
      let data: { error?: string } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string };
        } catch {
          /* non-JSON error body */
        }
      }
      if (!res.ok) {
        setError(
          data.error ??
            (res.status === 401
              ? "Invalid password. If it keeps failing, confirm PASSAGE_INTERNAL_PASSWORD in Vercel matches this deployment."
              : `Login failed (${res.status}).`),
        );
        return;
      }
      navigate("/staff/chat", { replace: true });
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSupabaseSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: supaErr } = await supabase.auth.signInWithPassword({
        email,
        password: emailPassword,
      });
      if (supaErr) {
        setError(supaErr.message);
        return;
      }
      navigate("/staff/chat", { replace: true });
    } catch {
      setError("Supabase sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left))",
        background: `radial-gradient(ellipse at 50% 35%, ${BG}ee 0%, ${BG} 55%, #1a0f1c 100%)`,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        cursor: `url("${getPassageCursorDataUrl({ fill: PURPLE })}") 16 16, auto`,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <GooeyFilter id="staff-gooey-filter-pixel-trail" strength={5} />

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${getPassageWatermarkDataUrl({ fill: PURPLE })}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "260px 260px",
            opacity: 0.12,
            transform: "rotate(-8deg) scale(1.08)",
            transformOrigin: "center",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: "url(#staff-gooey-filter-pixel-trail)",
            opacity: 0.95,
          }}
        >
          <PixelTrail pixelSize={screenSize.lessThan("md") ? 22 : 28} fadeDuration={650} delay={0} />
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginBottom: 28,
          width: "100%",
          maxWidth: 400,
          boxSizing: "border-box",
          position: "relative",
          zIndex: 2,
        }}
      >
        <PassageLogoMark size={200} />
        <h1
          style={{
            margin: "20px 0 6px",
            fontSize: "clamp(1.125rem, 4vw, 1.375rem)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 0.3,
          }}
        >
          Staff access
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.45,
            padding: "0 4px",
            overflowWrap: "anywhere",
          }}
        >
          Internal assistant · grants, programming, executive support
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: "24px 22px 22px",
          backdropFilter: "blur(8px)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <label
          htmlFor="staff-password"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: LIGHT,
            marginBottom: 8,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Password
        </label>
        <input
          id="staff-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter staff password"
          disabled={submitting}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            fontSize: 15,
            borderRadius: 10,
            border: `1px solid ${PURPLE}55`,
            background: "rgba(255,255,255,0.95)",
            color: "#2D2D2D",
            marginBottom: 16,
          }}
        />
        {error && (
          <p
            role="alert"
            style={{
              margin: "0 0 14px",
              fontSize: 13,
              color: "#ffb4b4",
              lineHeight: 1.4,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
            borderRadius: 10,
            cursor: submitting ? "wait" : "pointer",
            background: `linear-gradient(135deg, ${PURPLE}, #4A2D6B)`,
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            opacity: submitting ? 0.85 : 1,
          }}
        >
          {submitting ? "Signing in…" : "Continue to internal assistant"}
        </button>
      </form>

      {supabase ? (
        <form
          onSubmit={(e) => void handleSupabaseSignIn(e)}
          style={{
            width: "100%",
            maxWidth: 360,
            marginTop: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: "18px 18px 16px",
            backdropFilter: "blur(8px)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Supabase sign-in (persistent)
          </div>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            disabled={submitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              fontSize: 14,
              borderRadius: 10,
              border: `1px solid ${PURPLE}40`,
              background: "rgba(255,255,255,0.95)",
              color: "#2D2D2D",
              marginBottom: 10,
            }}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            placeholder="Password"
            disabled={submitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              fontSize: 14,
              borderRadius: 10,
              border: `1px solid ${PURPLE}40`,
              background: "rgba(255,255,255,0.95)",
              color: "#2D2D2D",
              marginBottom: 10,
            }}
          />
          <button
            type="submit"
            disabled={submitting || !email || !emailPassword}
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              borderRadius: 10,
              cursor: submitting ? "wait" : "pointer",
              background: `linear-gradient(135deg, ${PURPLE}, #4A2D6B)`,
              color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              opacity: submitting ? 0.85 : 1,
            }}
          >
            Sign in with Supabase
          </button>
        </form>
      ) : null}

      {googleClientId ? (
        <>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
              marginTop: 22,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            or continue with Google (staff domain)
          </p>
          <div id="google-sign-in" style={{ display: "flex", justifyContent: "center" }} />
        </>
      ) : null}

      <p style={{ marginTop: 28, fontSize: 13, position: "relative", zIndex: 2 }}>
        <Link
          to="/"
          style={{ color: "rgba(255,255,255,0.75)", textDecoration: "underline" }}
        >
          ← Public assistant (audiences & community)
        </Link>
      </p>
    </div>
  );
}
