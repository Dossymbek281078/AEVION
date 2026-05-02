import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Get started with AEVION Bank — Five steps, sixty seconds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STEPS = [
  { n: "1", label: "Sign in", color: "#5eead4" },
  { n: "2", label: "Top up", color: "#0ea5e9" },
  { n: "3", label: "Send", color: "#a78bfa" },
  { n: "4", label: "Save", color: "#fbbf24" },
  { n: "5", label: "Trust", color: "#d97706" },
];

export default function OnboardingOg() {
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
            "radial-gradient(circle at 30% 20%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
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
          AEVION · Get started
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
            <span>Five steps.</span>
            <span style={{ color: "#5eead4" }}>Sixty seconds.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Sign in, top up, send, save, build Trust Score. Each step has a deep-link
            to the relevant surface. Progress saved on this device.
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 8, alignItems: "center" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: `${s.color}26`,
                    border: `2px solid ${s.color}`,
                    color: s.color,
                    fontSize: 28,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#fff",
                    display: "flex",
                  }}
                >
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden
                    style={{
                      width: 14,
                      height: 2,
                      background: "rgba(255,255,255,0.20)",
                      marginLeft: 4,
                      display: "flex",
                    }}
                  />
                )}
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
          <div style={{ display: "flex" }}>aevion.app/bank/onboarding</div>
          <div style={{ color: "#5eead4", display: "flex" }}>EN · RU · KK</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
