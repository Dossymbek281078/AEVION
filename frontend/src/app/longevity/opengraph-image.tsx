import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Протокол долголетия — измерь, воздействуй, перемерь";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Своя карточка для пересылки ссылки.
 *
 * До 19.08.2026 страница отдавала общую картинку сайта — ту же, что и все
 * остальные (проверено по совпадению хеша у /longevity, /go и /apps). При
 * пересылке ссылки на бесплатный инструмент человек видел обезличенную карточку
 * AEVION и не понимал, что ему прислали.
 *
 * Текст намеренно без обещаний результата: тематика здоровья — ограниченная
 * категория, а сама страница честно сортирует вмешательства по доказательности.
 * Обещать «продлить жизнь» здесь нельзя ни по правилам площадок, ни по совести.
 * Поэтому на карточке — то, что человек действительно получит: разбор с
 * градацией и честное «включая переоценённое».
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
          background: "linear-gradient(135deg, #0f172a 0%, #14532d 60%, #0d9488 130%)",
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
              background: "linear-gradient(135deg, #0d9488, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 26, letterSpacing: 4, opacity: 0.85 }}>AEVION · ДОЛГОЛЕТИЕ</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>
            Измерь → воздействуй → перемерь
          </div>
          <div style={{ fontSize: 32, opacity: 0.9, lineHeight: 1.35 }}>
            Какие маркеры сдать и что из добавок и нагрузок реально доказано.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {["A — доказано", "B — есть RCT", "C — слабо", "включая переоценённое"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 24,
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.35)",
                display: "flex",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
