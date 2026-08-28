import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION QVENTURE — Разбор бизнеса по восьми факторам";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка модуля.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит, а
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует, и ссылка приходит с пустым местом.
 *
 * На странице сказано «fund-grade due diligence in seconds». В карточку это не выношу: сравнение с фондами непроверяемо, а прозрачность оценки — проверяема и есть на экране.
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
          AEVION QVENTURE
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05 }}>
            Разбор бизнеса по восьми факторам
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Прозрачная оценка от 0 до 100: видно, из чего она сложилась и что тянет вниз.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/qventure</div>
        </div>
      </div>
    ),
    size,
  );
}
