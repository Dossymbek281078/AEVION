import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QMelanin — пигмент и седина: что доказано, а что переоценено";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Своя карточка для пересылки ссылки.
 *
 * Замер 07.10.2026 на проде: у /qmelanin не было НИ og:image, НИ
 * twitter:image, тогда как у соседей по каталогу они есть — /longevity,
 * /qrenew, /qskyway, /devhub, /cyberchess отдают свой
 * `<страница>/opengraph-image`. На /qmelanin ведут семь роликов, и в ленте
 * мессенджера карточка без изображения почти не кликается: трафик доходит
 * до ссылки и теряется на последнем шаге.
 *
 * Почему пробел выжил: сторож funnelOgImages проверяет карточку у страниц
 * из списка FUNNEL, который ведётся руками, а qmelanin в него не внесли.
 * Внёс вместе с этой карточкой — иначе следующая такая страница повторит
 * историю.
 *
 * Текст намеренно БЕЗ обещаний результата. Тема здоровья — особая
 * категория, и сама страница заявлена честно: её og:title дословно
 * «QMelanin — пигмент и седина без обещаний». Карточка обязана говорить то
 * же самое: на ней разбор с градацией доказательности, а не «верните цвет
 * волос».
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
          background: "linear-gradient(135deg, #0f172a 0%, #3f2d1c 55%, #92400e 130%)",
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
              background: "linear-gradient(135deg, #92400e, #d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 26, letterSpacing: 4, opacity: 0.85 }}>AEVION · QMELANIN</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>
            Пигмент и седина — без обещаний
          </div>
          <div style={{ fontSize: 32, opacity: 0.9, lineHeight: 1.35 }}>
            Почему седеет волос, при чём тут медь, цинк и их соотношение — и что из
            этого действительно показано исследованиями.
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
