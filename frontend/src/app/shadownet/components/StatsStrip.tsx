"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type Stats = {
  totalPosts: number;
  totalSizeBytes: number;
  uniqueAliases: number;
  topThreatModel?: { id: string; views: number } | null;
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/shadownet/stats"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, []);

  if (!stats) return null;

  const items = [
    { label: "Encrypted posts", value: stats.totalPosts.toLocaleString() },
    { label: "Total size", value: fmtBytes(stats.totalSizeBytes ?? 0) },
    { label: "Unique aliases", value: stats.uniqueAliases.toLocaleString() },
    { label: "Top threat model", value: stats.topThreatModel?.id ?? "—" },
  ];

  return (
    <div style={S.grid}>
      {items.map((it) => (
        <div key={it.label} style={S.cell}>
          <div style={S.value}>{it.value}</div>
          <div style={S.label}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  cell: {
    background: "rgba(26,5,51,0.5)",
    border: "1px solid rgba(168,85,247,0.25)",
    borderRadius: 12,
    padding: "14px 16px",
    textAlign: "center",
    backdropFilter: "blur(4px)",
  },
  value: {
    fontSize: 22,
    fontWeight: 800,
    color: "#c4b5fd",
    fontFamily: "monospace",
  },
  label: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
};
