import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QFusionAI — Hybrid AI Router";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #0c0a09 100%)",
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
              background: "rgba(168, 85, 247, 0.2)",
              border: "2px solid #a855f7",
              borderRadius: 16,
              color: "#d8b4fe",
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#64748b" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>QFusionAI</div>
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
          <span style={{ color: "#f8fafc" }}>Hybrid AI</span>
          <span style={{ color: "#c084fc" }}>Router</span>
        </div>

        <div
          style={{ fontSize: 30, color: "#cbd5e1", lineHeight: 1.4, maxWidth: 980, marginBottom: 40 }}
        >
          5 LLM providers · auto-routing by cost/latency/quality · fallback
          chain · response cache · one API
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
          {[
            { t: "OpenAI", c: "#10b981" },
            { t: "Anthropic", c: "#f59e0b" },
            { t: "Gemini", c: "#3b82f6" },
            { t: "DeepSeek", c: "#8b5cf6" },
            { t: "Grok", c: "#ec4899" },
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
