"use client";

// Platform "AI spent rationally" widget. Reads the shared cross-module savings
// tally (GET /api/qcoreai/smart/savings) that every module routing through
// smartComplete feeds, and shows one live "⚡ saved $X · N calls" pill in the
// header. Fetches in useEffect (never in render) so the client base URL can't
// desync server/client hydration; renders nothing until the first successful
// read AND at least one routed run exists.
import { useEffect, useState } from "react";
import { getClientApiBase } from "@/lib/apiBase";

type Savings = {
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  estAlwaysCouncilUsd: number;
  savedUsd: number;
  savedPct: number;
};

export default function PlatformAiSavings() {
  const [data, setData] = useState<Savings | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const base = getClientApiBase();
        const r = await fetch(`${base}/api/qcoreai/smart/savings`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as Savings;
        if (alive && j && typeof j.runs === "number") setData(j);
      } catch {
        /* silent — the widget is non-critical */
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!data || data.runs <= 0) return null;

  const usd = data.savedUsd >= 0.005 ? `$${data.savedUsd.toFixed(2)}` : "<$0.01";
  const tip =
    `${data.runs} smart call${data.runs === 1 ? "" : "s"} routed rationally: ` +
    `${data.facts} factual → single flagship, ` +
    `${data.light} focused → light council, ` +
    `${data.deep} heavy → deep council. ` +
    `Saved ${usd} (${Math.round(data.savedPct)}%) vs always running the full Council.`;

  return (
    <span
      title={tip}
      aria-label={tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: "#065f46",
        background: "rgba(16,185,129,0.12)",
        border: "1px solid rgba(16,185,129,0.35)",
        cursor: "default",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>⚡</span>
      AI saved {usd}
      <span style={{ fontWeight: 600, opacity: 0.75 }}>· {data.runs}</span>
    </span>
  );
}
