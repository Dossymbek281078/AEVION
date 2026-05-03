import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank — Explore every wallet surface";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ExploreOg() {
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
          background: "linear-gradient(135deg, #f0fdfa 0%, #e0e7ff 50%, #fef3c7 100%)",
          color: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#0d9488",
              textTransform: "uppercase",
            }}
          >
            AEVION · Bank
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Explore the wallet</span>
            <span style={{ color: "#0d9488" }}>11 surfaces · one trust graph</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 1080 }}>
            {[
              "Inbox",
              "Statement",
              "Leaderboard",
              "Trust Badge",
              "Public profile",
              "Scan to pay",
              "Gift pickup",
              "Referral landing",
              "API reference",
            ].map((label) => (
              <div
                key={label}
                style={{
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.04)",
                  border: "1px solid rgba(15,23,42,0.10)",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#0f172a",
                  display: "flex",
                }}
              >
                {label}
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
            color: "#475569",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>aevion.app/bank/explore</div>
          <div style={{ color: "#0d9488", display: "flex" }}>multilingual · live MVP</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
