import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Wealth Constellation — Visual map of every stream";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STARS = [
  { x: 250, y: 180, r: 18, color: "#5eead4", label: "Wallet" },
  { x: 420, y: 130, r: 12, color: "#a78bfa", label: "Royalty" },
  { x: 580, y: 200, r: 10, color: "#fbbf24", label: "Chess" },
  { x: 720, y: 110, r: 9, color: "#0ea5e9", label: "Ecosystem" },
  { x: 350, y: 260, r: 11, color: "#f472b6", label: "Goal" },
  { x: 530, y: 290, r: 8, color: "#5eead4", label: "Vault" },
  { x: 660, y: 250, r: 7, color: "#fbbf24", label: "Recurring" },
];

const LINES = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [2, 5],
  [4, 5],
  [5, 6],
];

export default function ConstellationOg() {
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
            "radial-gradient(circle at 50% 40%, rgba(99,102,241,0.30), transparent 60%), linear-gradient(135deg, #020617 0%, #0f172a 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#a78bfa", textTransform: "uppercase", display: "flex" }}>
          AEVION · Constellation
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: -2,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>Every stream,</span>
              <span style={{ color: "#a78bfa" }}>one map.</span>
            </div>
            <div style={{ fontSize: 20, color: "#cbd5e1", lineHeight: 1.45, display: "flex" }}>
              Wallet, royalties, ecosystem, chess, goals, vaults — visualised as one
              constellation. Hover to inspect, link to dive in.
            </div>
          </div>
          <svg width={460} height={400} viewBox="100 80 700 280">
            {LINES.map(([a, b], i) => (
              <line
                key={i}
                x1={STARS[a].x}
                y1={STARS[a].y}
                x2={STARS[b].x}
                y2={STARS[b].y}
                stroke="rgba(167,139,250,0.40)"
                strokeWidth={1.5}
              />
            ))}
            {STARS.map((s, i) => (
              <g key={i}>
                <circle cx={s.x} cy={s.y} r={s.r} fill={s.color} />
                <circle cx={s.x} cy={s.y} r={s.r + 8} fill="none" stroke={s.color} strokeWidth={1} opacity={0.4} />
              </g>
            ))}
          </svg>
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
          <div style={{ display: "flex" }}>aevion.app/bank/constellation</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
