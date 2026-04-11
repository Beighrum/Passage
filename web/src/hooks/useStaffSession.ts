import { useEffect, useState } from "react";

export type StaffSessionState = "loading" | "yes" | "no";

export function useStaffSession(): StaffSessionState {
  const [state, setState] = useState<StaffSessionState>("loading");

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 12_000);
    (async () => {
      try {
        const res = await fetch("/api/session", {
          credentials: "include",
          signal: ac.signal,
        });
        if (cancelled) return;
        setState(res.ok ? "yes" : "no");
      } catch {
        if (!cancelled) setState("no");
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}
