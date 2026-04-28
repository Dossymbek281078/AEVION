import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Recurring Payments — Scheduled transfers on autopilot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FREQ_BARS = [
  { label: "Monthly", color: "#0d9488", pct: 52 },
  { label: "Weekly", color: "#0ea5e9", pct: 28 },
  { label: "Bi-weekly", color: "#6366f1", pct: 13 },
  { label: "Daily", color: "#d97706", pct: 7 },
];

export default function RecurringOg() {
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
            "radial-gradient(circle at 20% 60%, rgba(13,148,136,0.28), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
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
          AEVION · Recurring
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Scheduled transfers</span>
            <span style={{ color: "#5eead4" }}>on autopilot.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Daily · weekly · bi-weekly · monthly. Pause or cancel any time.
            Runs client-side every 30 s — no setup, no paperwork.
          </div>

          {/* Sample frequency bar */}
          <div
            style={{
              display: "flex",
              height: 38,
              borderRadius: 10,
              overflow: "hidden",
              background: "rgba(255,255,255,0.06)",
              maxWidth: 920,
            }}
          >
            {FREQ_BARS.map((s) => (
              <div
                key={s.label}
                style={{
                  width: `${s.pct}%`,
                  background: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(15,23,42,0.85)",
                }}
              >
                {s.pct}%
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {FREQ_BARS.map((s) => (
              <div
                key={s.label}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "#cbd5e1" }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: s.color,
                    display: "flex",
                  }}
                />
                <span style={{ fontWeight: 700, color: "#fff", display: "flex" }}>{s.label}</span>
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
          <div style={{ display: "flex" }}>aevion.app/bank/recurring</div>
          <div style={{ color: "#5eead4", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
