import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Developers — REST + SDK + webhooks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ENDPOINTS = [
  { method: "POST", path: "/api/qright/register",  color: "#7dd3fc" },
  { method: "POST", path: "/api/qsign/sign",       color: "#a78bfa" },
  { method: "POST", path: "/api/bureau/protect",   color: "#f472b6" },
  { method: "POST", path: "/api/planet/submit",    color: "#86efac" },
  { method: "GET",  path: "/api/qtrade/accounts",  color: "#fb7185" },
  { method: "POST", path: "/api/quantum-shield/derive", color: "#5eead4" },
];

export default function DevelopersOg() {
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
            "radial-gradient(circle at 25% 30%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #020617 0%, #0c4a6e 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Developers
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
            <span>Build on the</span>
            <span style={{ color: "#5eead4" }}>Trust OS.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            6 REST APIs · TypeScript SDKs · HMAC-signed webhooks with retry ·
            sandbox keys · OpenAPI 3.0. Authenticate once, ship across the whole stack.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {ENDPOINTS.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#020617",
                    background: e.color,
                    padding: "3px 8px",
                    borderRadius: 4,
                    letterSpacing: 1,
                    minWidth: 50,
                    textAlign: "center",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  {e.method}
                </div>
                <div style={{ color: "#e2e8f0", display: "flex" }}>{e.path}</div>
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
          <div style={{ display: "flex" }}>aevion.app/developers</div>
          <div style={{ color: "#5eead4", display: "flex" }}>REST · SDK · webhook · sandbox</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
