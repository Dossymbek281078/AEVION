import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Help — How the wallet works, in plain language";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SECTIONS = [
  { glyph: "▶", label: "Getting started", color: "#5eead4" },
  { glyph: "→", label: "Send & receive", color: "#0ea5e9" },
  { glyph: "✦", label: "Saving", color: "#fbbf24" },
  { glyph: "◯", label: "Credit & Trust", color: "#a78bfa" },
  { glyph: "⛨", label: "Privacy", color: "#f472b6" },
  { glyph: "⚠", label: "Troubleshoot", color: "#f87171" },
];

export default function HelpOg() {
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
            "radial-gradient(circle at 20% 50%, rgba(13,148,136,0.30), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Help
          </div>
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
            <span>How the wallet works,</span>
            <span style={{ color: "#5eead4" }}>in plain language.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.45, display: "flex" }}>
            25 plain-language answers across six sections. Searchable. Multilingual.
            No FAQ archaeology.
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
            {SECTIONS.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.55)",
                  border: `1px solid ${s.color}40`,
                }}
              >
                <span
                  style={{
                    color: s.color,
                    fontSize: 18,
                    fontWeight: 900,
                    display: "flex",
                  }}
                >
                  {s.glyph}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#fff",
                    display: "flex",
                  }}
                >
                  {s.label}
                </span>
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
          <div style={{ display: "flex" }}>aevion.app/bank/help</div>
          <div style={{ color: "#5eead4", display: "flex" }}>EN · RU · KK</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
