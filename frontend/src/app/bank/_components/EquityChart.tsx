"use client";

// Historical balance sparkline. The bank API doesn't snapshot balance over
// time, so we reconstruct the curve from the operations feed: walk the ops
// chronologically, accumulate +/- against the user's account, and emit one
// point per day for the last N days. The final point matches the live
// account.balance, which validates the reconstruction.
//
// Two view modes:
//   "all"     — single curve = total balance
//   "byKind"  — three sublines stacking visible-without-overlap to show the
//               cumulative contribution of top-ups (purple), transfer-in
//               (teal) and transfer-out (red, drawn negative).
//
// Pure SVG, no chart library. Renders nothing if there are fewer than 2
// distinct days of activity.

import { useMemo, useState } from "react";
import type { Account, Operation } from "../_lib/types";

type Point = {
  ts: number;
  balance: number;
  topup: number;
  transferIn: number;
  transferOut: number; // negative or zero
};

type ViewMode = "all" | "byKind";

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildSeries(account: Account, operations: Operation[]): Point[] {
  const ops = [...operations].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  let total = 0;
  let topup = 0;
  let transferIn = 0;
  let transferOut = 0; // negative running
  const points: Point[] = [
    { ts: Date.parse(account.createdAt), balance: 0, topup: 0, transferIn: 0, transferOut: 0 },
  ];
  for (const op of ops) {
    const ts = Date.parse(op.createdAt);
    if (!Number.isFinite(ts)) continue;
    if (op.kind === "topup" && op.to === account.id) {
      total += op.amount;
      topup += op.amount;
    } else if (op.kind === "transfer") {
      if (op.from === account.id) {
        total -= op.amount;
        transferOut -= op.amount;
      }
      if (op.to === account.id) {
        total += op.amount;
        transferIn += op.amount;
      }
    }
    points.push({
      ts,
      balance: Math.round(total * 100) / 100,
      topup: Math.round(topup * 100) / 100,
      transferIn: Math.round(transferIn * 100) / 100,
      transferOut: Math.round(transferOut * 100) / 100,
    });
  }
  // Anchor a trailing point at "now" so the curve always lands on the
  // live balance even if the last op was hours ago.
  points.push({
    ts: Date.now(),
    balance: account.balance,
    topup,
    transferIn,
    transferOut,
  });
  return points;
}

function downsampleByDay(points: Point[]): Point[] {
  const byDay = new Map<string, Point>();
  for (const p of points) byDay.set(dayKey(p.ts), p);
  return Array.from(byDay.values()).sort((a, b) => a.ts - b.ts);
}

