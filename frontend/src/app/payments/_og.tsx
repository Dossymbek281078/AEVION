import type { ReactElement } from "react";

export type SubOg = {
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
  accentSecondary: string;
  pills: string[];
  emoji: string;
};

export function ogJsx({
  title,
  subtitle,
  badge,
  accent,
  accentSecondary,
  pills,
  emoji,
}: SubOg): ReactElement {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: `radial-gradient(circle at 80% 0%, ${accent}55, transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)`,
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: -1,
          }}
        >
          {emoji}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: accent,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          AEVION · {badge}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: -2.5,
            maxWidth: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{
              background: `linear-gradient(90deg, ${accent}, ${accentSecondary}, #fbbf24)`,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {title}
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {pills.map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: `1px solid ${accent}77`,
                background: `${accent}1f`,
                fontSize: 18,
                fontWeight: 700,
                color: accent,
                display: "flex",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: 22,
            color: "#cbd5e1",
            maxWidth: 940,
            lineHeight: 1.45,
            display: "flex",
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          fontSize: 16,
          fontWeight: 700,
          color: "#94a3b8",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex" }}>aevion.app/payments</div>
        <div style={{ color: accent, display: "flex" }}>
          payments-rail · v1
        </div>
      </div>
    </div>
  );
}
