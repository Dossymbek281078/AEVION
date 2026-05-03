import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank — Public profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLOR: Record<string, string> = {
  new: "#94a3b8",
  growing: "#0ea5e9",
  trusted: "#0d9488",
  elite: "#fbbf24",
  starter: "#64748b",
  advocate: "#0d9488",
  ambassador: "#7c3aed",
  "top-referrer": "#d97706",
};

const TIER_LABEL: Record<string, string> = {
  new: "Newcomer",
  growing: "Growing",
  trusted: "Trusted",
  elite: "Elite",
  starter: "Starter",
  advocate: "Advocate",
  ambassador: "Ambassador",
  "top-referrer": "Top referrer",
};

function gradientFor(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  const a = (h >>> 0) % 360;
  const b = (a + 60) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 55%), hsl(${b} 70% 45%))`;
}

function initialsOf(s: string): string {
  const cleaned = s.replace(/[^A-Za-z0-9 ]/g, "").trim();
  if (!cleaned) return s.slice(0, 2).toUpperCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ShareProfileOg({
  params,
  searchParams,
}: {
  params: { handle: string };
  searchParams?: { name?: string; score?: string; tier?: string; bio?: string };
}) {
  const handle = (params.handle ?? "anon").slice(0, 24);
  const name = (searchParams?.name ?? "").slice(0, 36) || handle;
  const score = parseFloat(searchParams?.score ?? "");
  const scoreShown = Number.isFinite(score) ? Math.round(Math.max(0, Math.min(1, score)) * 100) : null;
  const tier = (searchParams?.tier ?? "").toLowerCase();
  const tierColor = TIER_COLOR[tier] ?? "#cbd5e1";
  const tierLabel = TIER_LABEL[tier] ?? "AEVION member";
  const bio = (searchParams?.bio ?? "").slice(0, 160);

  const avatarBg = gradientFor(name);
  const initials = initialsOf(name);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          padding: 64,
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
          alignItems: "center",
          gap: 56,
        }}
      >
        {/* Avatar */}
        <div
          aria-hidden="true"
          style={{
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: avatarBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: -4,
            boxShadow: "0 30px 60px rgba(0,0,0,0.40)",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Profile
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: -1.5,
              lineHeight: 1.05,
              display: "flex",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: "ui-monospace, monospace",
              color: "#94a3b8",
              display: "flex",
            }}
          >
            @{handle}
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8 }}>
            {scoreShown != null ? (
              <div
                style={{
                  padding: "16px 22px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, display: "flex" }}>
                  Trust
                </div>
                <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, marginTop: 4, display: "flex" }}>{scoreShown}</div>
              </div>
            ) : null}
            <div
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                background: `${tierColor}26`,
                color: tierColor,
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {tierLabel}
            </div>
          </div>

          {bio ? (
            <div
              style={{
                fontSize: 20,
                color: "#cbd5e1",
                marginTop: 10,
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              {bio}
            </div>
          ) : null}

          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginTop: 6,
              display: "flex",
            }}
          >
            aevion.app/bank/share/{handle}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
