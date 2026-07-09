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
