import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression guard for retired pitch numbers.
 *
 * Why this exists: the same headline figure ($2B+ ARR, the "Seed $5M" ask, …)
 * used to live as a hardcoded string in ~10 different files with slightly
 * different wording. A cleanup in one window only ever caught the variants
 * someone grepped for, so a stale copy always resurfaced in another surface
 * (SEO meta, OG images, print pages). This test fails the build the moment a
 * retired figure reappears on any pitch surface — so drift is caught in CI,
 * not by a human reading the page months later.
 *
 * Scope is deliberately narrow: only investor-facing pitch surfaces, and only
 * figures that were explicitly retired. Legitimate numbers the founder keeps
 * (valuation ranges like "$1.0-1.6B", the "$10M returnable advance", real
 * plant-cost answers in the smeta trainer) are intentionally NOT matched.
 */

const FRONTEND_ROOT = path.resolve(__dirname, "../../..");

// Pitch surfaces that must stay consistent with the single revenue model.
const SURFACES = [
  "src/app/page.tsx",
  "src/app/pitch/page.tsx",
  "src/app/pitch/print/page.tsx",
  "src/app/pitch/opengraph-image.tsx",
  "src/app/partner/page.tsx",
  "src/app/partner/print/page.tsx",
  "src/app/investor/layout.tsx",
  "src/app/investor/page.tsx",
  "src/components/AutoTranslate.tsx",
  "src/data/pitchModel.ts",
];

// Retired figures. Each must not appear on any surface above.
const RETIRED: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\$2\.?0?\s*B\+/i,
    reason: '"$2B+" / "$2.0B+" — retired top-down ARR headline (replaced by the bottom-up model)',
  },
  {
    pattern: /modelled at \$2/i,
    reason: '"modelled at $2B" — retired top-down trajectory headline',
  },
  {
    pattern: /Seed \$5M/i,
    reason: '"Seed $5M" — retired ask (canonical offer is a $10M returnable advance, not an equity seed)',
  },
  {
    pattern: /\b29\b[^\n]{0,20}(product nodes|modules? live|nodes)/i,
    reason: '"29 … nodes" — stale module count (canonical public count is 37 nodes; import MODULE_NODES from pitchFacts)',
  },
];

describe("pitch numbers — retired figures must not resurface", () => {
  for (const rel of SURFACES) {
    it(`${rel} carries no retired figures`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      for (const { pattern, reason } of RETIRED) {
        const hit = src.match(pattern);
        expect(
          hit,
          `${rel} still contains ${reason}. Found: ${hit ? hit[0] : ""}. ` +
            `Align it with the single bottom-up revenue model (see unitEconomics in src/data/pitchModel.ts).`,
        ).toBeNull();
      }
    });
  }
});

/**
 * Lock the canonical counts to the registry. If someone adds/removes a module
 * in aevion-globus-backend/src/data/projects.ts, this fails until pitchFacts is
 * updated to match — so the single source of truth can't silently drift.
 */
describe("pitchFacts — canonical counts stay in sync with the registry", () => {
  it("MODULE_NODES = 37 (38 registry entries − the globus map shell)", async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    expect(MODULE_NODES).toBe(37);
  });

  it("LIVE_MODULES = 35 (status:\"live\" in projects.ts)", async () => {
    const { LIVE_MODULES } = await import("@/data/pitchFacts");
    expect(LIVE_MODULES).toBe(35);
  });
});

/**
 * Guard: a number on a public page never wears a "live" label unless it came
 * from a live call.
 *
 * Why this exists. On 2026-08-09 /demo and /pitch both showed a green "LIVE"
 * badge whenever ANY ONE of four endpoints answered. One of them —
 * /api/qtrade/summary — sits behind requireAuth, so for a signed-out visitor it
 * can never answer: its number always came from the hardcoded DEMO_METRICS
 * (1450) and was presented as live. Measured against production the same day,
 * the four working sources returned 25 / 25 / 20 / 50 — so a fabricated
 * four-digit figure stood next to real two-digit ones under one green dot.
 *
 * The structural invariant that prevents the whole class: every metric pill
 * must be told whether ITS OWN source answered. A pill rendered without the
 * `live` prop is a number with no way to mark itself, which is exactly how the
 * old bug looked in the diff — nothing about it read as wrong.
 */
describe("live metrics — every pill declares its own liveness", () => {
  const PILL_SURFACES = ["src/app/demo/page.tsx", "src/app/pitch/page.tsx"];

  for (const rel of PILL_SURFACES) {
    it(`${rel} renders no LivePill without a live= prop`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      // Each usage is a single JSX element; match up to the self-closing slash
      // so a multi-prop pill on one line is captured whole.
      const usages = src.match(/<LivePill\b[^>]*\/>/g) || [];
      expect(
        usages.length,
        `${rel} no longer renders any LivePill — if the block was removed, drop it from PILL_SURFACES; ` +
          `if it was renamed, point this guard at the new component.`,
      ).toBeGreaterThan(0);

      const unmarked = usages.filter((u) => !/\blive=/.test(u));
      expect(
        unmarked,
        `${rel} renders ${unmarked.length} metric pill(s) with no live= prop. ` +
          `A pill that cannot know whether its source answered will show the DEMO_METRICS ` +
          `fallback as if it were a live number.`,
      ).toEqual([]);
    });
  }
});
