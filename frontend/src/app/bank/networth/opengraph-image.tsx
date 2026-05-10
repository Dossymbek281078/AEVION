import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Net Worth — Stacked-asset view";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STACK = [
  { label: "Wallet", color: "#0d9488", pct: 38 },
  { label: "Vault", color: "#5eead4", pct: 24 },
  { label: "Royalty", color: "#a78bfa", pct: 18 },
  { label: "Chess", color: "#fbbf24", pct: 12 },
  { label: "Other", color: "#475569", pct: 8 },
];

export default function NetworthOg() {
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
            "radial-gradient(circle at 30% 80%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Net Worth
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
            <span>One number,</span>
            <span style={{ color: "#5eead4" }}>five layers.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Wallet, vaults, royalty streams, chess winnings — every layer of wealth
            stacked into one number with momentum-over-time.
          </div>
          <div style={{ display: "flex", height: 38, borderRadius: 10, overflow: "hidden", maxWidth: 920, background: "rgba(255,255,255,0.06)" }}>
            {STACK.map((s) => (
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
          <div style={{ display: "flex" }}>aevion.app/bank/networth</div>
          <div style={{ color: "#5eead4", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
