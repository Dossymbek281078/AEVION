import { ImageResponse } from "next/og";
import { PLANET_BASE_MONTHLY, TERM_NAME, TERM_TIERS, termPricePerMonth } from "@/lib/termPricing";

export const runtime = "edge";
export const alt = "AEVION — Full tier × modules matrix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0ea5e9 130%)",
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
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
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
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              color: "#94a3b8",
            }}
          >
            FULL FEATURE MATRIX
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#5eead4",
              marginBottom: 12,
            }}
          >
            ВСЕ МОДУЛИ × ВСЕ СРОКИ
          </div>
          <h1
            style={{
              fontSize: 84,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            Полное сравнение тарифов
          </h1>
          <p
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              margin: 0,
              marginTop: 20,
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Любой платный срок открывает всю планету. Цена за месяц — чем длиннее срок, тем дешевле.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {/* Лестница берётся из lib/termPricing.ts, а не вписывается руками: карточку
                никто не открывает заново при смене цен, и здесь до 15.09.2026 жили
                $19/$29/$49/$149 — лестница, которой уже не было. Копия termPricing
                сверяется с бэкендом сторожем termPricingMatchesBackend. */}
            <Tier name="FREE" price="$0" highlight={false} />
            {TERM_TIERS.map((term) => (
              <Tier
                key={term}
                name={TERM_NAME[term].toUpperCase()}
                price={`$${termPricePerMonth(PLANET_BASE_MONTHLY, term)}`}
                highlight={term === "max"}
              />
            ))}
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.app/pricing/compare</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Tier({ name, price, highlight }: { name: string; price: string; highlight: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px 16px",
        borderRadius: 12,
        background: highlight ? "linear-gradient(135deg, #0d9488, #0ea5e9)" : "rgba(255,255,255,0.06)",
        border: highlight ? "none" : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: highlight ? "#fff" : "#94a3b8", letterSpacing: "0.06em" }}>
        {name}
      </span>
      <span style={{ fontSize: 22, fontWeight: 900, marginTop: 2, color: "#fff", letterSpacing: "-0.02em" }}>
        {price}
      </span>
    </div>
  );
}
