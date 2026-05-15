import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Changelog — Every shipped feature";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ENTRIES = [
  { date: "2026-04-28", title: "10 standalone widget pages — budget, calendar, forecast, ...", color: "#5eead4" },
  { date: "2026-04-27", title: "Recurring + Insights + Flow + Onboarding", color: "#a78bfa" },
  { date: "2026-04-26", title: "Story suite — about / trust / security / help / glossary", color: "#fbbf24" },
];

export default function ChangelogOg() {
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
            "radial-gradient(circle at 50% 30%, rgba(94,234,212,0.30), transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Changelog
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Every shipped</span>
            <span style={{ color: "#5eead4" }}>feature.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
            {ENTRIES.map((e) => (
              <div
                key={e.date}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${e.color}55`,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    color: e.color,
                    minWidth: 130,
                    display: "flex",
                  }}
                >
                  {e.date}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", display: "flex", flex: 1 }}>{e.title}</span>
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
          <div style={{ display: "flex" }}>aevion.app/bank/changelog</div>
          <div style={{ color: "#5eead4", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
