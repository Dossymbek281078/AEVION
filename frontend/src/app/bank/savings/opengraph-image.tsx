import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Savings — Three ways to set money aside";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PRODUCTS = [
  { glyph: "✦", label: "Goals", color: "#a78bfa", desc: "Named buckets" },
  { glyph: "◈", label: "Vault", color: "#0ea5e9", desc: "Stake for yield" },
  { glyph: "↻", label: "Round-Up", color: "#5eead4", desc: "Virtual change" },
];

export default function SavingsOg() {
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
            "radial-gradient(circle at 50% 0%, rgba(217,119,6,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
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
              color: "#fbbf24",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Savings
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
            <span>Three ways to</span>
            <span style={{ color: "#fbbf24" }}>set money aside.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.45, display: "flex" }}>
            One dashboard rolls Goals, AEC Vault and Round-Up into a single position view —
            see the whole stash without context-switching.
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {PRODUCTS.map((p) => (
              <div
                key={p.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: 20,
                  borderRadius: 16,
                  background: "rgba(15,23,42,0.55)",
                  border: `1px solid ${p.color}40`,
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${p.color}26`,
                    color: p.color,
                    fontSize: 26,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {p.glyph}
                </span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", display: "flex" }}>{p.label}</span>
                <span style={{ fontSize: 14, color: "#cbd5e1", display: "flex" }}>{p.desc}</span>
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
          <div style={{ display: "flex" }}>aevion.app/bank/savings</div>
          <div style={{ color: "#fbbf24", display: "flex" }}>read-only · live MVP</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
