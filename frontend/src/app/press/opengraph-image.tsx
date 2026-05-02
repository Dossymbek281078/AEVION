import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Press Kit — brand, boilerplate, contact";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SWATCHES = [
  { hex: "#0d9488", label: "Teal"   },
  { hex: "#7dd3fc", label: "Sky"    },
  { hex: "#a78bfa", label: "Violet" },
  { hex: "#fbbf24", label: "Amber"  },
  { hex: "#5eead4", label: "Mint"   },
  { hex: "#f472b6", label: "Pink"   },
];

export default function PressOg() {
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
            "radial-gradient(circle at 30% 30%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #020617 0%, #134e4a 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Press Kit
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
            <span>For press,</span>
            <span style={{ color: "#5eead4" }}>analysts, partners.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Brand assets, one-liners, 100-word boilerplate, key stats, founder contact.
            One page. Quote freely. Reply within 24h.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {SWATCHES.map((s) => (
              <div
                key={s.hex}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 70,
                    borderRadius: 10,
                    background: s.hex,
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 800, color: s.hex, fontFamily: "ui-monospace, SFMono-Regular, monospace", display: "flex" }}>
                  {s.hex}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", display: "flex" }}>{s.label}</div>
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
          <div style={{ display: "flex" }}>aevion.app/press</div>
          <div style={{ color: "#5eead4", display: "flex" }}>brand · boilerplate · stats</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
