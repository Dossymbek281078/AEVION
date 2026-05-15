import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Ecosystem — activity feed + module health matrix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SOURCES = [
  { label: "qsocial",  color: "#7dd3fc" },
  { label: "qmedia",   color: "#f472b6" },
  { label: "qnews",    color: "#fbbf24" },
  { label: "qright",   color: "#a78bfa" },
  { label: "planet",   color: "#86efac" },
  { label: "earnings", color: "#fb923c" },
];

// 7×4 module-grid heat-strip — purely decorative, deterministic
const GRID_ROWS = 4;
const GRID_COLS = 7;
const HEAT_PATTERN = [
  "g g g a g g a",
  "g a g g g a g",
  "g g g g g g g",
  "a g g a g g g",
];

function cellColor(ch: string): string {
  if (ch === "g") return "#34d399"; // healthy
  if (ch === "a") return "#fbbf24"; // attention
  return "#475569";
}

export default function EcosystemOg() {
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
            "radial-gradient(circle at 20% 25%, rgba(125,211,252,0.25), transparent 55%), radial-gradient(circle at 85% 75%, rgba(244,114,182,0.22), transparent 55%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #7dd3fc, #f472b6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 900,
              color: "#020617",
            }}
          >
            E
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#cbd5e1",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Ecosystem
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>One activity feed.</span>
            <span
              style={{
                background: "linear-gradient(120deg, #7dd3fc 0%, #a78bfa 50%, #f472b6 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Every module health-checked.
            </span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#cbd5e1",
              maxWidth: 1000,
              lineHeight: 1.45,
              display: "flex",
            }}
          >
            qsocial · qmedia · qnews · qright · planet · earnings — merged stream + live
            module-health matrix coloured by tier and your touch.
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 36, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Array.from({ length: GRID_ROWS }).map((_, r) => (
                <div key={r} style={{ display: "flex", gap: 6 }}>
                  {Array.from({ length: GRID_COLS }).map((__, c) => {
                    const ch = (HEAT_PATTERN[r] || "").split(" ")[c] || "g";
                    return (
                      <div
                        key={c}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: cellColor(ch),
                          opacity: ch === "g" ? 0.9 : 0.85,
                          display: "flex",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {SOURCES.map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${s.color}55`,
                    background: "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "fit-content",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 8,
                      background: s.color,
                      display: "flex",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#f8fafc",
                      display: "flex",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      letterSpacing: 1,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
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
          <div style={{ display: "flex" }}>aevion.app/ecosystem</div>
          <div style={{ color: "#f472b6", display: "flex" }}>27 nodes · one Trust Graph</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
