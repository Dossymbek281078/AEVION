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
  // Эти две проверки раньше выглядели так:
  //     expect(LIVE_MODULES).toBe(35);
  // то есть сверяли константу с ЗАХАРДКОЖЕННЫМ числом, а не с реестром. Тест был
  // зелёным и не защищал ни от чего: он подтверждал, что 35 равно 35. Реестр можно
  // было менять сколько угодно — guard молчал, и 30.07.2026 обнаружилось, что в
  // projects.ts уже 41 запись (36 live + 5 mvp), а питч всё ещё обещает 37/35.
  //
  // Теперь считаем ФАКТ из projects.ts. Добавили модуль — тест падает и напоминает
  // обновить материалы для инвестора вместе с кодом.
  function registryCounts(): { entries: number; live: number; mvp: number } {
    const registry = readFileSync(
      path.join(process.cwd(), "..", "aevion-globus-backend", "src", "data", "projects.ts"),
      "utf8",
    );
    const statuses = registry.match(/status:\s*"(live|mvp)"/g) ?? [];
    return {
      entries: statuses.length,
      live: statuses.filter((s) => s.includes('"live"')).length,
      mvp: statuses.filter((s) => s.includes('"mvp"')).length,
    };
  }

  it("MODULE_NODES совпадает с реестром (записи минус globus — сам холст карты)", async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    const { entries } = registryCounts();
    // Страховка от сломанного разбора: пустой список статусов дал бы 0 и тест
    // «прошёл» бы на пустоте, как это уже было с прошлой версией guard'а.
    expect(entries).toBeGreaterThan(20);
    expect(MODULE_NODES).toBe(entries - 1);
  });

  it("LIVE_MODULES совпадает с числом status:\"live\" в projects.ts", async () => {
    const { LIVE_MODULES } = await import("@/data/pitchFacts");
    const { live } = registryCounts();
    expect(live).toBeGreaterThan(20);
    expect(LIVE_MODULES).toBe(live);
  });
});
