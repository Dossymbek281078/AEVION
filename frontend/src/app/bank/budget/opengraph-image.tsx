import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Budget — Monthly caps with real-time pace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { label: "Subscriptions", color: "#d97706", spent: 78, cap: 100, status: "ok" as const },
  { label: "Tips & micro", color: "#db2777", spent: 92, cap: 80, status: "breach" as const },
  { label: "Contacts", color: "#0ea5e9", spent: 60, cap: 75, status: "warning" as const },
  { label: "Other", color: "#475569", spent: 30, cap: 60, status: "ok" as const },
];

const STATUS_COLOR = {
  ok: "#5eead4",
  warning: "#fbbf24",
  breach: "#f87171",
};

export default function BudgetOg() {
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
            "radial-gradient(circle at 80% 30%, rgba(217,119,6,0.30), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#fbbf24",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          AEVION · Budget
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
            <span>Monthly caps,</span>
            <span style={{ color: "#fbbf24" }}>real-time pace.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Set a limit per category. Watch spending pace against the day of month.
            Catch breaches before the calendar does — all computed locally.
          </div>

          {/* Sample category bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 920 }}>
            {ROWS.map((r) => {
              const ratio = Math.min(1, r.spent / r.cap);
              const over = r.spent > r.cap;
              return (
                <div
                  key={r.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      width: 130,
                      fontWeight: 700,
                      color: "#fff",
                      display: "flex",
                    }}
                  >
                    {r.label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 18,
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: `${ratio * 100}%`,
                        background: over ? "#f87171" : r.color,
                        display: "flex",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 100,
                      fontWeight: 800,
                      color: STATUS_COLOR[r.status],
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      fontSize: 13,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    {r.status}
                  </div>
                </div>
              );
            })}
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
          <div style={{ display: "flex" }}>aevion.app/bank/budget</div>
          <div style={{ color: "#fbbf24", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
