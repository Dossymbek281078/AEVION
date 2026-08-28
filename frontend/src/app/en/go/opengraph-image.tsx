import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION — the free longevity protocol and the book behind the videos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка для /en/go.
 *
 * ЗАЧЕМ. У русской /go своя карточка есть, у английской не было вовсе —
 * `og:image` отсутствовал, и пересланная ссылка приходила без картинки
 * (замер на проде 28.08.2026). Для трафика из роликов это заметная потеря:
 * карточка без картинки в ленте мессенджера почти не кликается.
 *
 * Текст называет ЖАНР, а не бренд: человек по ссылке из ролика ещё не знает,
 * кто мы, и решает за секунду. И обещает ровно то, что на странице есть —
 * бесплатный разбор первым блоком, книга и подписка ниже.
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
            What to read and try
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Longevity and habits, graded honestly — every item marked by how well
            it is evidenced, including the popular ones marked overrated.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>Free protocol</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>No signup</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/en/go</div>
        </div>
      </div>
    ),
    size,
  );
}
