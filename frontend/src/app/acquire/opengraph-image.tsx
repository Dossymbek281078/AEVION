import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Partnership Brief — one planet, built by one person with AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FACTS = [
  { k: "41", label: "modules tracked", color: "#5eead4" },
  { k: "$10M", label: "returnable advance", color: "#a78bfa" },
  { k: "51/49", label: "revenue split", color: "#fbbf24" },
  { k: "1", label: "human · AI as the eng team", color: "#7dd3fc" },
];

export default function AcquireOg() {
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
            "radial-gradient(circle at 30% 20%, rgba(16,185,129,0.25), transparent 55%), linear-gradient(135deg, #050810 0%, #0f172a 60%, #050810 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#10b981", textTransform: "uppercase", display: "flex" }}>
          AEVION · Partnership Brief
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>One person + AI =</span>
            <span style={{ color: "#10b981" }}>an entire platform.</span>
          </div>
          <div style={{ fontSize: 23, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.45, display: "flex" }}>
            Registry, e-signatures, compliance, chess, construction estimates, health tools —
            live on Claude, one legal core, one deal on the table.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {FACTS.map((f) => (
              <div
                key={f.label}
                style={{
                  flex: 1,
                  padding: "18px 16px",
                  borderRadius: 12,
                  border: `1px solid ${f.color}55`,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 34, fontWeight: 900, color: f.color, display: "flex" }}>{f.k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", display: "flex" }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, color: "#94a3b8", display: "flex" }}>aevion.vercel.app/acquire</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981", display: "flex" }}>Astana → the world</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
