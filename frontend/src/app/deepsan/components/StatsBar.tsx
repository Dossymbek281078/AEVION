import { useDeepsanT } from "../i18n";
"use client";

interface Stats {
  totalTasks: number;
  doneTasks: number;
  totalFocusMin: number;
  streakDays: number;
}

interface StatsBarProps {
  stats: Stats | null;
  loading: boolean;
}

export default function StatsBar({ stats, loading }: StatsBarProps) {
  const t = useDeepsanT();
  const items = [
    { label: t("stats.total"), value: stats?.totalTasks ?? "—", accent: "#f97316" },
    { label: t("stats.done"), value: stats?.doneTasks ?? "—", accent: "#22c55e" },
    { label: t("stats.streak"), value: stats ? t("stats.days", { n: stats.streakDays }) : "—", accent: "#a78bfa" },
    {
      label: t("stats.focus"),
      value: stats ? t("stats.hm", { h: Math.floor(stats.totalFocusMin / 60), m: stats.totalFocusMin % 60 }) : "—",
      accent: "#38bdf8",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: "12px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: item.accent,
              opacity: loading ? 0.4 : 1,
              transition: "opacity 0.3s",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {loading ? "…" : item.value}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
