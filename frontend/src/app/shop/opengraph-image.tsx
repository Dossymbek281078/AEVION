import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Витрина AEVION — протоколы, книги, доступ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка витрины.
 *
 * ЗАЧЕМ. У /shop своей карточки не было — отдавалась общая картинка сайта, и
 * пересланная ссылка на витрину выглядела так же, как ссылка на любую другую
 * страницу AEVION. Для страницы, где человек выбирает и платит, это потеря:
 * карточка должна называть, ЧТО тут продаётся, а не бренд.
 *
 * Ничего не обещаем сверх того, что на витрине есть: протоколы, книги и
 * доступ к модулям. Цену в карточку не выносим — она меняется, а картинка
 * кэшируется на стороне мессенджера и живёт дольше правки.
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
            Протоколы, книги, доступ
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Всё, что AEVION продаёт, — на одной странице. С пометкой, насколько
            доказано то, что внутри.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>Разовая покупка</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>Подписка</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/shop</div>
        </div>
      </div>
    ),
    size,
  );
}
