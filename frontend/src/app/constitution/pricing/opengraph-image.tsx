import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Constitution — тарифы";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка страницы тарифов Конституции.
 *
 * ЗАЧЕМ. Замер на проде 28.08.2026: у страницы есть `og:title`,
 * `og:description` и `twitter:card: summary_large_image` — но **нет
 * `og:image`**. Это хуже, чем просто отсутствие картинки: карточка ОБЕЩАЕТ
 * соцсети большое изображение, которого нет, и ссылка приходит с пустым
 * местом там, где должна быть картинка.
 *
 * Цены в картинку не выносим намеренно. Они меняются, а карточка кэшируется
 * на стороне мессенджера и живёт дольше правки — устаревшая цена в картинке
 * хуже отсутствующей.
 */
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
          background: "#faf9f6",
          color: "#111827",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#b45309" }}>
          AEVION CONSTITUTION
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>
            Тарифы
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Бесплатный доступ к разбору, платные — к выгрузкам и командной
            работе. Что входит в каждый — на странице.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>Free</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>Pro</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>Team</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/constitution/pricing</div>
        </div>
      </div>
    ),
    size,
  );
}
