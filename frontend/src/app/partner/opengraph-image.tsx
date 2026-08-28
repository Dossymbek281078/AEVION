import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION — Innovation Partnership";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка страницы партнёрства.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит,
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует. Ссылка на предложение о партнёрстве приходила с пустым местом.
 *
 * ПОЧЕМУ БЕЗ ЦИФР. На странице названы конкретная сумма аванса и доли. Это
 * коммерческое предложение основателя, и оно может измениться — а карточка
 * кэшируется на стороне мессенджера и живёт дольше правки. Устаревшая сумма
 * на картинке хуже отсутствующей картинки: её увидят те, кому ссылку
 * переслали, и обсуждать будут её.
 *
 * Поэтому в карточке только суть, которая от цифр не зависит: это
 * партнёрство, а не покупка. Подробности — на самой странице.
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
          AEVION
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05 }}>
            Innovation Partnership
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Партнёрство, а не покупка: вы получаете двигатель идей, а не снимок
            продукта на сегодня. Условия — на странице.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/partner</div>
        </div>
      </div>
    ),
    size,
  );
}
