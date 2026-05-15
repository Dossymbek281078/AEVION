// Embeddable Trust Badge — returns an SVG that creators can drop onto any
// external site as <img src="https://aevion.app/bank/badge/<id>?...">.
//
// Why pass score/tier/name as query params: the AEVION backend does not yet
// expose a public, unauthenticated Trust Score endpoint (the score is
// computed client-side from a mix of QRight/Chess/Planet/Banking signals,
// and exposing the inputs raw would leak personal data). Until a signed
// public-projection endpoint lands, the embed snippet bakes the values into
// the URL — the user's bank page generates that URL and serves the snippet.
//
// The route is server-rendered on demand, so the SVG can stay lightweight
// (no Edge runtime needed). We set CORS / cache headers so it loads cleanly
// from any origin.

import type { NextRequest } from "next/server";

type Tier = "new" | "growing" | "trusted" | "elite";
type Theme = "light" | "dark";

const TIER_LABEL: Record<Tier, string> = {
  new: "New",
  growing: "Growing",
  trusted: "Trusted",
  elite: "Elite",
};

const TIER_COLOR: Record<Tier, string> = {
  new: "#94a3b8",
  growing: "#0ea5e9",
  trusted: "#0d9488",
  elite: "#d97706",
};

const TIER_GRADIENT: Record<Tier, [string, string]> = {
  new: ["#94a3b8", "#475569"],
  growing: ["#0ea5e9", "#0369a1"],
  trusted: ["#0d9488", "#134e4a"],
  elite: ["#fbbf24", "#b45309"],
};

const THEMES: Record<Theme, { bg: string; fg: string; muted: string; ring: string }> = {
  light: { bg: "#ffffff", fg: "#0f172a", muted: "#64748b", ring: "rgba(15,23,42,0.10)" },
  dark: { bg: "#0f172a", fg: "#ffffff", muted: "#cbd5e1", ring: "rgba(255,255,255,0.18)" },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isTier(x: string | null): x is Tier {
  return x === "new" || x === "growing" || x === "trusted" || x === "elite";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const scoreRaw = parseFloat(url.searchParams.get("score") ?? "0");
  const score = Number.isFinite(scoreRaw) ? clamp(scoreRaw, 0, 1) : 0;
  const tierParam = url.searchParams.get("tier");
  const tier: Tier = isTier(tierParam) ? tierParam : "new";
  const nameRaw = (url.searchParams.get("name") ?? "").slice(0, 28);
  const name = escapeXml(nameRaw || `acc · ${id.slice(-6)}`);
  const themeParam = url.searchParams.get("theme");
  const theme: Theme = themeParam === "dark" ? "dark" : "light";

  const palette = THEMES[theme];
  const accent = TIER_COLOR[tier];
  const [g0, g1] = TIER_GRADIENT[tier];
  const pct = Math.round(score * 100);

  // Ring geometry — same trick as the wallet score chip.
  const ringR = 32;
  const ringCirc = 2 * Math.PI * ringR;
  const ringFill = clamp(score, 0, 1) * ringCirc;
  const ringDash = `${ringFill} ${ringCirc}`;

  const W = 360;
  const H = 96;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="AEVION Trust Badge: ${name}, ${TIER_LABEL[tier]}, score ${pct} percent">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${g0}" />
      <stop offset="100%" stop-color="${g1}" />
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.bg}" />
      <stop offset="100%" stop-color="${palette.bg}" stop-opacity="0.94" />
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" ry="14" fill="url(#bg)" stroke="${palette.ring}" />

  <g transform="translate(48 48)">
    <circle r="${ringR}" fill="none" stroke="${palette.ring}" stroke-width="6" />
    <circle r="${ringR}" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${ringDash}" transform="rotate(-90)" />
    <text text-anchor="middle" dominant-baseline="central" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="18" font-weight="900" fill="${palette.fg}">${pct}</text>
  </g>

  <g transform="translate(98 26)">
    <text font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="9" font-weight="800" letter-spacing="2" fill="${palette.muted}">AEVION · TRUST SCORE</text>
    <text y="22" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="16" font-weight="900" fill="${palette.fg}">${name}</text>
    <g transform="translate(0 30)">
      <rect width="68" height="20" rx="10" ry="10" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-opacity="0.45" />
      <text x="34" y="14" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" letter-spacing="1" fill="${accent}">${TIER_LABEL[tier].toUpperCase()}</text>
    </g>
    <text x="78" y="44" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="10" fill="${palette.muted}">aevion.app · verified by Trust Graph</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
      "Access-Control-Allow-Origin": "*",
      "X-Robots-Tag": "noindex",
    },
  });
}
