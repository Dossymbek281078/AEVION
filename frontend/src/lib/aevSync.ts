"use client";

import { useEffect, useRef } from "react";
import {
  isAevBackendEnabled,
  fetchWallet,
  syncWallet,
  type AevWalletSnapshot,
} from "./aevApi";

// Periodic sync hook for the AEV wallet.
//
// Lifecycle on mount:
//   1. (pull) GET /api/aev/wallet/:deviceId — if exists и backend lifetimeMined
//      больше localStorage'а, callbacks.onRemoteAhead({balance,lifetimeMined,...})
//      даёт frontend'у возможность принять remote-state.
//   2. (loop) каждые intervalMs (default 30s):
//        push → POST /api/aev/wallet/:deviceId/sync с current snapshot.
//        Backend max()'ит lifetime counters → offline mints на other device
//        не теряются.
//
// No-op when isAevBackendEnabled() === false. Никогда не throws.
//
// Usage в /aev page:
//   const wallet = ... (from useState/ldWallet)
//   useAevSync({
//     getSnapshot: () => walletToSnapshot(wallet),
//     onRemoteAhead: (remote) => setWallet(applyRemote(wallet, remote)),
//   });

export function useAevSync(opts: {
  getSnapshot: () => Partial<AevWalletSnapshot> | null;
  onRemoteAhead?: (remote: AevWalletSnapshot) => void;
  intervalMs?: number;
  enabled?: boolean;
}) {
  const { getSnapshot, onRemoteAhead, intervalMs = 30_000, enabled = true } = opts;
  const lastPushedTs = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isAevBackendEnabled()) return;
    cancelledRef.current = false;

    // Initial pull
    (async () => {
      const r = await fetchWallet();
      if (r.ok && onRemoteAhead) {
        const remote = (r.data as { wallet: AevWalletSnapshot }).wallet;
        const local = getSnapshot();
        const localLifetime = Number(local?.lifetimeMined) || 0;
        if (remote && remote.lifetimeMined > localLifetime + 1e-6) {
          if (!cancelledRef.current) onRemoteAhead(remote);
        }
      }
    })();

    // Periodic push
    const id = setInterval(async () => {
      if (cancelledRef.current) return;
      const snap = getSnapshot();
      if (!snap) return;
      const lt = Number(snap.lifetimeMined) || 0;
      // skip identical pushes — avoid hammering backend with no-op writes
      if (lt === lastPushedTs.current) return;
      lastPushedTs.current = lt;
      await syncWallet(snap);
    }, Math.max(5_000, intervalMs));

    // Push on hidden→visible (navigated back)
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const snap = getSnapshot();
        if (snap) syncWallet(snap);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    // Push on beforeunload (best effort, sendBeacon-style — но fetch keepalive ok)
    const onUnload = () => {
      const snap = getSnapshot();
      if (snap) {
        // syncWallet returns Promise; fire-and-forget acceptable here
        syncWallet(snap);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", onUnload);
    }

    return () => {
      cancelledRef.current = true;
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", onUnload);
      }
    };
    // getSnapshot/onRemoteAhead expected stable refs; recreate effect only on
    // enabled or intervalMs changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);
}
