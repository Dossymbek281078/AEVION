"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProbeStatus = "ok" | "degraded" | "down" | "pending";

type Probe = {
  name: string;
  path: string;
  color: string;
};

type Sample = {
  ms: number;
  status: ProbeStatus;
  at: number; // unix ms
};

type SampleMap = Record<string, Sample[]>;

const PROBES: Probe[] = [
  { name: "AEVION root",     path: "/api/health",                 color: "#f1f5f9" },
  { name: "QGood",           path: "/api/qgood/health",           color: "#34d399" },
  { name: "QMaskCard",       path: "/api/qmaskcard/health",       color: "#a78bfa" },
  { name: "VeilNetX Ledger", path: "/api/veilnetx-ledger/health", color: "#a78bfa" },
  { name: "Z-Tide",          path: "/api/ztide/health",           color: "#34d399" },
  { name: "QChainGov",       path: "/api/qchaingov/health",       color: "#f472b6" },
  { name: "QPayNet",         path: "/api/qpaynet/health",         color: "#6366f1" },
];

const STATUS_COLOR: Record<ProbeStatus, string> = {
  ok: "#34d399",
  degraded: "#fbbf24",
  down: "#ef4444",
  pending: "#64748b",
};

const STATUS_LABEL: Record<ProbeStatus, string> = {
  ok: "OK",
  degraded: "DEGRADED",
  down: "DOWN",
  pending: "…",
};

const POLL_INTERVAL_MS = 10_000;
const HISTORY_SIZE = 60; // ~10 minutes at 10s interval
const FETCH_TIMEOUT_MS = 4500;

async function probeOne(base: string, p: Probe): Promise<Sample> {
  const url = `${base}${p.path}`;
  const startedAt = Date.now();
  let status: ProbeStatus = "down";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      try {
        const body = (await r.json()) as { status?: string };
        status = body?.status === "ok" ? "ok" : "degraded";
      } catch {
        status = "degraded";
      }
    } else {
      status = "down";
    }
  } catch {
    status = "down";
  }
  return { ms: Date.now() - startedAt, status, at: Date.now() };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function Sparkline({ samples, color }: { samples: Sample[]; color: string }) {
  if (samples.length === 0) {
    return <div style={{ width: 120, height: 28, color: "#475569", fontSize: 10 }}>—</div>;
  }
  const maxMs = Math.max(50, ...samples.map((s) => s.ms));
  const W = 120;
  const H = 28;
  const stepX = W / Math.max(1, HISTORY_SIZE - 1);
  const points = samples.map((s, i) => {
    const x = i * stepX;
    const y = H - Math.min(H - 2, (s.ms / maxMs) * (H - 4)) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  // bars for down samples
  const downBars = samples
    .map((s, i) =>
      s.status === "down"
        ? <rect key={i} x={i * stepX - 0.5} y={0} width={stepX + 1} height={H} fill="rgba(239,68,68,0.18)" />
        : null
    )
    .filter(Boolean);
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill="transparent" />
      {downBars}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(" ")}
      />
      <circle cx={(samples.length - 1) * stepX} cy={H - Math.min(H - 2, (samples[samples.length - 1].ms / maxMs) * (H - 4)) - 1} r={2} fill={STATUS_COLOR[samples[samples.length - 1].status]} />
    </svg>
  );
}

type LiveStatusProps = {
  apiBase: string;
  /** Optional initial samples from server-rendered SSR probe (one point each). */
  initial?: Record<string, Sample>;
};

