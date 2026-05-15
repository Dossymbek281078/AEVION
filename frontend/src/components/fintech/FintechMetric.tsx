"use client";

/**
 * FintechMetric — reusable counter widget with optional sparkline.
 * Compact, can be used in dashboards, headers, sidebars.
 *
 * Zone: aevion-core/main owns frontend/src/components/fintech/**
 */

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

type Props = {
  /** Display label */
  label: string;
  /** API path to poll (e.g., /api/qgood/stats) */
  apiPath: string;
  /** JSON path to extract value (e.g., "total_raised_cents" or "stats.total") */
  valuePath: string;
  /** Optional formatter for the extracted value */
  format?: (v: unknown) => string;
  /** Accent color */
  accent?: string;
  /** Icon/emoji prefix */
  icon?: string;
  /** Poll interval in seconds (default: 60) */
  pollSeconds?: number;
};

function extractByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return null;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return cur;
}

function defaultFormat(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString("en-US");
  }
  if (typeof v === "string" && v.length > 14) return `${v.slice(0, 6)}…${v.slice(-4)}`;
  return String(v);
}

export default function FintechMetric({
  label, apiPath, valuePath,
  format = defaultFormat,
  accent = "#a78bfa",
  icon,
  pollSeconds = 60,
}: Props) {
  const [value, setValue] = useState<string>("…");
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const apiBase = getApiBase();
        const r = await fetch(`${apiBase}${apiPath}`, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = await r.json();
        const raw = extractByPath(body, valuePath);
        if (cancelled) return;
        setValue(format(raw));
        if (typeof raw === "number" && Number.isFinite(raw)) {
          setHistory((h) => [...h.slice(-19), raw]);
        }
        setLoading(false);
      } catch {
        if (!cancelled) { setValue("—"); setLoading(false); }
      }
    };
    fetchOnce();
    const t = setInterval(fetchOnce, pollSeconds * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [apiPath, valuePath, format, pollSeconds]);

  // Build sparkline
  const sparkline = (() => {
    if (history.length < 2) return null;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = Math.max(1, max - min);
    const W = 60, H = 18;
    const pts = history.map((v, i) => {
      const x = (i / (history.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <svg width={W} height={H} aria-hidden style={{ display: "block", marginTop: 4 }}>
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  })();

  return (
    <div style={{
      padding: "10px 14px",
      background: "rgba(15,23,42,0.6)",
      border: `1px solid ${accent}30`,
      borderRadius: 10,
      minHeight: 70,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}>
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div style={{
        fontSize: 20,
        fontWeight: 900,
        color: loading ? "#475569" : accent,
        fontFamily: "ui-monospace, monospace",
        lineHeight: 1.1,
        transition: "color 0.3s",
      }}>
        {value}
      </div>
      {sparkline}
    </div>
  );
}
