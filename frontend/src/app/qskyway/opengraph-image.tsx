import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QSkyway — navigation layer for the urban sky: 3D air taxi corridors routed against real FAA airspace ceilings and live METAR wind";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card is the first thing anyone following the shared link sees, so it
// advertises what is REAL rather than what is merely built: the two chips that
// name an outside authority (FAA, METAR) carry the weight, and the illustrative
// no-fly zones deliberately no longer appear here as if they were on par.
const CHIPS = ["FAA airspace ceilings", "live METAR wind", "4D routing", "3D corridors", "height provenance", "QRight slots", "Ed25519-signed"];

export default function QSkywayOg() {
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
            "radial-gradient(1000px 460px at 78% -8%, rgba(34,211,238,0.28), transparent 60%), radial-gradient(760px 360px at 8% 0%, rgba(167,139,250,0.22), transparent 55%), linear-gradient(135deg, #05070d 0%, #0b1220 60%, #05070d 100%)",
          color: "#eaf1fb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#22d3ee", textTransform: "uppercase", display: "flex" }}>
          AEVION · QSkyway
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              lineHeight: 1.03,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Navigation layer</span>
            <span style={{ color: "#22d3ee" }}>for the urban sky</span>
          </div>
          <div style={{ fontSize: 26, color: "#c3d0e2", maxWidth: 1000, lineHeight: 1.4, display: "flex" }}>
            3D air corridors for air taxis on real buildings in Astana, NYC &amp; Tokyo — routed against
            the FAA&rsquo;s published airspace ceilings and live METAR wind, not illustrations.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {CHIPS.map((m) => (
              <div
                key={m}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(34,211,238,0.32)",
                  background: "rgba(34,211,238,0.08)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#d6f6ff",
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
            fontSize: 17,
            fontWeight: 700,
            color: "#93a3ba",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>aevion.vercel.app/qskyway</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>eVTOL · urban air mobility</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
