import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION API — Запросы к каталогу в браузере";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка страницы.
 *
 * ЗАЧЕМ. Замер 28.08.2026: тег `twitter:card: summary_large_image` стоит, а
 * `og:image` нет — карточка обещает соцсети большое изображение, которого не
 * существует. Сплошная проверка 54 страниц нашла восемнадцать таких.
 *
 * «Без ключа» проверяемо одним заходом: страница открывается и отвечает. Ничего про полноту API не пишу — её я не мерил.
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
          AEVION API
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05 }}>
            Запросы к каталогу в браузере
          </div>
          <div style={{ fontSize: 31, lineHeight: 1.4, color: "#374151" }}>
            Собрать запрос фильтрами и сразу увидеть ответ — без ключа и без установки клиента.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>aevion.app/api-explorer</div>
        </div>
      </div>
    ),
    size,
  );
}
