import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Circles — Group payments inside group chats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SAMPLE_NAMES = ["Alex", "Mira", "Jin", "Lena", "Tom"];

export default function CirclesOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 64,
          gap: 48,
          background:
            "radial-gradient(circle at 80% 30%, rgba(124,58,237,0.30), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 660 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#a78bfa",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Circles
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Group payments,</span>
            <span style={{ color: "#a78bfa" }}>inside group chats.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", lineHeight: 1.45, display: "flex" }}>
            Request, settle, split — without screenshots or IOU spreadsheets.
            Each circle is a small chat with embedded payment actions.
          </div>
        </div>

        {/* Stylised circle preview */}
        <div
          style={{
            width: 320,
            height: 320,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              border: "2px solid rgba(167,139,250,0.30)",
              display: "flex",
            }}
          />
          {/* Inner ring */}
          <div
            style={{
              position: "absolute",
              inset: 30,
              borderRadius: 999,
              border: "2px solid rgba(167,139,250,0.50)",
              display: "flex",
            }}
          />
          {/* Center glyph */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 999,
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.40), rgba(13,148,136,0.20))",
              border: "1px solid rgba(167,139,250,0.50)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 900,
              color: "#a78bfa",
            }}
          >
            ◌
          </div>
          {/* Member dots arranged around */}
          {SAMPLE_NAMES.map((name, i) => {
            const angle = (i / SAMPLE_NAMES.length) * Math.PI * 2 - Math.PI / 2;
            const cx = 160 + Math.cos(angle) * 132;
            const cy = 160 + Math.sin(angle) * 132;
            return (
              <div
                key={name}
                style={{
                  position: "absolute",
                  left: cx - 32,
                  top: cy - 32,
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background:
                    "linear-gradient(135deg, #6d28d9, #312e81)",
                  border: "2px solid rgba(167,139,250,0.60)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: 1,
                }}
              >
                {name[0]}
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...size },
  );
}
