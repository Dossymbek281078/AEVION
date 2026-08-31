import { ImageResponse } from "next/og";
import { daysUntilLaunch } from "@/lib/daysUntilLaunch";

export const runtime = "edge";
export const alt = "CyberChess — открываем 30 сентября: 500 000+ задач, Stockfish 18, ИИ-коуч";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Карточка репоста. До 19.08.2026 у посадочных запуска не было og:image вовсе —
// ссылка в Telegram или LinkedIn показывалась голым текстом, хотя именно на эти
// страницы ведёт трафик роликов.
//
// Числа здесь только те, что проверены замером на живом проде: банк задач
// (GET /api/cyberchess-puzzles/meta) и Stockfish 18 (виден в интерфейсе партии).
// Ничего про турниры и рейтинги — их я не проверял, а карточка живёт в ленте
// дольше, чем любая правка.
//
// ЧИСЛО ОКРУГЛЕНО СНИЗУ намеренно (20.08.2026). Строкой выше было записано, что
// карточка переживает правки, — и тут же стояло точное «502 584», которое от
// роста банка начнёт врать. Соседняя страница запуска берёт счётчик из живой
// ручки и в комментарии прямо предупреждает: «любое зашитое число начнёт врать
// в день, когда…». Здесь так нельзя — картинка кэшируется соцсетями надолго,
// а фоновый запрос при генерации добавил бы точку отказа ради косметики.
// «500 000+» остаётся правдой при любом росте. Именно на этом классе в тот же
// день нашлось «5800+ пазлов» в twitter:description — занижение в 86 раз.
const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const GOLD = "#a9781a";

export default function CyberChessLaunchOg() {
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
          background: PAPER,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 22, letterSpacing: 4, color: GOLD, textTransform: "uppercase", display: "flex" }}>
            AEVION · CyberChess
          </div>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, display: "flex" }}>
            {daysUntilLaunch(Date.UTC(2026, 8, 30)) > 0
              ? "Открываем 30 сентября"
              : "Уже открыто"}
          </div>
          <div style={{ fontSize: 30, color: MUTED, lineHeight: 1.35, maxWidth: 900, display: "flex" }}>
            Партия с движком, задача дня и тренер, который объясняет ход, а не просто оценивает.
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {[
            { n: "500 000+", t: "задач в банке" },
            { n: "Stockfish 18", t: "движок" },
            { n: "$19", t: "в месяц" },
          ].map((c) => (
            <div
              key={c.n}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "18px 26px",
                borderRadius: 14,
                background: "#fffdf8",
                border: "1px solid rgba(22,22,26,0.12)",
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 800, display: "flex" }}>{c.n}</div>
              <div style={{ fontSize: 19, color: MUTED, display: "flex" }}>{c.t}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
