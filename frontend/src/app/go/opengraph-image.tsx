import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION — что почитать и попробовать";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * /go — посадочная для холодного трафика: на неё ведут ролики и ссылки в
 * описаниях. Своей карточки у неё не было, отдавалась общая картинка сайта, и
 * пересланная ссылка выглядела так же, как любая другая страница AEVION.
 *
 * Здесь важнее всего назвать ЖАНР, а не бренд: человек по ссылке из ролика ещё
 * не знает, кто мы, и решает за секунду, стоит ли открывать.
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
          <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.05 }}>
            Что почитать и попробовать
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Разбираем долголетие и привычки честно: с оценкой доказательности
            у каждого пункта — включая то, что переоценено.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>Бесплатный инструмент</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>Протоколы в PDF</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/go</div>
        </div>
      </div>
    ),
    size,
  );
}
