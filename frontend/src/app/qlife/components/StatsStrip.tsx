"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useQlifeT, type Key } from "../i18n";

interface QLifeStats {
  total: number;
  activeUsers: number;
  mostLoggedType: string | null;
}


export default function StatsStrip({ refreshKey }: { refreshKey: number }) {
  const { t, typeLabel } = useQlifeT();
  const [stats, setStats] = useState<QLifeStats | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/qlife/stats"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d); })
      .catch(() => {});
  }, [refreshKey]);

  const items = [
    {
      label: t("stats.total"),
      value: stats ? String(stats.total) : "—",
      color: "#6ee7b7",
    },
    {
      label: t("stats.users"),
      value: stats ? String(stats.activeUsers) : "—",
      color: "#60a5fa",
    },
    {
      label: t("stats.most"),
      value: stats?.mostLoggedType
        ? (typeLabel(stats.mostLoggedType))
        : "—",
      color: "#f472b6",
    },
  ];

  return (
    <div style={styles.strip}>
      {items.map((item) => (
        <div key={item.label} style={styles.item}>
          <span style={{ ...styles.value, color: item.color }}>{item.value}</span>
          <span style={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  strip: {
    display: "flex",
    gap: 0,
    background: "rgba(15,23,42,0.8)",
    border: "1px solid #1e293b",
    borderRadius: 14,
    overflow: "hidden",
  },
  item: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 10px",
    borderRight: "1px solid #1e293b",
    gap: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
};
