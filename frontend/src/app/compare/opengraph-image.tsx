import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION — чем отличаемся и где слабее";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка страницы сравнения.
 *
 * ЗАЧЕМ. Замер 28.08.2026: у страницы стоит
 * `twitter:card: summary_large_image`, а `og:image` нет — карточка обещает
 * соцсети большое изображение, которого не существует. Третий такой случай за
 * день; всего на платформе их нашлось семь.
 *
 * ЧТО НАПИСАНО. Взято с самой страницы, а не придумано: её заголовок —
 * «Чем отличаемся и где слабее», и первым абзацем она предупреждает, что
 * таблица «мы против них» — лёгкий способ незаметно перейти от фактов к
 * маркетингу. Именно признание слабых мест и есть то, чем эта страница
 * отличается от обычного сравнения, поэтому оно и вынесено в карточку.
 *
 * Никаких «лучше конкурентов» здесь нет и быть не должно — это ровно та
 * подмена, от которой страница предостерегает.
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
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>
            Чем отличаемся и где слабее
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Сравнение с аналогами, где названы и наши слабые места. Таблица
            «мы против них» слишком легко превращается в маркетинг.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>Без «мы лучше»</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/compare</div>
        </div>
      </div>
    ),
    size,
  );
}
