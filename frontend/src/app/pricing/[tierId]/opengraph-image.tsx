import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Tier";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_DATA: Record<string, { name: string; price: string; tagline: string; gradient: string }> = {
  free: {
    name: "Free",
    price: "$0",
    tagline: "Старт без барьеров",
    gradient: "linear-gradient(135deg, #475569, #94a3b8)",
  },
  pro: {
    name: "Pro",
    price: "$19",
    tagline: "Для индивидуальных создателей",
    gradient: "linear-gradient(135deg, #0d9488, #0ea5e9)",
  },
  business: {
    name: "Business",
    price: "$99",
    tagline: "Для команд и студий",
    gradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    tagline: "Для корпораций и госсектора",
    gradient: "linear-gradient(135deg, #0f172a, #1e293b)",
  },
};

export default async function Image({ params }: { params: Promise<{ tierId: string }> }) {
  const { tierId } = await params;
  const tier = TIER_DATA[tierId] ?? TIER_DATA.pro;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: tier.gradient,
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "rgba(255,255,255,0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>AEVION</span>
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "6px 14px",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 999,
              color: "#fff",
            }}
          >
            TIER · {tier.name.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <h1
            style={{
              fontSize: 156,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.05em",
              lineHeight: 0.9,
            }}
          >
            {tier.name}
          </h1>
          <p
            style={{
              fontSize: 32,
              opacity: 0.92,
              margin: 0,
              marginTop: 12,
              maxWidth: 800,
            }}
          >
            {tier.tagline}
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, opacity: 0.7, fontWeight: 700, letterSpacing: "0.08em" }}>ОТ</span>
            <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {tier.price}
              {tier.price !== "Custom" && (
                <span style={{ fontSize: 32, opacity: 0.7, marginLeft: 8 }}>/мес</span>
              )}
            </span>
          </div>
          <div style={{ fontSize: 16, opacity: 0.7 }}>aevion.io/pricing/{tierId}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
