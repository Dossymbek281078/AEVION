import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "AEVION DevHub — опишите приложение словами, DevHub соберёт и опубликует";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// До 13.09.2026 у /devhub не было og:image ВОВСЕ: ссылка в мессенджере
// показывалась голым текстом. Замер того дня по восьми модулям волны запуска:
// пять отдавали PNG с нашего домена, два — SVG с сырого домена Railway,
// а devhub не отдавал ничего.
//
// Текст карточки повторяет обещание страницы дословно и не добавляет своего:
// карточка — это первое, что видит человек, и расхождение с содержимым
// страницы читается как обман, даже если оба текста по отдельности верны.
const CHIPS = ["опишите словами", "код и страницы", "публикация"];

export default function DevHubOg() {
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
            "radial-gradient(1000px 460px at 82% -10%, rgba(34,197,94,0.24), transparent 60%), linear-gradient(140deg, #0b1220 0%, #0f1f1b 100%)",
          color: "#eaf1fb",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#4ade80",
            textTransform: "uppercase",
          }}
        >
          AEVION · DevHub
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.05 }}>
            Приложение по описанию
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: "#b9c7db", maxWidth: 960 }}>
            «Сделай мне…» вместо конструктора: DevHub соберёт проект, покажет
            страницы и опубликует. Начать можно без регистрации.
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
                border: "1px solid rgba(74,222,128,0.45)",
                color: "#d8f5e3",
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
