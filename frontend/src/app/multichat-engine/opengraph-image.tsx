import { ImageResponse } from "next/og";

export const runtime = "edge";
// 13.09.2026: подпись картинки переведена вслед за og:title и og:description
// (см. layout.tsx). У qright и qsign соседние alt уже по-русски — этот был
// последним английским из трёх. Названия ролей ВНУТРИ картинки намеренно
// оставлены как есть: чем модуль называет их на самом экране, я не проверил,
// а переводить надпись, не сверив с интерфейсом, — способ пообещать не то.
// 31.10.2026 (решение Оркестратора «обещать только то, что есть»): картинка говорила «6 агентов · 5 поставщиков»,
// а консоль — совет из ТРЁХ агентов (Аналитик, Скептик, Практик; CouncilConsole.tsx PANEL) с основными поставщиками
// Claude / Gemini / открытая модель через OpenRouter. Роли и подпись приведены к консоли.
export const alt = "AEVION Мультичат — совет трёх ИИ-агентов: видно, где их ответы расходятся";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROLES: Array<{ name: string; bg: string; fg: string; border: string }> = [
  { name: "Analyst", bg: "rgba(94,234,212,0.18)", border: "rgba(94,234,212,0.55)", fg: "#5eead4" },
  { name: "Skeptic", bg: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.55)", fg: "#fca5a5" },
  { name: "Practitioner", bg: "rgba(250,204,21,0.18)", border: "rgba(250,204,21,0.55)", fg: "#facc15" },
];

export default function MultichatOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 45%, #134e4a 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            AEVION · Multichat Engine
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Three AI agents, one question.</span>
            <span style={{ color: "#5eead4" }}>See where they disagree.</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#cbd5e1",
              lineHeight: 1.4,
              maxWidth: 1000,
              display: "flex",
            }}
          >
            Claude · Gemini · open models · signed receipt · 2 free questions a day
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ROLES.map((r) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 999,
                border: `1px solid ${r.border}`,
                background: r.bg,
                color: r.fg,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              {r.name}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
