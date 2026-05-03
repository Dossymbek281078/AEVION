import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "You've got a gift on AEVION";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Try to decode the ?p= payload so the share preview can show the actual
// amount and theme. If decoding fails (no payload, edge runtime quirk),
// fall back to a generic branded card.
type DecodedGift = {
  amount?: number;
  message?: string;
  themeId?: string;
};

const THEME_GRADIENT: Record<string, string> = {
  birthday: "linear-gradient(135deg, #db2777 0%, #f59e0b 100%)",
  thanks: "linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)",
  wedding: "linear-gradient(135deg, #f472b6 0%, #fdf2f8 100%)",
  congrats: "linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)",
  royalty: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
  general: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
};

const THEME_ICON: Record<string, string> = {
  birthday: "♫",
  thanks: "♥",
  wedding: "☆",
  congrats: "★",
  royalty: "✦",
  general: "◆",
};

const THEME_TEXT: Record<string, string> = {
  wedding: "#831843",
};

function tryDecode(p: string | undefined): DecodedGift | null {
  if (!p) return null;
  try {
    const padded = p.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (padded.length % 4)) % 4;
    const b64 = padded + "=".repeat(pad);
    const utf8 = atob(b64);
    const json = decodeURIComponent(escape(utf8));
    const obj = JSON.parse(json);
    const g = obj?.g;
    if (!g) return null;
    return { amount: g.amount, message: g.message, themeId: g.themeId };
  } catch {
    return null;
  }
}

export default function GiftOgImage({
  searchParams,
}: {
  params: { id: string };
  searchParams?: { p?: string };
}) {
  const decoded = tryDecode(searchParams?.p);
  const themeId = decoded?.themeId && decoded.themeId in THEME_GRADIENT ? decoded.themeId : "general";
  const gradient = THEME_GRADIENT[themeId];
  const icon = THEME_ICON[themeId];
  const textColor = THEME_TEXT[themeId] ?? "#ffffff";
  const amountText =
    decoded?.amount != null
      ? `${decoded.amount.toFixed(decoded.amount % 1 === 0 ? 0 : 2)} AEC`
      : null;
  const messagePreview =
    decoded?.message && decoded.message.length > 0
      ? decoded.message.slice(0, 90)
      : null;

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
          background: gradient,
          color: textColor,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 80,
            fontSize: 200,
            opacity: 0.2,
            lineHeight: 1,
            display: "flex",
          }}
        >
          {icon}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.9,
              display: "flex",
            }}
          >
            AEVION · Bank
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.9,
              display: "flex",
            }}
          >
            You've got a gift
          </div>
          {amountText ? (
            <div
              style={{
                fontSize: 128,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: -4,
                display: "flex",
              }}
            >
              {amountText}
            </div>
          ) : (
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: -2,
                maxWidth: 900,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>Open the card</span>
              <span style={{ opacity: 0.85 }}>to see what's inside</span>
            </div>
          )}
          {messagePreview ? (
            <div
              style={{
                fontSize: 26,
                opacity: 0.92,
                maxWidth: 900,
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              "{messagePreview}"
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              opacity: 0.85,
              letterSpacing: 1,
              display: "flex",
            }}
          >
            Tap to claim · works on any device
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              opacity: 0.7,
              letterSpacing: 2,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            aevion.app/bank
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
