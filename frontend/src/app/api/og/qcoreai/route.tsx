import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "QCoreAI";
  const subtitle = searchParams.get("sub") || "Multi-Agent AI Platform · AEVION";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #7c3aed, #4338ca)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#fff" }}>
            ✦
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#c4b5fd" }}>AEVION</div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 64, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 20 }}>
          {title}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 28, color: "#94a3b8", marginBottom: 48 }}>
          {subtitle}
        </div>

        {/* Feature chips */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["Multi-agent pipeline", "Eval harness", "Batch runs", "Custom pipelines", "Prompt optimization"].map((f) => (
            <div key={f} style={{ padding: "8px 20px", borderRadius: 999, background: "rgba(124,58,237,0.3)", color: "#c4b5fd", fontSize: 18, fontWeight: 700, border: "1px solid rgba(124,58,237,0.5)" }}>
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
