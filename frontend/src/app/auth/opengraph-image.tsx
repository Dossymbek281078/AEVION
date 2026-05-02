import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sign in to AEVION — one identity for the whole Trust OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MODULES = ["QRight", "QSign", "Bureau", "Planet", "Bank", "Awards", "CyberChess", "QCoreAI"];

export default function AuthOg() {
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
            "radial-gradient(circle at 50% 30%, rgba(125,211,252,0.30), transparent 55%), linear-gradient(135deg, #020617 0%, #0c4a6e 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#7dd3fc", textTransform: "uppercase", display: "flex" }}>
          AEVION · Sign in
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
            <span>One identity.</span>
            <span style={{ color: "#7dd3fc" }}>The whole Trust OS.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            One AEVION account unlocks every module — registry, signatures, bureau, validators,
            bank, awards, AI agents, chess. No 27 logins. One.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {MODULES.map((m) => (
              <div
                key={m}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(125,211,252,0.30)",
                  background: "rgba(125,211,252,0.08)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#e0f2fe",
                  display: "flex",
                }}
              >
                {m}
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
          <div style={{ display: "flex" }}>aevion.app/auth</div>
          <div style={{ color: "#7dd3fc", display: "flex" }}>email · social · passkey-ready</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
