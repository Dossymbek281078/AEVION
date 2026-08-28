import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION QSign — подпись JSON по канонической форме";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка QSign.
 *
 * ЗАЧЕМ. Замер на проде 28.08.2026: у страницы стоит
 * `twitter:card: summary_large_image`, но `og:image` нет — карточка ОБЕЩАЕТ
 * большое изображение, которого не существует, и ссылка приходит с пустым
 * местом. Второй такой случай за день после /constitution/pricing.
 *
 * ЧТО ЗДЕСЬ НАПИСАНО И ПОЧЕМУ ИМЕННО ЭТО. В памяти платформы есть случай,
 * когда витрина обещала Ed25519, а под ней был HMAC на публичном ключе.
 * Поэтому перед тем как писать, я спросил прод:
 *
 *   /api/qsign/v2/health → activeKeys: { hmac: "qsign-hmac-v1",
 *                                        ed25519: "qsign-ed25519-v1" },
 *                          canonicalization: "RFC8785", signatures: 42
 *
 * То есть Ed25519 действительно активен, и канонизация действительно RFC 8785.
 * А вот постквантовая часть (Dilithium) на проде в режиме preview —
 * `/health` отвечает `qsign: { mode: "preview", reason: "seed_unset" }`, и
 * этот дайджест прямым текстом «NOT a cryptographic signature». Поэтому её в
 * карточке НЕТ ни словом.
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
          AEVION QSIGN
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05 }}>
            Подпись JSON, которую можно перепроверить
          </div>
          <div style={{ fontSize: 31, lineHeight: 1.4, color: "#374151" }}>
            Каноническая форма по RFC 8785: один и тот же документ даёт один и
            тот же отпечаток независимо от порядка полей.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>HMAC</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>Ed25519</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/qsign</div>
        </div>
      </div>
    ),
    size,
  );
}
