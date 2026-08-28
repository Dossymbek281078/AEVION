import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION QRENEW — Биологический возраст по анализам";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка модуля.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит, а
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует, и ссылка приходит с пустым местом.
 *
 * Методику называем прямо — PhenoAge. Это проверяемое утверждение: читатель может свериться с публикацией, а не поверить на слово.
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
          AEVION QRENEW
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05 }}>
            Биологический возраст по анализам
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Расчёт PhenoAge по показателям крови: не гадание по самочувствию, а формула на ваших цифрах.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/qrenew</div>
        </div>
      </div>
    ),
    size,
  );
}
