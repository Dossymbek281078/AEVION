"use client";

import type { CSSProperties, ReactNode } from "react";

export function Sparkline({
  data,
  width = 280,
  height = 60,
  color = "#0d9488",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = (max - min) * 0.05 || Math.max(1, Math.abs(max) * 0.05);
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - lo) / range) * height}`)
    .join(" ");
  const fill = `0,${height} ${pts} ${width},${height}`;
  const last = data[data.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline points={fill} fill={`${color}1f`} stroke="none" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={height - ((last - lo) / range) * height} r="4" fill={color} />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "#fff",
        flex: "1 1 150px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || "#0f172a", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

export function Section({
  children,
  tone = "plain",
  style,
}: {
  children: ReactNode;
  tone?: "plain" | "accent" | "success" | "warn" | "danger";
  style?: CSSProperties;
}) {
  const tones: Record<string, { border: string; bg: string }> = {
    plain: { border: "rgba(15,23,42,0.1)", bg: "#fff" },
    accent: { border: "rgba(13,148,136,0.25)", bg: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.04))" },
    success: { border: "rgba(16,185,129,0.25)", bg: "rgba(16,185,129,0.03)" },
    warn: { border: "rgba(124,58,237,0.2)", bg: "rgba(124,58,237,0.04)" },
    danger: { border: "rgba(220,38,38,0.25)", bg: "rgba(220,38,38,0.04)" },
  };
  const t = tones[tone];
  return (
    <section
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: 20,
        background: t.bg,
        ...style,
      }}
    >
      {children}
    </section>
  );
}
