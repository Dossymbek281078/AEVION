"use client";

// Historical balance sparkline. The bank API doesn't snapshot balance over
// time, so we reconstruct the curve from the operations feed: walk the ops
// chronologically, accumulate +/- against the user's account, and emit one
// point per day for the last N days. The final point matches the live
// account.balance, which validates the reconstruction.
//
// Pure SVG, no chart library. Renders nothing if there are fewer than 2
// distinct days of activity (no curve would be informative).

import { useMemo, useState } from "react";
import type { Account, Operation } from "../_lib/types";

type Point = { ts: number; balance: number };

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildSeries(account: Account, operations: Operation[]): Point[] {
  // Sort operations oldest → newest so we can accumulate.
  const ops = [...operations].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  let running = 0;
  const points: Point[] = [{ ts: Date.parse(account.createdAt), balance: 0 }];
  for (const op of ops) {
    const ts = Date.parse(op.createdAt);
    if (!Number.isFinite(ts)) continue;
    if (op.kind === "topup" && op.to === account.id) {
      running += op.amount;
    } else if (op.kind === "transfer") {
      if (op.from === account.id) running -= op.amount;
      if (op.to === account.id) running += op.amount;
    }
    points.push({ ts, balance: Math.round(running * 100) / 100 });
  }
  // Anchor the trailing point at "now" with the live balance — covers
  // the gap between the last op and right now (e.g. cap-status without
  // any new movement).
  points.push({ ts: Date.now(), balance: account.balance });
  return points;
}

function downsampleByDay(points: Point[]): Point[] {
  // One point per day — the last balance touched on that day.
  const byDay = new Map<string, Point>();
  for (const p of points) {
    byDay.set(dayKey(p.ts), p);
  }
  return Array.from(byDay.values()).sort((a, b) => a.ts - b.ts);
}

export function EquityChart({ account, operations }: { account: Account; operations: Operation[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(() => downsampleByDay(buildSeries(account, operations)), [account, operations]);

  if (points.length < 2) return null;

  const W = 720;
  const H = 120;
  const PAD = 8;

  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.balance);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = Math.max(1, yMax - yMin);
  const xSpan = Math.max(1, xMax - xMin);

  const toX = (t: number) => PAD + ((t - xMin) / xSpan) * (W - 2 * PAD);
  const toY = (v: number) => H - PAD - ((v - yMin) / ySpan) * (H - 2 * PAD);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.ts).toFixed(2)} ${toY(p.balance).toFixed(2)}`)
    .join(" ");
  const area =
    `M ${toX(points[0].ts).toFixed(2)} ${(H - PAD).toFixed(2)} ` +
    points.map((p) => `L ${toX(p.ts).toFixed(2)} ${toY(p.balance).toFixed(2)}`).join(" ") +
    ` L ${toX(points[points.length - 1].ts).toFixed(2)} ${(H - PAD).toFixed(2)} Z`;

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
      </header>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}
        role="img"
        aria-label={`Balance history sparkline. Latest ${last.balance.toFixed(2)} AEC, change ${delta.toFixed(2)} AEC.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124,58,237,0.30)" />
            <stop offset="100%" stopColor="rgba(124,58,237,0.0)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#equity-fill)" />
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        {hover ? (
          <>
            <line
              x1={toX(hover.ts)}
              x2={toX(hover.ts)}
              y1={PAD}
              y2={H - PAD}
              stroke="rgba(15,23,42,0.20)"
              strokeDasharray="2 3"
            />
            <circle cx={toX(hover.ts)} cy={toY(hover.balance)} r={3.2} fill="#7c3aed" />
          </>
        ) : null}
      </svg>
      {hover ? (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
          {new Date(hover.ts).toLocaleDateString()} · {hover.balance.toFixed(2)} AEC
        </div>
      ) : null}
    </section>
  );
}
