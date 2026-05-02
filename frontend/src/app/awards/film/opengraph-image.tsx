import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Film Awards — premium for AI and digital cinema";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function FilmAwardsOg() {
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
            "radial-gradient(circle at 70% 30%, rgba(244,114,182,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#f472b6", textTransform: "uppercase", display: "flex" }}>
          AEVION · Film Awards
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
            <span>The first credible</span>
            <span style={{ color: "#f472b6" }}>AI-film festival.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            No Cannes, no Oscar, no clear path for AI cinema. AEVION ships the first
            certification track — QRight authorship, Planet validators, AEC payouts.
          </div>
          {/* Cinema-strip frames */}
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  width: 160,
                  height: 100,
                  borderRadius: 10,
                  background:
                    i === 3
                      ? "linear-gradient(135deg, #f472b6, #db2777)"
                      : "rgba(244,114,182,0.10)",
                  border: i === 3 ? "2px solid #f472b6" : "1px solid rgba(244,114,182,0.30)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 900,
                  color: i === 3 ? "#0f172a" : "#f472b6",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {`#${String(i).padStart(2, "0")}`}
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
          <div style={{ display: "flex" }}>aevion.app/awards/film</div>
          <div style={{ color: "#f472b6", display: "flex" }}>QRight · Planet · Bank</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
