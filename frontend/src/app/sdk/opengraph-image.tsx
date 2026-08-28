import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION SDK — TypeScript-клиент каталога";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка страницы.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит, а
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует. Сплошная проверка 39 страниц нашла четырнадцать таких.
 *
 * «Ноль зависимостей» и строгая типизация взяты с самой страницы и проверяемы установкой пакета — в отличие от оценок вроде «удобный» или «быстрый», которых тут нет.
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
          AEVION SDK
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>
            TypeScript-клиент каталога
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Строгая типизация и ноль зависимостей. Ставится из npm, работает с публичным API каталога.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/sdk</div>
        </div>
      </div>
    ),
    size,
  );
}
