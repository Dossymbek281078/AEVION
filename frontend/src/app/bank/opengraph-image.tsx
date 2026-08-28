import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION BANK — Кошелёк и роялти в одном месте";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка модуля.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит, а
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует. Всего таких страниц на платформе нашлось двенадцать из 29.
 *
 * Про кредит в карточке ничего нет, хотя на странице он упомянут: это обещание требует проверки, которую я не делал, а карточку увидят те, кому переслали ссылку.
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
          AEVION BANK
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05 }}>
            Кошелёк и роялти в одном месте
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Начисления за использование прав приходят автоматически, накопления и регулярные платежи — рядом.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/bank</div>
        </div>
      </div>
    ),
    size,
  );
}
