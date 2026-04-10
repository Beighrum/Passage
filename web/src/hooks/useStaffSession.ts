import { useEffect, useState } from "react";

export type StaffSessionState = "loading" | "yes" | "no";

export function useStaffSession(): StaffSessionState {
  const [state, setState] = useState<StaffSessionState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", { credentials: "include" });
        if (cancelled) return;
        setState(res.ok ? "yes" : "no");
      } catch {
        if (!cancelled) setState("no");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
