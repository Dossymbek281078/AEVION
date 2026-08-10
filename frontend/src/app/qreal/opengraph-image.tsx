import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QReal Studio — fully-alive AI video from a text brief (no actor, realism QC, provenance)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHIPS = ["no actor", "direct engines", "14-criterion realism QC", "$/s transparent", "film assembly", "AI mark built-in"];

// Светлый «газетный» стиль модуля: бумага, serif-настроение, teal/red акценты.
export default function QRealOg() {
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
          background: "linear-gradient(180deg, #faf8f3 0%, #f3efe6 100%)",
          color: "#171717",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#0f766e", textTransform: "uppercase", display: "flex" }}>
            AEVION · QReal Studio
          </div>
          <div style={{ fontSize: 18, color: "#b91c1c", fontWeight: 700, display: "flex" }}>
            realism is the product — deception is not
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
              borderTop: "4px solid #171717",
              paddingTop: 26,
            }}
          >
            <span>Fully-alive AI video</span>
            <span style={{ color: "#0f766e" }}>from a text brief</span>
          </div>
          <div style={{ fontSize: 26, color: "#404040", maxWidth: 1020, lineHeight: 1.45, display: "flex" }}>
            People, children, animals, nature and sound — no actor, no reference footage.
            Brief → AI storyboard → direct engines → realism QC → assembled film with a non-removable AI mark.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {CHIPS.map((m) => (
              <div
                key={m}
                style={{
                  padding: "8px 14px",
                  border: "1px solid rgba(15,118,110,0.45)",
                  background: "rgba(15,118,110,0.07)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#0f766e",
                  display: "flex",
                }}
              >
                {m}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, color: "#737373" }}>
          <div style={{ display: "flex" }}>aevion.app/qreal</div>
          <div style={{ display: "flex" }}>EU AI Act art. 50 · C2PA-style provenance · sha256</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
