import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION IP Bureau — открываем 10 сентября: реестр, подпись, сертификат с публичной проверкой";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Карточка репоста. До 19.08.2026 у посадочных запуска не было og:image вовсе —
// ссылка в мессенджере показывалась голым текстом, хотя именно на эти страницы
// ведёт трафик роликов.
//
// На карточке только проверенное: название модуля, дата открытия и то, что
// модуль делает. Никаких чисел о размере базы и числе пользователей — они
// требуют замера, а карточка живёт в ленте дольше любой правки.
const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const GOLD = "#a9781a";

export default function BureauLaunchOg() {
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 22, letterSpacing: 4, color: GOLD, textTransform: "uppercase", display: "flex" }}>
            AEVION · IP Bureau
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2, display: "flex" }}>
            Открываем 10 сентября
          </div>
          <div style={{ fontSize: 30, color: MUTED, lineHeight: 1.35, maxWidth: 940, display: "flex" }}>
            Хеш содержимого в реестре, криптографическая подпись и сертификат с проверкой по ссылке.
          </div>
        </div>
        <div style={{ fontSize: 24, color: MUTED, display: "flex" }}>aevion.app</div>
      </div>
    ),
    { ...size },
  );
}
