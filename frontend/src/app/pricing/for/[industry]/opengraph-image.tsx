import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION for industry";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INDUSTRY_DATA: Record<string, { name: string; hero: string; gradient: string }> = {
  banks: {
    name: "Банки и финтех",
    hero: "Подпись, аудит и платежи в одной инфраструктуре",
    gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
  },
  startups: {
    name: "Стартапы",
    hero: "От идеи до защищённого продукта без юристов",
    gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)",
  },
  government: {
    name: "Госсектор",
    hero: "Цифровое государство без vendor lock-in",
    gradient: "linear-gradient(135deg, #065f46, #10b981)",
  },
  creators: {
    name: "Создатели контента",
    hero: "Защита авторства, AI-помощник, монетизация",
    gradient: "linear-gradient(135deg, #be185d, #ec4899)",
  },
  "law-firms": {
    name: "Юридические фирмы",
    hero: "Полный IP-контур клиента под одной подпиской",
    gradient: "linear-gradient(135deg, #92400e, #f59e0b)",
  },
};

export default async function Image({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const data = INDUSTRY_DATA[industry] ?? INDUSTRY_DATA.startups;

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
          background: data.gradient,
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
            INDUSTRY · {data.name.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.06em",
              opacity: 0.85,
              marginBottom: 16,
            }}
          >
            AEVION ДЛЯ {data.name.toUpperCase()}
          </div>
          <h1
            style={{
              fontSize: 76,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            {data.hero}
          </h1>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, opacity: 0.92 }}>
            27 модулей · единая подписка · открытое API
          </div>
          <div style={{ fontSize: 16, opacity: 0.7 }}>aevion.io/pricing/for/{industry}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