export default function LiveStatus({ apiBase, initial }: LiveStatusProps) {
  const [samples, setSamples] = useState<SampleMap>(() => {
    if (!initial) return Object.fromEntries(PROBES.map((p) => [p.path, []]));
    return Object.fromEntries(PROBES.map((p) => [p.path, initial[p.path] ? [initial[p.path]] : []]));
  });
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const inflightRef = useRef(false);

  async function poll() {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const results = await Promise.all(PROBES.map((p) => probeOne(apiBase, p)));
      setSamples((prev) => {
        const next: SampleMap = { ...prev };
        PROBES.forEach((p, i) => {
          const arr = (next[p.path] ?? []).concat(results[i]);
          if (arr.length > HISTORY_SIZE) arr.splice(0, arr.length - HISTORY_SIZE);
          next[p.path] = arr;
        });
        return next;
      });
      setTick((t) => t + 1);
    } finally {
      inflightRef.current = false;
    }
  }

  useEffect(() => {
    if (paused) return;
    // Immediate first poll if no initial provided
    let firstTimer: ReturnType<typeof setTimeout> | null = null;
    const allEmpty = PROBES.every((p) => (samples[p.path]?.length ?? 0) === 0);
    if (allEmpty) {
      firstTimer = setTimeout(poll, 250);
    }
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (firstTimer) clearTimeout(firstTimer);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, apiBase]);

  const rows = useMemo(() => {
    return PROBES.map((p) => {
      const arr = samples[p.path] ?? [];
      const last = arr[arr.length - 1];
      const okMs = arr.filter((s) => s.status !== "down").map((s) => s.ms);
      return {
        ...p,
        last,
        history: arr,
        p50: okMs.length > 0 ? Math.round(percentile(okMs, 50)) : 0,
        p99: okMs.length > 0 ? Math.round(percentile(okMs, 99)) : 0,
        downCount: arr.filter((s) => s.status === "down").length,
      };
    });
  }, [samples]);

  const lastUpdated = useMemo(() => {
    const ts = rows.flatMap((r) => r.history.map((s) => s.at));
    if (ts.length === 0) return null;
    return new Date(Math.max(...ts));
  }, [rows]);

  const totalDown = rows.filter((r) => r.last?.status === "down").length;
  const totalDegraded = rows.filter((r) => r.last?.status === "degraded").length;
  const overallStatus: ProbeStatus = totalDown >= 3 ? "down" : totalDown + totalDegraded > 0 ? "degraded" : "ok";

  return (
    <section
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>
            Live monitor · polling every {POLL_INTERVAL_MS / 1000}s
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: STATUS_COLOR[overallStatus],
                boxShadow: paused ? "none" : `0 0 8px ${STATUS_COLOR[overallStatus]}`,
                animation: paused ? "none" : "live-pulse 1.4s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#cbd5e1" }}>
              {paused ? "Paused" : "Live"} · tick #{tick}
              {lastUpdated ? ` · last ${lastUpdated.toLocaleTimeString()}` : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            type="button"
            onClick={poll}
            disabled={paused}
            style={{
              background: paused ? "#0b1424" : "#0f172a",
              color: paused ? "#475569" : "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: paused ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            ↻ Poll now
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>Service</th>
              <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Now</th>
              <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>p50</th>
              <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>p99</th>
              <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Downs</th>
              <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = r.last?.status ?? "pending";
              return (
                <tr key={r.path} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "10px 6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color, boxShadow: `0 0 6px ${r.color}` }} />
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{r.name}</span>
                    </div>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.path}</div>
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: `${STATUS_COLOR[status]}1a`, border: `1px solid ${STATUS_COLOR[status]}`, color: STATUS_COLOR[status], fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace", color: status === "down" ? "#64748b" : "#e2e8f0" }}>
                    {r.last ? `${r.last.ms} ms` : "—"}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                    {r.history.length > 0 ? `${r.p50} ms` : "—"}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace", color: r.p99 > 1500 ? "#fbbf24" : "#cbd5e1" }}>
                    {r.history.length > 0 ? `${r.p99} ms` : "—"}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace", color: r.downCount > 0 ? "#ef4444" : "#64748b" }}>
                    {r.downCount}/{r.history.length}
                  </td>
                  <td style={{ padding: "10px 6px" }}>
                    <Sparkline samples={r.history} color={r.color} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>
    </section>
  );
}
