import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Billing Calendar — Upcoming charges, heat-mapped";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEAT = [
  [0, 0, 0.4, 0, 0, 0.7, 0],
  [0.2, 0, 0, 0.9, 0, 0, 0],
  [0, 0.5, 0, 0, 0, 0.3, 0],
  [0, 0, 0.6, 0, 0.2, 0, 0],
  [0, 0.8, 0, 0, 0, 0, 0.4],
];

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          padding: 64,
          background:
            "radial-gradient(circle at 25% 50%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: 40,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Calendar
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                fontSize: 80,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: -2,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>30 days,</span>
              <span style={{ color: "#5eead4" }}>heat-mapped.</span>
            </div>

            <div style={{ fontSize: 20, color: "#cbd5e1", lineHeight: 1.45, display: "flex" }}>
              Every upcoming recurring charge plotted on a calendar.
              Spot the heavy days before they arrive.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 14,
              fontWeight: 700,
              color: "#94a3b8",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            aevion.app/bank/calendar
          </div>
        </div>

        {/* Heat-mapped calendar mock */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 24,
            borderRadius: 18,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(94,234,212,0.18)",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {DOW.map((d, i) => (
              <div
                key={i}
                style={{
                  width: 56,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#5eead4",
                  textAlign: "center",
                  letterSpacing: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {d}
              </div>
            ))}
          </div>
          {HEAT.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 6 }}>
              {row.map((v, ci) => (
                <div
                  key={ci}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    background:
                      v > 0
                        ? `rgba(94,234,212,${0.15 + v * 0.7})`
                        : "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-start",
                    padding: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    color: v > 0.5 ? "#0f172a" : "#94a3b8",
                  }}
                >
                  {ri * 7 + ci + 1}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
