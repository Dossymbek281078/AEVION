import { ImageResponse } from "next/og";
import { serverFetch } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QVenture investment analysis";
// The card renders from a server-side fetch of the analysis. If the very first
// render after a deploy hits a cold backend, the fetch returns null and the
// name/score fall back to placeholders — and without revalidation that broken
// card is cached and served indefinitely (seen live: a deploy left the demo
// card showing "Report demo-neu" instead of "NeuroDx · 68/100"). Revalidating
// lets a stale-fallback card self-heal on the next request after the window.
export const revalidate = 300;

// Newspaper palette — mirrors styles/aevionPaper.module.css. next/og renders a
// bundled sans by default and will not produce serif without a font file, so the
// paper feel here comes from the cream ground, ink text, top rule and the big
// verdict figure — not from a serif face we cannot guarantee renders.
const PAPER = "#f7f6f2";
const CARD = "#fffefb";
const INK = "#17181a";
const INK_SOFT = "#45474c";
const INK_FAINT = "#74767c";
const RULE = "#d4d3cc";
const TEAL = "#0a7d72";
const AMBER = "#b7791f";
const RED = "#b5241b";

type Verdict = "invest" | "watch" | "pass";

type AnalysisView = {
  name: string;
  verdict: Verdict;
  result: { composite: number; sector: { label: string }; stage: string };
};

async function fetchAnalysis(id: string): Promise<AnalysisView | null> {
  try {
    // serverFetch retries a cold backend, so a deploy-time render doesn't cache a
    // placeholder card (the "Report demo-neu" bug that motivated revalidate).
    const res = await serverFetch(`/api/qventure/analyses/${encodeURIComponent(id)}`);
    if (!res || !res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: AnalysisView };
    if (!json?.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

const VERDICT_COLOR: Record<Verdict, string> = { invest: TEAL, watch: AMBER, pass: RED };

// Load a serif face so the card matches the page's newspaper type. next/og
// ships only a sans, so without this the headline renders sans. Fetched from
// Google Fonts at request time (allowed on the nodejs runtime) and wrapped so a
// fetch failure degrades to the default sans rather than erroring the whole image.
//
// Cached at module scope so the two Google Fonts round-trips happen at most once
// per warm server instance, not on every card render. Social crawlers hit these
// URLs in bursts (one per shared link), and an uncached fetch per request would
// make the endpoint slow and flaky under exactly that load. The promise itself is
// memoised, so concurrent first-hits share one fetch instead of racing.
let serifPromise: Promise<ArrayBuffer | null> | null = null;

async function fetchSerif(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Lora:wght@600", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((.+?)\)\s*format/)?.[1];
    if (!url) return null;
    const buf = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null));
    return buf ?? null;
  } catch {
    return null;
  }
}

function loadSerif(): Promise<ArrayBuffer | null> {
  // Re-arm on a null result so a transient font-CDN blip doesn't cache "sans
  // forever" for the life of the instance — only a successful load is sticky.
  if (!serifPromise) {
    serifPromise = fetchSerif().then((buf) => {
      if (buf === null) serifPromise = null;
      return buf;
    });
  }
  return serifPromise;
}

export default async function QVentureOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, serif] = await Promise.all([fetchAnalysis(id), loadSerif()]);
  // Only claim the serif family when the font actually loaded; otherwise let it
  // fall back to the default sans so the card still renders.
  const titleFont = serif ? "Lora" : "serif";

  const nameRaw = data?.name?.trim() || `Report ${id.slice(0, 8)}`;
  const name = nameRaw.length > 46 ? `${nameRaw.slice(0, 44)}…` : nameRaw;
  const verdict: Verdict = data?.verdict ?? "watch";
  const composite = data ? Math.round(data.result.composite) : null;
  const sector = data?.result.sector.label ?? null;
  const stage = data?.result.stage ?? null;
  const accent = VERDICT_COLOR[verdict];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px 64px",
          background: PAPER,
          color: INK,
          fontFamily: titleFont,
        }}
      >
        {/* Masthead rule + kicker */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ borderTop: `4px solid ${INK}`, width: "100%" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 18,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.28em",
              color: TEAL,
              textTransform: "uppercase",
            }}
          >
            <span>AEVION · QVenture</span>
            <span style={{ color: INK_FAINT, letterSpacing: "0.2em" }}>Инвестиционный разбор</span>
          </div>

          <div
            style={{
              marginTop: 30,
              fontSize: 78,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: INK,
              maxWidth: 1072,
            }}
          >
            {name}
          </div>

          {(sector || stage) && (
            <div style={{ marginTop: 20, fontSize: 30, color: INK_SOFT, display: "flex", gap: 18 }}>
              {sector && <span>{sector}</span>}
              {sector && stage && <span style={{ color: RULE }}>·</span>}
              {stage && <span style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{stage}</span>}
            </div>
          )}
        </div>

        {/* Verdict + composite */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div
              style={{
                display: "flex",
                padding: "12px 30px",
                background: accent,
                color: CARD,
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "0.12em",
              }}
            >
              {verdict.toUpperCase()}
            </div>
            {composite !== null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 92, fontWeight: 800, color: INK, lineHeight: 1 }}>{composite}</span>
                <span style={{ fontSize: 34, color: INK_FAINT }}>/ 100</span>
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: INK_FAINT,
              fontWeight: 700,
              textAlign: "right",
              maxWidth: 360,
            }}
          >
            quant score · 4-role council · entry strategy
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: serif
        ? [{ name: "Lora", data: serif, weight: 600 as const, style: "normal" as const }]
        : undefined,
    },
  );
}
