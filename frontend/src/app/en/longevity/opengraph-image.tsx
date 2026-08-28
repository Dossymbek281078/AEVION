import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "The Longevity Protocol — what to measure, what is proven, what is overrated";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Карточка для /en/longevity.
 *
 * ЗАЧЕМ — то же, что у /en/go: `og:image` отсутствовал, ссылка приходила без
 * картинки. У русской /longevity карточка есть, у английской не было.
 *
 * Здесь на первый план вынесена ГРАДАЦИЯ по доказательности: это единственное,
 * чем страница отличается от сотни похожих о долголетии, и единственное, что
 * честно обещать — включая пункты, помеченные как переоценённые.
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
          AEVION
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05 }}>
            The Longevity Protocol
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: "#374151" }}>
            Twelve weeks: measure, intervene, measure again. Every recommendation
            graded A to E — including what the internet overrates.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, color: "#4b5563" }}>
          <div style={{ display: "flex" }}>11 markers</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>Free, no signup</div>
          <div style={{ display: "flex", opacity: 0.5 }}>·</div>
          <div style={{ display: "flex" }}>aevion.app/en/longevity</div>
        </div>
      </div>
    ),
    size,
  );
}
