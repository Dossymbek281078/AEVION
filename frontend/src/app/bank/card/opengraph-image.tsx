import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Wallet Card — A card backed by reputation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function CardOg() {
  // Render a stylised card preview (Trusted-tier violet) on the right,
  // marketing copy on the left.
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 64,
          gap: 48,
          background:
            "radial-gradient(circle at 80% 80%, rgba(124,58,237,0.30), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 600 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#a78bfa",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Wallet Card
          </div>
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
            <span>A card backed by</span>
            <span style={{ color: "#a78bfa" }}>your reputation.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", lineHeight: 1.45, display: "flex" }}>
            No credit limit, no APR, no statement fee. The tier is your Trust Score.
            The shimmer marks it.
          </div>
        </div>

        {/* Card preview */}
        <div
          style={{
            position: "relative",
            width: 460,
            aspectRatio: "1.586 / 1",
            borderRadius: 24,
            background:
              "linear-gradient(135deg, #312e81 0%, #6d28d9 55%, #1e1b4b 100%)",
            boxShadow: "0 20px 50px rgba(15,23,42,0.55)",
            padding: 28,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transform: "rotate(-4deg)",
          }}
        >
          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, opacity: 0.85, display: "flex" }}>
                AEVION · BANK
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4, lineHeight: 1, letterSpacing: -1, display: "flex" }}>
                ₳
              </div>
            </div>
            <div
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                background: "#7c3aed",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Trusted
            </div>
          </div>

          {/* Chip */}
          <div
            style={{
              width: 52,
              height: 38,
              borderRadius: 6,
              background: "linear-gradient(135deg, #fbbf24, #d97706, #fbbf24)",
              display: "flex",
            }}
          />

          {/* Number */}
          <div
            style={{
              fontSize: 22,
              letterSpacing: 5,
              fontFamily: "monospace",
              fontWeight: 700,
              display: "flex",
            }}
          >
            ₳ ··· ··· A2F4
          </div>

          {/* Bottom row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.7, fontWeight: 700, display: "flex" }}>
                MEMBER
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, marginTop: 2, display: "flex" }}>
                AEVION USER
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.7, fontWeight: 700, display: "flex" }}>
                SINCE
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, display: "flex" }}>
                APR 26
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
