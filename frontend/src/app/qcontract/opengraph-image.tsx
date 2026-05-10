import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QContract — Self-Destruct Smart Documents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              padding: "8px 20px",
              background: "rgba(139, 92, 246, 0.2)",
              border: "2px solid #8b5cf6",
              borderRadius: 16,
              color: "#c4b5fd",
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#64748b" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>QContract</div>
        </div>

        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#f8fafc" }}>Self-destruct</span>
          <span style={{ color: "#a78bfa" }}>smart documents</span>
        </div>

        <div
          style={{
            fontSize: 30,
            color: "#cbd5e1",
            lineHeight: 1.4,
            maxWidth: 980,
            marginBottom: 40,
          }}
        >
          Burn-after-N-reads · Time expiry · Password gate · Email watermark ·
          QRight cert · Audit log
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
          {[
            { t: "🔥 Burn", c: "#dc2626" },
            { t: "⏱ Expire", c: "#d97706" },
            { t: "🔒 Password", c: "#7c3aed" },
            { t: "🪪 Watermark", c: "#0891b2" },
            { t: "📋 Audit", c: "#16a34a" },
          ].map(p => (
            <div
              key={p.t}
              style={{
                fontSize: 22,
                fontWeight: 600,
                padding: "10px 22px",
                background: `${p.c}33`,
                border: `1px solid ${p.c}`,
                borderRadius: 999,
                color: "#f8fafc",
              }}
            >
              {p.t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
