/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export type PlanningOgConfig = {
  code: string;
  badge: string;
  title: string;
  subtitle: string;
  accent: string;
  pills: string[];
};

const COLORS: Record<string, { bg: string; accent: string; pillBg: string; pillBorder: string }> = {
  emerald: { bg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)", accent: "#34d399", pillBg: "rgba(16, 185, 129, 0.2)", pillBorder: "#059669" },
  cyan: { bg: "linear-gradient(135deg, #083344 0%, #0e7490 100%)", accent: "#22d3ee", pillBg: "rgba(6, 182, 212, 0.2)", pillBorder: "#0891b2" },
  amber: { bg: "linear-gradient(135deg, #451a03 0%, #92400e 100%)", accent: "#fbbf24", pillBg: "rgba(245, 158, 11, 0.2)", pillBorder: "#d97706" },
  rose: { bg: "linear-gradient(135deg, #4c0519 0%, #9f1239 100%)", accent: "#fb7185", pillBg: "rgba(244, 63, 94, 0.2)", pillBorder: "#e11d48" },
  violet: { bg: "linear-gradient(135deg, #2e1065 0%, #6d28d9 100%)", accent: "#a78bfa", pillBg: "rgba(139, 92, 246, 0.2)", pillBorder: "#7c3aed" },
  sky: { bg: "linear-gradient(135deg, #082f49 0%, #0369a1 100%)", accent: "#38bdf8", pillBg: "rgba(14, 165, 233, 0.2)", pillBorder: "#0284c7" },
};

export const planningOgSize = { width: 1200, height: 630 };
export const planningOgContentType = "image/png";

export function planningOgImage(config: PlanningOgConfig, colorKey: keyof typeof COLORS = "emerald") {
  const c = COLORS[colorKey] ?? COLORS.emerald;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: c.bg,
          display: "flex",
          flexDirection: "column",
          padding: 64,
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              padding: "8px 20px",
              background: c.pillBg,
              border: `2px solid ${c.pillBorder}`,
              borderRadius: 16,
              color: c.accent,
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#64748b" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>{config.code}</div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 18,
              fontWeight: 700,
              padding: "6px 14px",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 12,
              color: c.accent,
              letterSpacing: 1,
            }}
          >
            {config.badge}
          </div>
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            marginBottom: 28,
            color: "#f8fafc",
          }}
        >
          <span>{config.title.replace(config.accent, "")}</span>
          <span style={{ color: c.accent }}>{config.accent}</span>
        </div>

        <div style={{ fontSize: 26, color: "#cbd5e1", lineHeight: 1.4, maxWidth: 980, marginBottom: 40 }}>
          {config.subtitle}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
          {config.pills.map((p) => (
            <div
              key={p}
              style={{
                fontSize: 20,
                fontWeight: 600,
                padding: "10px 22px",
                background: c.pillBg,
                border: `1px solid ${c.pillBorder}`,
                borderRadius: 999,
                color: "#f8fafc",
              }}
            >
              {p}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...planningOgSize },
  );
}
