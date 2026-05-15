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
  const items = [
    { label: "Total tasks", value: stats?.totalTasks ?? "—", accent: "#f97316" },
    { label: "Done", value: stats?.doneTasks ?? "—", accent: "#22c55e" },
    { label: "Streak", value: stats ? `${stats.streakDays}d` : "—", accent: "#a78bfa" },
    {
      label: "Focus time",
      value: stats ? `${Math.floor(stats.totalFocusMin / 60)}h ${stats.totalFocusMin % 60}m` : "—",
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
