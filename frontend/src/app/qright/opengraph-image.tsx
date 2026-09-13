import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "QRight — реестр авторства: отпечаток работы, время и подпись, проверяемые кем угодно";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// До 13.09.2026 предпросмотр ссылки на /qright брался из SVG на СЫРОМ домене
// Railway. Оба свойства плохи: SVG как og:image не рисует НИ ОДНА крупная
// площадка (X, Facebook, WhatsApp, Slack, Discord, LinkedIn — скрапер молча
// показывает голую ссылку), а сырой домен провайдера меняется и уводит превью
// в никуда. Замер 13.09 на живом сайте: /qright и /bureau отдавали
// image/svg+xml с aevion-production-*.up.railway.app, остальные пять модулей
// волны — честный image/png с aevion.app.
//
// Числа на карточку намеренно НЕ ставим: они устаревают в тот же день, а
// карточку кэшируют площадки. Обещаем только то, что не зависит от даты.
const CHIPS = ["отпечаток работы", "время и подпись", "проверка без нас"];

export default function QRightOg() {
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
            "radial-gradient(1000px 460px at 80% -10%, rgba(56,189,248,0.26), transparent 60%), linear-gradient(140deg, #0b1220 0%, #0e1a2b 100%)",
          color: "#eaf1fb",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#38bdf8",
            textTransform: "uppercase",
          }}
        >
          AEVION · QRight
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.05 }}>
            Реестр авторства
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: "#b9c7db", maxWidth: 940 }}>
            Отпечаток работы, время и подпись — так, чтобы проверить мог кто угодно,
            не спрашивая нас.
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
                border: "1px solid rgba(56,189,248,0.45)",
                color: "#cfe6fb",
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
