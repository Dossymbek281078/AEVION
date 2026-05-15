"use client";

const palette = {
  gold:     "#d4af37",
  goldSoft: "#f5d27a",
  navy:     "#0b1736",
  navy2:    "#131f3d",
  ink:      "#e7ecf8",
  inkDim:   "#9aa3c0",
};

export interface StatsPayload {
  total: number;
  byCategory: Record<string, number>;
  unlockedToday: number;
}

interface StatsBarProps {
  stats: StatsPayload | null;
  loading?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  knowledge:    "📚 Знания",
  values:       "🧭 Ценности",
  instructions: "📜 Инструкции",
  future_self:  "💌 Будущему себе",
  advice:       "🗝 Советы",
};

export default function StatsBar({ stats, loading }: StatsBarProps) {
  const cellStyle: React.CSSProperties = {
    flex: "1 1 140px",
    minWidth: 140,
    padding: "14px 16px",
    borderRadius: 12,
    border: `1px solid ${palette.gold}30`,
    background: `linear-gradient(180deg, ${palette.navy}, ${palette.navy2})`,
  };

  const totalAcrossCats = stats
    ? Object.values(stats.byCategory).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        margin: "0 0 28px",
      }}
    >
      <div style={cellStyle}>
        <div style={{ color: palette.inkDim, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Всего капсул
        </div>
        <div
          style={{
            color: palette.goldSoft,
            fontSize: 32,
            fontFamily: "monospace",
            marginTop: 4,
            lineHeight: 1,
          }}
        >
          {loading ? "··" : stats?.total ?? 0}
        </div>
      </div>

      <div style={cellStyle}>
        <div style={{ color: palette.inkDim, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Открываются сегодня
        </div>
        <div
          style={{
            color: stats && stats.unlockedToday > 0 ? palette.gold : palette.ink,
            fontSize: 32,
            fontFamily: "monospace",
            marginTop: 4,
            lineHeight: 1,
          }}
        >
          {loading ? "··" : stats?.unlockedToday ?? 0}
        </div>
      </div>

      <div style={{ ...cellStyle, flex: "2 1 240px" }}>
        <div style={{ color: palette.inkDim, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          По категориям
        </div>
        {loading || !stats || totalAcrossCats === 0 ? (
          <div style={{ color: palette.inkDim, marginTop: 8, fontSize: 13 }}>
            пока пусто
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {Object.entries(stats.byCategory).map(([cat, count]) => (
              <span
                key={cat}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: `${palette.gold}18`,
                  border: `1px solid ${palette.gold}40`,
                  color: palette.goldSoft,
                }}
                title={cat}
              >
                {CATEGORY_LABELS[cat] ?? cat} · {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
