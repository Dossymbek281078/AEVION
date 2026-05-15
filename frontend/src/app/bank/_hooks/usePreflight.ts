"use client";

/**
 * usePreflight — fast parallel health check fired on /bank mount.
 *
 * Returns the state of the two checks the bank UI absolutely depends on:
 *   • backend reachable at all (GET /api/health, accepts any 2xx/3xx/404)
 *   • current JWT (if present) resolves a user (GET /api/auth/me)
 *
 * Different from BackendStatus (which silently re-pings every 60s and
 * surfaces a small bottom-left pill on failure): pre-flight is meant to
 * surface an *actionable* banner at the top of /bank when the UI cannot
 * possibly work, before the user wonders why every panel is empty.
 *
 * The hook is stable (no auto-retry) so callers can re-run on demand
 * via the returned `recheck()` function.
 */

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

export type PreflightState = {
  ready: boolean;
  backendUp: boolean;
  authValid: boolean | null; // null = no token → not applicable
  ms: number | null;
  recheck: () => void;
};

export function usePreflight(): PreflightState {
  const [ready, setReady] = useState(false);
  const [backendUp, setBackendUp] = useState(false);
  const [authValid, setAuthValid] = useState<boolean | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const recheck = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setMs(null);
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    let token = "";
    try {
      token = (typeof window !== "undefined" && localStorage.getItem(TOKEN_KEY)) || "";
    } catch {
      /* ignore */
    }

    const healthP = fetch(apiUrl("/api/health"), { cache: "no-store" })
      .then((r) => r.ok || r.status === 404)
      .catch(() => false);

    const meP: Promise<boolean | null> = token
      ? fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.ok)
          .catch(() => false)
      : Promise.resolve(null);

    void Promise.all([healthP, meP]).then(([h, m]) => {
      if (cancelled) return;
      setBackendUp(h);
      setAuthValid(m);
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      setMs(Math.round(t1 - t0));
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { ready, backendUp, authValid, ms, recheck };
}
