import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank — Wallet for the trust graph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function AboutOg() {
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
            "radial-gradient(circle at 80% 0%, rgba(13,148,136,0.40), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: -1,
            }}
          >
            ₳
          </div>
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
            AEVION · Bank
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Wallet for the</span>
            <span
              style={{
                background: "linear-gradient(90deg, #5eead4, #a78bfa, #fbbf24)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              trust graph.
            </span>
          </div>

          <div
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              maxWidth: 920,
              lineHeight: 1.45,
              display: "flex",
            }}
          >
            Royalties auto-land. Credit gated by reputation, not paperwork. Every
            social moment can carry money. Built creator-first.
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
          <div style={{ display: "flex" }}>aevion.app/bank/about</div>
          <div style={{ color: "#5eead4", display: "flex" }}>live · multilingual · pwa</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
