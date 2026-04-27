import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Insights — Where your money goes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Sample stacked-bar segments matching the 4 spending categories.
const SEGMENTS = [
  { label: "Subscriptions", color: "#d97706", pct: 42 },
  { label: "Tips & micro", color: "#db2777", pct: 18 },
  { label: "Contacts", color: "#0ea5e9", pct: 25 },
  { label: "Other", color: "#475569", pct: 15 },
];

export default function InsightsOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at 80% 40%, rgba(217,70,239,0.30), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#a78bfa",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          AEVION · Insights
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Where your</span>
            <span style={{ color: "#a78bfa" }}>money goes.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Auto-categorised outgoing transfers. Period-over-period comparison.
            Biggest tx with one-click receipt. All computed locally.
          </div>

          {/* Sample stacked bar */}
          <div
            style={{
              display: "flex",
              height: 38,
              borderRadius: 10,
              overflow: "hidden",
              background: "rgba(255,255,255,0.06)",
              maxWidth: 920,
            }}
          >
            {SEGMENTS.map((s) => (
              <div
                key={s.label}
                style={{
                  width: `${s.pct}%`,
                  background: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(15,23,42,0.85)",
                }}
              >
                {s.pct}%
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {SEGMENTS.map((s) => (
              <div
                key={s.label}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "#cbd5e1" }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: s.color,
                    display: "flex",
                  }}
                />
                <span style={{ fontWeight: 700, color: "#fff", display: "flex" }}>{s.label}</span>
              </div>
            ))}
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
          <div style={{ display: "flex" }}>aevion.app/bank/insights</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
