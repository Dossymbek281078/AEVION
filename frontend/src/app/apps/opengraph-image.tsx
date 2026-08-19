import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Каталог продуктов AEVION";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Каталог — страница, которую пересылают чаще прочих: на неё ссылаются, когда
 * объясняют, что такое AEVION. До 19.08.2026 она отдавала общую картинку сайта,
 * ту же, что /go и /longevity (проверено по совпадению хеша в og:image).
 *
 * Числа на карточке намеренно нет. Счётчик продуктов меняется, а карточка
 * кешируется у площадок надолго — устаревшее число хуже отсутствующего.
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0d9488 130%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 26, letterSpacing: 4, opacity: 0.85 }}>AEVION · КАТАЛОГ</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>
            Продукты, которые уже работают
          </div>
          <div style={{ fontSize: 30, opacity: 0.9, lineHeight: 1.35 }}>
            Бюро авторства, движок ИИ, платежи, публикатор TikTok, шахматы,
            сметный тренажёр. У каждого — цена и бесплатный тариф.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 25, opacity: 0.75 }}>aevion.app/apps</div>
      </div>
    ),
    size,
  );
}
