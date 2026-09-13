import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "AEVION Bureau — публичный реестр проверенных авторов и организаций";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Тот же разбор, что у /qright: прежний og:image был SVG на сыром домене
// Railway, а SVG как превью не рисует ни одна крупная площадка — ссылка
// уходила в мессенджер голой. Здесь честный PNG с нашего домена.
//
// Чего на карточке нет намеренно: числа реестра. Они меняются ежедневно, а
// площадки кэшируют картинку надолго — обещание устареет раньше, чем его
// увидят.
const CHIPS = ["проверенные авторы", "организации", "заверенные сертификаты"];

export default function BureauOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(1000px 460px at 78% -8%, rgba(129,140,248,0.28), transparent 60%), linear-gradient(140deg, #0b1220 0%, #141a2e 100%)",
          color: "#eaf1fb",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#a5b4fc",
            textTransform: "uppercase",
          }}
        >
          AEVION · Bureau
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.05 }}>
            Публичный реестр
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: "#b9c7db", maxWidth: 960 }}>
            Кто автор и кто организация — записано публично, ссылку можно вставить
            в договор и проверить со стороны.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {CHIPS.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                fontSize: 24,
                padding: "12px 22px",
                borderRadius: 999,
                border: "1px solid rgba(165,180,252,0.45)",
                color: "#dfe3fb",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