export function EquityChart({ account, operations }: { account: Account; operations: Operation[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>("all");

  const points = useMemo(() => downsampleByDay(buildSeries(account, operations)), [account, operations]);

  if (points.length < 2) return null;

  const W = 720;
  const H = 140;
  const PAD = 10;

  const xs = points.map((p) => p.ts);
  const allYs = points.flatMap((p) => [p.balance, p.topup, p.transferIn, p.transferOut]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yValuesForRange = view === "byKind" ? allYs : points.map((p) => p.balance);
  const yMin = Math.min(...yValuesForRange);
  const yMax = Math.max(...yValuesForRange);
  const ySpan = Math.max(1, yMax - yMin);
  const xSpan = Math.max(1, xMax - xMin);

  const toX = (t: number) => PAD + ((t - xMin) / xSpan) * (W - 2 * PAD);
  const toY = (v: number) => H - PAD - ((v - yMin) / ySpan) * (H - 2 * PAD);

  const linePath = (key: keyof Pick<Point, "balance" | "topup" | "transferIn" | "transferOut">) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.ts).toFixed(2)} ${toY(p[key] as number).toFixed(2)}`)
      .join(" ");

  const balancePath = linePath("balance");
  const balanceArea =
    `M ${toX(points[0].ts).toFixed(2)} ${toY(0).toFixed(2)} ` +
    points.map((p) => `L ${toX(p.ts).toFixed(2)} ${toY(p.balance).toFixed(2)}`).join(" ") +
    ` L ${toX(points[points.length - 1].ts).toFixed(2)} ${toY(0).toFixed(2)} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.balance - first.balance;
  const deltaPct = first.balance > 0 ? (delta / first.balance) * 100 : null;
  const deltaTone = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#64748b";

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const px = toX(points[i].ts);
      const dist = Math.abs(px - x);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const hover = hoverIdx != null ? points[hoverIdx] : null;
  const baselineY = toY(0);

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "12px 16px",
        marginBottom: 16,
      }}
      aria-label="Balance history"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
            Balance over time
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Reconstructed from {operations.length} operation{operations.length === 1 ? "" : "s"}.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div role="group" aria-label="Chart view" style={{ display: "inline-flex", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 8, overflow: "hidden" }}>
            {(["all", "byKind"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  padding: "5px 10px",
                  background: view === v ? "#0f172a" : "#fff",
                  color: view === v ? "#fff" : "#0f172a",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {v === "all" ? "All" : "By kind"}
              </button>
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", fontFamily: "ui-monospace, monospace", letterSpacing: -0.5 }}>
              {last.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span style={{ fontSize: 11, color: "#64748b" }}>AEC</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: deltaTone, marginTop: 2 }}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(2)} AEC
              {deltaPct != null ? ` (${delta >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)` : ""}
            </div>
          </div>
        </div>
      </header>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}
        role="img"
        aria-label={`Balance history ${view === "byKind" ? "split by kind" : "single curve"}. Latest ${last.balance.toFixed(2)} AEC.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124,58,237,0.30)" />
            <stop offset="100%" stopColor="rgba(124,58,237,0.0)" />
          </linearGradient>
        </defs>

        {view === "byKind" && yMin < 0 ? (
          <line x1={PAD} x2={W - PAD} y1={baselineY} y2={baselineY} stroke="rgba(15,23,42,0.20)" strokeDasharray="2 3" />
        ) : null}

        {view === "all" ? (
          <>
            <path d={balanceArea} fill="url(#equity-fill)" />
            <path d={balancePath} fill="none" stroke="#7c3aed" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d={linePath("topup")} fill="none" stroke="#7c3aed" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath("transferIn")} fill="none" stroke="#0d9488" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath("transferOut")} fill="none" stroke="#dc2626" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <path d={balancePath} fill="none" stroke="#0f172a" strokeWidth={1.0} strokeDasharray="3 2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}

        {hover ? (
          <>
            <line x1={toX(hover.ts)} x2={toX(hover.ts)} y1={PAD} y2={H - PAD} stroke="rgba(15,23,42,0.20)" strokeDasharray="2 3" />
            <circle cx={toX(hover.ts)} cy={toY(view === "all" ? hover.balance : hover.topup)} r={3.0} fill={view === "all" ? "#7c3aed" : "#7c3aed"} />
            {view === "byKind" ? (
              <>
                <circle cx={toX(hover.ts)} cy={toY(hover.transferIn)} r={3.0} fill="#0d9488" />
                <circle cx={toX(hover.ts)} cy={toY(hover.transferOut)} r={3.0} fill="#dc2626" />
              </>
            ) : null}
          </>
        ) : null}
      </svg>

      {view === "byKind" ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, fontWeight: 700, color: "#475569", marginTop: 4 }}>
          <LegendDot color="#7c3aed" label="Top-ups" />
          <LegendDot color="#0d9488" label="Transfer in" />
          <LegendDot color="#dc2626" label="Transfer out (negative)" />
          <LegendDot color="#0f172a" label="Net balance (dashed)" />
        </div>
      ) : null}

      {hover ? (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
          {new Date(hover.ts).toLocaleDateString()} ·{" "}
          {view === "all"
            ? `${hover.balance.toFixed(2)} AEC`
            : `topups ${hover.topup.toFixed(2)} · in ${hover.transferIn.toFixed(2)} · out ${hover.transferOut.toFixed(2)} · net ${hover.balance.toFixed(2)} AEC`}
        </div>
      ) : null}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
