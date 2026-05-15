// Probes whether a backend endpoint is alive for the current authenticated
// user. Used by RoyaltyStream / ChessWinnings / TotalEarningsDashboard to
// flip their StatusPill from MOCK to PARTIAL once the real endpoint
// responds — even if it returns an empty list (test mode).
//
// In test environment, the new /api/ecosystem/earnings, /api/qright/royalties
// and /api/cyberchess/results endpoints exist but typically have no events
// yet (no webhook traffic). Showing a working response is enough to upgrade
// the chip from "mock" to "partial".

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export type LiveProbe = {
  alive: boolean | null;
  count: number | null;
};

export function useLiveProbe(path: string, itemsKey = "items"): LiveProbe {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const headers = authHeaders();
    if (!headers.Authorization) {
      setAlive(false);
      return;
    }
    fetch(apiUrl(path), { headers, cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setAlive(false);
          return;
        }
        try {
          const j = (await r.json()) as Record<string, unknown>;
          const items = j[itemsKey];
          setAlive(true);
          setCount(Array.isArray(items) ? items.length : 0);
        } catch {
          setAlive(true);
          setCount(0);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAlive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, itemsKey]);

  return { alive, count };
}
