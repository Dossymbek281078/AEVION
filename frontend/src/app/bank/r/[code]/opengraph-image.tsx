import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "You're invited to AEVION";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ReferralOg({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: { from?: string; tier?: string };
}) {
  const code = (params.code ?? "").slice(0, 16).toUpperCase();
  const from = (searchParams?.from ?? "").slice(0, 24);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #1e1b4b 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            AEVION · Bank
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -3,
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>You're invited to</span>
            <span style={{ color: "#fbbf24" }}>AEVION</span>
          </div>
          <div style={{ fontSize: 28, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.4, display: "flex" }}>
            {from
              ? `${from} sent you this link · +5 AEC bonus on your first top-up`
              : "Sign up via this link · +5 AEC bonus on your first top-up"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{
              padding: "16px 24px",
              borderRadius: 14,
              background: "rgba(94,234,212,0.10)",
              border: "1px solid rgba(94,234,212,0.40)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, color: "#5eead4", letterSpacing: 3, textTransform: "uppercase", fontWeight: 800, display: "flex" }}>
              Referral code
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "ui-monospace, monospace", letterSpacing: 2, display: "flex" }}>{code}</div>
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: 2,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            aevion.app/bank/r/{code}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
