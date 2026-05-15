import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Wealth Forecast — 3 scenarios, 3 horizons";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SCENARIOS = [
  { name: "Conservative", color: "#94a3b8", growth: 1.04 },
  { name: "Realistic", color: "#0ea5e9", growth: 1.18 },
  { name: "Optimistic", color: "#5eead4", growth: 1.42 },
];

// Generate 12-point curves for each scenario (relative to start = 100)
function buildCurve(growth: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= 11; i++) {
    out.push(100 * Math.pow(growth, i / 11));
  }
  return out;
}

export default function ForecastOg() {
  const w = 920;
  const h = 280;
  const xOf = (i: number) => (i / 11) * w;
  const minVal = 100;
  const maxVal = 100 * SCENARIOS[SCENARIOS.length - 1].growth;
  const yOf = (v: number) => h - ((v - minVal) / (maxVal - minVal)) * (h - 30) - 15;

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
            "radial-gradient(circle at 80% 20%, rgba(94,234,212,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
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
          AEVION · Forecast
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
            <span>Three scenarios.</span>
            <span style={{ color: "#5eead4" }}>Three horizons.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Conservative · Realistic · Optimistic projections across 30 / 90 / 365 days,
            with goal ETAs derived from your earning streams.
          </div>

          {/* SVG-like polylines via nested divs are too messy; use a single SVG. */}
          <div
            style={{
              display: "flex",
              padding: 18,
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(94,234,212,0.20)",
              maxWidth: 980,
            }}
          >
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
              <line x1={0} y1={h - 15} x2={w} y2={h - 15} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
              {SCENARIOS.map((s) => {
                const pts = buildCurve(s.growth);
                const d = pts
                  .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
                  .join(" ");
                return (
                  <g key={s.name}>
                    <path d={d} fill="none" stroke={s.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={xOf(11)} cy={yOf(pts[11])} r={7} fill={s.color} />
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {SCENARIOS.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 18,
                  color: "#cbd5e1",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: s.color,
                    display: "flex",
                  }}
                />
                <span style={{ fontWeight: 800, color: "#fff", display: "flex" }}>{s.name}</span>
                <span style={{ display: "flex", color: s.color, fontWeight: 700 }}>
                  +{Math.round((s.growth - 1) * 100)}%
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
          <div style={{ display: "flex" }}>aevion.app/bank/forecast</div>
          <div style={{ color: "#5eead4", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
