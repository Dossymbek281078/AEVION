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
  // /press is where journalists copy figures verbatim, so it belongs on the
  // same guard as the investor surfaces. It was missing here, and carried an
  // invented "$340B addressable market" plus an inverted live/MVP split.
  // SEO-метаданные и OG-описания — «классические отстающие», как и написано
  // в шапке pitchFacts. Их тут не было, и «37 modules deployed» пережило рост
  // реестра до 41: страницы поправили, а описание в <head> и превью в соцсетях
  // остались со старым числом.
  "src/app/pitch/layout.tsx",
  "src/app/demo/layout.tsx",
  "src/lib/i18n-data.ts",
];

/**
 * Записи чейнджлога описывают, что было сделано НА ТОТ МОМЕНТ. «Сравнение всех
 * 37 модулей» — это правда о фиче, выпущенной тогда, когда модулей было 37.
 * Переписать её значит подделать историю, поэтому строки чейнджлога из проверки
 * на отставшие числа исключены. Всё остальное в i18n-data — живой текст,
 * который пользователь видит сейчас, и он обязан быть актуальным.
 */
const CHANGELOG_KEY = /"[a-zA-Z0-9_.]*changelog[a-zA-Z0-9_.]*":/i;

/** Убирает из содержимого строки чейнджлога — только для файла переводов. */
function stripChangelogLines(content: string): string {
  return content
    .split("\n")
    .filter((line) => !CHANGELOG_KEY.test(line))
    .join("\n");
}

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
    pattern: /\b37\b[^\n]{0,24}(modules?\s+deployed|modules?\s+live|product nodes)/i,
    reason:
      '"37 modules deployed" — stale module count (37). It survived in SEO meta and ' +
      "OG descriptions after the registry grew to 41; import MODULE_NODES instead.",
  },
  {
    pattern: /\b29\b[^\n]{0,20}(product nodes|modules? live|nodes)/i,
    reason: '"29 … nodes" — stale module count (never hardcode it; import MODULE_NODES from pitchFacts)',
  },
];

/**
 * AutoTranslate matches dictionary keys by EXACT full string. So the moment the
 * module count changes, the phrase "<N> product nodes" stops matching and the
 * Russian rendering silently falls back to English — no error, no test failure,
 * just an untranslated line nobody notices. This locks the two together.
 */
describe("AutoTranslate — the module-count phrase stays translatable", () => {
  it(`carries a dictionary entry for the current count`, async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    const dict = readFileSync(path.join(FRONTEND_ROOT, "src/components/AutoTranslate.tsx"), "utf8");
    const phrase = `"${MODULE_NODES} product nodes"`;
    expect(
      dict.includes(phrase),
      `AutoTranslate.tsx has no entry for ${phrase}. The dictionary matches whole ` +
        `strings exactly, so without it the phrase renders untranslated in RU. ` +
        `Add the pair next to the existing "product nodes" entries.`,
    ).toBe(true);
  });
});

describe("pitch numbers — retired figures must not resurface", () => {
  for (const rel of SURFACES) {
    it(`${rel} carries no retired figures`, () => {
      const raw = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      // Файл переводов держит и живой текст, и записи чейнджлога. Вторые —
      // историческая правда о том, что было выпущено при 37 модулях.
      const src = rel.endsWith("i18n-data.ts") ? stripChangelogLines(raw) : raw;
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
 * Lock the canonical counts to the registry — by COUNTING it.
 *
 * The previous version of this block asserted `MODULE_NODES === 37` and
 * `LIVE_MODULES === 35` against literals. That compares one hardcoded number to
 * another: the registry grew from 38 entries to 41 and both assertions stayed
 * green while every pitch surface published a stale figure (audit 2026-07-26 —
 * real counts were 41 total / 36 live, published counts were 37 / 35).
 *
 * A guard that cannot fail is not a guard. These now read projects.ts and
 * report the number they actually found, so the fix is obvious when it breaks.
 */
const REGISTRY = path.resolve(FRONTEND_ROOT, "../aevion-globus-backend/src/data/projects.ts");

/** Statuses as they appear in projects.ts entries. */
function countRegistry(): { total: number; byStatus: Record<string, number> } {
  const src = readFileSync(REGISTRY, "utf8");
  const statuses = Array.from(src.matchAll(/status:\s*["'](\w+)["']/g)).map((m) => m[1]);
  const byStatus: Record<string, number> = {};
  for (const s of statuses) byStatus[s] = (byStatus[s] ?? 0) + 1;
  return { total: statuses.length, byStatus };
}

/** The globus entry is the map shell, not a product node — see pitchFacts header. */
const MAP_SHELL_ENTRIES = 1;

describe("pitchFacts — canonical counts stay in sync with the registry", () => {
  it("MODULE_NODES equals registry entries minus the globus map shell", async () => {
    const { total } = countRegistry();
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    expect(
      MODULE_NODES,
      `projects.ts now holds ${total} entries, so MODULE_NODES should be ` +
        `${total - MAP_SHELL_ENTRIES}. Update src/data/pitchFacts.ts.`,
    ).toBe(total - MAP_SHELL_ENTRIES);
  });

  it("REGISTRY_ENTRIES equals the total number of entries in projects.ts", async () => {
    const { total } = countRegistry();
    const { REGISTRY_ENTRIES } = await import("@/data/pitchFacts");
    expect(
      REGISTRY_ENTRIES,
      `projects.ts now holds ${total} entries, so REGISTRY_ENTRIES should be ` +
        `${total}. Update src/data/pitchFacts.ts.`,
    ).toBe(total);
  });

  it('LIVE_MODULES equals the count of status:"live" in projects.ts', async () => {
    const { byStatus } = countRegistry();
    const live = byStatus.live ?? 0;
    const { LIVE_MODULES } = await import("@/data/pitchFacts");
    expect(
      LIVE_MODULES,
      `projects.ts now holds ${live} live modules. Update src/data/pitchFacts.ts.`,
    ).toBe(live);
  });

  it("the registry is readable and non-empty (the counter itself must not silently return 0)", () => {
    const { total, byStatus } = countRegistry();
    expect(total).toBeGreaterThan(20);
    expect(Object.keys(byStatus).length).toBeGreaterThan(0);
  });
});
