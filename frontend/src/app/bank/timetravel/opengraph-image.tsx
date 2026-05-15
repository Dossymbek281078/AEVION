import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Time Travel — Replay any past month";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const HEIGHTS = [40, 65, 50, 80, 95, 70, 110];

export default function TimetravelOg() {
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
            "radial-gradient(circle at 70% 30%, rgba(124,58,237,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#a78bfa", textTransform: "uppercase", display: "flex" }}>
          AEVION · Time Travel
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Replay any</span>
            <span style={{ color: "#a78bfa" }}>past month.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Step back to any month — see what your balance, royalties, and recurring rules
            looked like at that exact moment in time.
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 8, height: 130 }}>
            {MONTHS.map((m, i) => (
              <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 56,
                    height: HEIGHTS[i],
                    borderRadius: 8,
                    background:
                      i === 4
                        ? "linear-gradient(180deg, #a78bfa, #7c3aed)"
                        : "rgba(167,139,250,0.20)",
                    display: "flex",
                  }}
                />
                <div style={{ fontSize: 14, fontWeight: 700, color: i === 4 ? "#a78bfa" : "#94a3b8", display: "flex" }}>{m}</div>
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
          <div style={{ display: "flex" }}>aevion.app/bank/timetravel</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
