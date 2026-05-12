import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QMedia — Music · Videos · Creative AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0c4a6e 0%, #0d9488 50%, #7c3aed 100%)",
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
              background: "rgba(45, 212, 191, 0.2)",
              border: "2px solid #2dd4bf",
              borderRadius: 16,
              color: "#99f6e4",
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#94a3b8" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>QMedia</div>
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
          <span style={{ color: "#f8fafc" }}>Music · Video</span>
          <span style={{ color: "#5eead4" }}>Creative AI</span>
        </div>

        <div
          style={{ fontSize: 30, color: "#cbd5e1", lineHeight: 1.4, maxWidth: 980, marginBottom: 40 }}
        >
          Tracks · Playlists · Videos · AI-lyrics · AI-titles · color palettes · all on one social media hub.
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
          {[
            { t: "🎵 Music", c: "#0d9488" },
            { t: "🎬 Videos", c: "#7c3aed" },
            { t: "🎨 Creative", c: "#d97706" },
            { t: "📋 Playlists", c: "#0284c7" },
            { t: "❤ Likes", c: "#e11d48" },
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
