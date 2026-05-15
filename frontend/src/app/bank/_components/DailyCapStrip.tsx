"use client";

// Surfaces the server-side daily caps that the wallet routes enforce.
// Fetches /api/qtrade/cap-status and renders one progress bar per kind
// (top-up / transfer) so users see remaining headroom *before* they
// trip a 429. Auto-refreshes every 60s; refetches on the same event
// the wallet uses to invalidate operations.

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type CapBucket = { used: number; cap: number; remainingSec: number };

type CapStatus = {
  topup: CapBucket;
  transfer: CapBucket;
  resetsAtIso: string;
};

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function fmtAec(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function DailyCapStrip() {
  const [status, setStatus] = useState<CapStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const t = readToken();
    if (!t) {
      setStatus(null);
      setLoaded(true);
      return;
    }
    try {
      const r = await fetch(apiUrl("/api/qtrade/cap-status"), {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      if (!r.ok) {
        setStatus(null);
        setLoaded(true);
        return;
      }
      const j = (await r.json()) as CapStatus;
      setStatus(j);
      setLoaded(true);
    } catch {
      setStatus(null);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Don't render anything pre-auth or pre-load: avoids a layout flash
  // for signed-out viewers.
  if (!loaded || !status) return null;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "12px 16px",
        marginBottom: 16,
      }}
      aria-label="Daily limits"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
          Daily limits (UTC)
        </div>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          resets in {fmtCountdown(status.topup.remainingSec)}
        </div>
      </header>
      <Row label="Top-up" used={status.topup.used} cap={status.topup.cap} hue="#7c3aed" />
      <Row label="Transfer" used={status.transfer.used} cap={status.transfer.cap} hue="#0ea5e9" />
    </section>
  );
}

function Row({ label, used, cap, hue }: { label: string; used: number; cap: number; hue: string }) {
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0;
  const pct = Math.round(ratio * 100);
  const tone = ratio >= 1 ? "#dc2626" : ratio >= 0.85 ? "#d97706" : hue;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "#0f172a", fontWeight: 700 }}>{label}</span>
        <span style={{ color: tone, fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
          {fmtAec(used)} / {fmtAec(cap)} AEC ({pct}%)
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(15,23,42,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: tone,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
