import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";

type SupabaseSessionState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; session: Session };

export function useSupabaseSession(): SupabaseSessionState {
  const [state, setState] = useState<SupabaseSessionState>(() =>
    supabase ? { status: "loading" } : { status: "disabled" },
  );

  useEffect(() => {
    if (!supabase) return;

    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        if (data.session) setState({ status: "signed_in", session: data.session });
        else setState({ status: "signed_out" });
      })
      .catch(() => {
        if (!alive) return;
        setState({ status: "signed_out" });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) setState({ status: "signed_in", session });
      else setState({ status: "signed_out" });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

