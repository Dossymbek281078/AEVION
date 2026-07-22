import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QVenture investment analysis";

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
    const res = await fetch(
      `${getApiBase()}/api/qventure/analyses/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: AnalysisView };
    if (!json?.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

const VERDICT_COLOR: Record<Verdict, string> = { invest: TEAL, watch: AMBER, pass: RED };

export default async function QVentureOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchAnalysis(id);

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
          fontFamily: "serif",
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
            <span style={{ color: INK_FAINT, letterSpacing: "0.2em" }}>Investment Analysis</span>
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
    size,
  );
}
