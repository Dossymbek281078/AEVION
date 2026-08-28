import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION QBUILD — Стройка: проекты, вакансии, подряд";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка страницы.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит, а
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует. Сплошная проверка 54 страниц нашла восемнадцать таких.
 *
 * Слова «маркетплейс» в карточке нет намеренно: оно ничего не говорит человеку, который ищет подряд или работу. Названо то, что он ищет.
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
          AEVION QBUILD
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05 }}>
            Стройка: проекты, вакансии, подряд
          </div>
          <div style={{ fontSize: 31, lineHeight: 1.4, color: "#374151" }}>
            Площадка, где заказчик и исполнитель находят друг друга напрямую.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/build</div>
        </div>
      </div>
    ),
    size,
  );
}
