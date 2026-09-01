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
  // ⚠️ Заменено 31.08.2026: словарь разбит по языкам 10.08, в i18n-data.ts
  // переводов больше НЕТ — там 3.3 КБ служебных данных. Пока в списке стоял
  // он, устаревшее число модулей в переводах не нашлось бы ни на одном языке.
  // Перечисляем файлы поимённо, а не каталогом: список поверхностей — это
  // ЗНАМЕНАТЕЛЬ проверки, и он должен быть виден глазом.
  "src/lib/i18n-lang/ar.ts",
  "src/lib/i18n-lang/de.ts",
  "src/lib/i18n-lang/en.ts",
  "src/lib/i18n-lang/es.ts",
  "src/lib/i18n-lang/fr.ts",
  "src/lib/i18n-lang/ja.ts",
  "src/lib/i18n-lang/kk.ts",
  "src/lib/i18n-lang/pt.ts",
  "src/lib/i18n-lang/ru.ts",
  "src/lib/i18n-lang/tr.ts",
  "src/lib/i18n-lang/zh.ts",
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

/* ────────────────────────────────────────────────────────────────────────── */
/* Price drift — the expensive half of the same problem                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The 2026-07-22 repricing (lite 19→24, medium 29→39, full 49→89, Universe
 * 149.99→249.99) landed in the backend tier registry and nowhere else. For
 * three weeks the marketing copy, the tier OG cards and the whole investor
 * model still quoted the old ladder — a visitor read "$19/mo" and the checkout
 * charged $24. Nothing crashed, no test went red: exactly the silent kind of
 * wrong that only a human re-reading the page ever catches.
 *
 * So: parse the prices straight out of the backend registry and assert the
 * derived surfaces match. Any future price change fails here until every
 * surface is updated — the drift becomes a red build, not a support ticket.
 *
 * SCOPE, and its counterpart. The checks below pin NAMED surfaces to the
 * registry — they answer "is this specific figure still right?". They cannot
 * answer "did a retired price reappear somewhere nobody is watching?": the $59
 * All-Access banner and the $149 devhub link were both found by hand on
 * 2026-08-10, not by this guard. That question belongs to
 * retiredPrices.guard.test.ts, which sweeps the whole frontend for the four
 * retired tier prices and names every legitimate exception — the same bet
 * scaleClaims.guard.test.ts makes for module counts. Keep the two apart:
 * positive pinning here, whole-sweep there, and no third mechanism.
 */

const BACKEND_PRICING = path.resolve(
  FRONTEND_ROOT,
  "../aevion-globus-backend/src/data/pricing.ts",
);

/** tierId → priceMonthly as written in TIERS (null for enterprise). */
function registryTierPrices(): Record<string, number | null> {
  const src = readFileSync(BACKEND_PRICING, "utf8");
  // Slice to the TIERS array — MODULES_PRICING below it also has `id:` keys.
  const start = src.indexOf("export const TIERS");
  const end = src.indexOf("export const MODULES_PRICING");
  expect(
    start >= 0 && end > start,
    `Could not locate the TIERS array in ${BACKEND_PRICING}. If the registry was ` +
      "restructured, update this guard — do not delete it.",
  ).toBe(true);

  const tiers: Record<string, number | null> = {};
  const re = /id:\s*"([a-z]+)",[\s\S]*?priceMonthly:\s*([\d.]+|null)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src.slice(start, end))) !== null) {
    tiers[m[1]] = m[2] === "null" ? null : Number(m[2]);
  }
  return tiers;
}

/** Prices a public price card is allowed to show, ascending. */
function registryCardPrices(): number[] {
  const tiers = registryTierPrices();
  return Object.values(tiers)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
}

/**
 * These pull in pitchModel/pitchFacts through a dynamic import. Under a full
 * parallel run on a loaded machine that import alone can exceed vitest's 5s
 * default, which is sized for pure unit tests — the guard then goes red because
 * the disk was busy, not because a price drifted. A guard that is red for no
 * reason is one people learn to skim past.
 */
const IMPORT_TIMEOUT_MS = 30_000;

describe("prices — derived surfaces stay in sync with the backend tier registry", () => {
  it("the registry parses and still holds the six known tiers", () => {
    const tiers = registryTierPrices();
    expect(Object.keys(tiers).sort()).toEqual(
      ["enterprise", "free", "full", "lite", "medium", "pro"],
    );
    expect(tiers.enterprise).toBeNull();
  }, IMPORT_TIMEOUT_MS);

  it("pitchFacts quotes the live ladder (entry / top-live-checkout / Universe)", async () => {
    const tiers = registryTierPrices();
    const facts = await import("@/data/pitchFacts");

    expect(
      facts.ENTRY_PAID_TIER_MONTHLY,
      "ENTRY_PAID_TIER_MONTHLY must equal the Lite price in data/pricing.ts",
    ).toBe(`$${tiers.lite}`);

    // Universe (`pro`) has no Lemon Squeezy variant, so Full is the highest
    // tier a visitor can actually subscribe to — see data/lemonSqueezyVariants.ts.
    expect(
      facts.LIVE_TOP_TIER_MONTHLY,
      "LIVE_TOP_TIER_MONTHLY must equal the Full price in data/pricing.ts",
    ).toBe(`$${tiers.full}`);

    expect(
      facts.UNIVERSE_SEAT_MONTHLY,
      "UNIVERSE_SEAT_MONTHLY must equal the `pro` (Universe) price in data/pricing.ts",
    ).toBe(`$${tiers.pro}`);
  }, IMPORT_TIMEOUT_MS);

  it("the Universe annual figure follows the registry's ×10 annual formula", async () => {
    const tiers = registryTierPrices();
    const { UNIVERSE_SEAT_ANNUAL_TOTAL } = await import("@/data/pitchFacts");
    const expected = `~$${Math.round((tiers.pro as number) * 10).toLocaleString("en-US")}/yr`;
    expect(
      UNIVERSE_SEAT_ANNUAL_TOTAL,
      "Annual = pay for 10 months, get 12 (annualTotal() in data/pricing.ts). " +
        "This figure is the seat ARPU the growth model runs on — if it drifts, every " +
        "ARR row in pitchModel.ts is wrong.",
    ).toBe(expected);
  }, IMPORT_TIMEOUT_MS);

  it("the growth model prices the Universe seat at the registry price", async () => {
    const tiers = registryTierPrices();
    const { launchGrowth } = await import("@/data/pitchModel");

    expect(launchGrowth.seat.headline).toBe(`$${tiers.pro} / mo`);
    expect(
      launchGrowth.seat.honesty,
      "The on-ramp ladder quoted next to the seat price must be the live one.",
    ).toContain(`($0/$${tiers.lite}/$${tiers.medium}/$${tiers.full})`);
  }, IMPORT_TIMEOUT_MS);

  it("the bottom-up model prices All-Access at the live Full tier", async () => {
    const tiers = registryTierPrices();
    const { unitEconomics } = await import("@/data/pitchModel");
    const allAccess = unitEconomics.flagships.find((f) => f.module === "Ecosystem All-Access");
    expect(allAccess, "The 'Ecosystem All-Access' flagship disappeared from unitEconomics").toBeTruthy();
    expect(
      allAccess!.price.startsWith(`$${tiers.full}/mo`),
      `All-Access is the Full tier — its modelled price must open with $${tiers.full}/mo, got: ${allAccess!.price}`,
    ).toBe(true);
  }, IMPORT_TIMEOUT_MS);

  // OG cards are the classic laggard: nobody re-opens an image when a price
  // changes. Compare the full set of prices on the card to the registry rather
  // than banning old literals — that way an added tier fails too, and prose in
  // comments can still mention a retired price.
  const PRICE_CARDS: Array<{ rel: string; re: RegExp }> = [
    { rel: "src/app/pricing/[tierId]/opengraph-image.tsx", re: /price:\s*"\$([\d.]+)"/g },
    { rel: "src/app/pricing/compare/opengraph-image.tsx", re: /price="\$([\d.]+)"/g },
  ];

  for (const { rel, re } of PRICE_CARDS) {
    it(`${rel} shows exactly the registry ladder`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      const shown = [...src.matchAll(re)].map((m) => Number(m[1])).sort((a, b) => a - b);
      expect(
        shown,
        `${rel} is a share card — its prices must be the live ladder from ` +
          "aevion-globus-backend/src/data/pricing.ts (Enterprise shows a word, not a number).",
      ).toEqual(registryCardPrices());
    }, IMPORT_TIMEOUT_MS);
  }
});

/**
 * The same drift, one level down: per-product prices quoted on marketing and
 * investor surfaces while the charging code lives elsewhere in the backend.
 * Each case below was a real wrong number found on 2026-08-10, so each is
 * pinned to the file that actually decides what a customer pays.
 */

const BACKEND_SRC = path.resolve(FRONTEND_ROOT, "../aevion-globus-backend/src");

/** Read a backend file, failing with a useful message if the layout moved. */
function readBackend(rel: string): string {
  const abs = path.join(BACKEND_SRC, rel);
  try {
    return readFileSync(abs, "utf8");
  } catch {
    throw new Error(
      `Could not read ${abs}. If the backend was restructured, repoint this guard — ` +
        "do not delete it; it exists because these numbers drifted silently once.",
    );
  }
}

describe("product prices — marketing copy stays pinned to the charging code", () => {
  it("the All-Access upgrade banner carries no hardcoded price", () => {
    const src = readFileSync(path.join(FRONTEND_ROOT, "src/components/UpgradeButton.tsx"), "utf8");
    // This banner renders on 9 module pages next to a live checkout. It sat at
    // "$59/мес" — a number no tier ever charged. The price must be imported.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(
      /\$\s?\d/.test(code),
      "UpgradeButton.tsx must not type a price literal — read it from @/lib/products.",
    ).toBe(false);
    // It sells the Gumroad product `xpxzam`, not a tier, so the figure must come
    // from the product catalogue (verified against the live Gumroad dashboard on
    // 2026-07-26) — not from the tier registry.
    expect(src).toContain('productById("xpxzam")');
  }, IMPORT_TIMEOUT_MS);

  it("/investor quotes the live Bureau Verified price", () => {
    const payment = readBackend("lib/payment/index.ts");
    // getVerifiedTierPriceCents(): the env override is a deployment concern;
    // the default in code is what the published page should quote.
    const m = payment.match(/BUREAU_VERIFIED_PRICE_CENTS[\s\S]{0,200}?return\s+(\d+);/);
    expect(m, "Could not read the Verified-tier default price from lib/payment/index.ts").toBeTruthy();
    const usd = Number(m![1]) / 100;

    const investor = readFileSync(path.join(FRONTEND_ROOT, "src/app/investor/page.tsx"), "utf8");
    expect(
      investor,
      `Bureau Verified is charged at $${usd}/cert — /investor must not quote a different figure.`,
    ).toContain(`{ tier: "Verified", price: "$${usd}"`);
  }, IMPORT_TIMEOUT_MS);

  it("/investor quotes the real QBuild hire-fee range", () => {
    const build = readBackend("lib/build/index.ts");
    // hireFeeBps/10000 of the accepted salary, tier-adjusted at hire time.
    const bps = [...build.matchAll(/hireFeeBps:\s*(\d+),/g)]
      .map((x) => Number(x[1]))
      .filter((n) => n > 0);
    expect(bps.length, "No hireFeeBps values found in lib/build/index.ts").toBeGreaterThan(1);
    const base = Math.max(...bps) / 100;
    const best = Math.min(...bps) / 100;

    const investor = readFileSync(path.join(FRONTEND_ROOT, "src/app/investor/page.tsx"), "utf8");
    expect(
      investor,
      `The hire fee runs ${base}% (default recruiter tier) down to ${best}% (Platinum). ` +
        "It once read \"1.5%\" here — 8× below what the platform actually takes.",
    ).toContain(`price: "${base}% → ${best}%"`);
  }, IMPORT_TIMEOUT_MS);
});

/**
 * Знаменатель на /pitch должен быть ОДИН — и приходить из pitchFacts.
 *
 * Что случилось 10.08.2026: pitchFacts уже был вылечен и заперт на реестр
 * (40 узлов / 36 живых), а прод-страница /pitch в ту же минуту печатала шесть
 * разных чисел про одно и то же — «12 live MVPs of 33 planned nodes» в шапке,
 * «41 product nodes» в лиде, «one of 41 modules» в сравнении конкурентов,
 * «13 of 41 nodes committed, remaining 15» в рисках. Проверка «константы
 * сходятся с реестром» была зелёной, потому что тексты вокруг констант живут
 * своей жизнью: там числа вписаны словами внутри строк.
 *
 * Поэтому сторож смотрит не на константы, а на ТЕКСТ, который увидит читатель:
 * в исходниках pitch-поверхностей рядом со словами nodes/modules/MVP не должно
 * остаться числового литерала. Комментарии вырезаются перед проверкой — иначе
 * этот самый абзац, объясняющий поломку, и красил бы сборку в красный
 * (сторож, краснеющий на собственном объяснении, снимается через неделю).
 */
const COUNT_SURFACES = [
  "src/data/pitchModel.ts",
  "src/app/pitch/page.tsx",
  // /go — страница под ссылку в профиле соцсетей, то есть первое, что видит
  // холодный трафик из TikTok/Instagram/YouTube. Держала «29 живых модулей»
  // при 36 в реестре. Класс тот же, что на /pitch, поэтому и сторож тот же.
  "src/app/go/page.tsx",
  // Печатный лист для партнёра: «the 30 modules» при 40 узлах.
  "src/app/acquire/ways/page.tsx",
  // ⚠️ Добавлено 31.08.2026. Счётчик модулей живёт и в ПЕРЕВОДАХ, а их не
  // проверял никто: словарь разбит по языкам 10.08, и в списке поверхностей
  // его не было ни под старым именем, ни под новым.
  //
  // Проверено мутацией: «37 модулей в экосистеме AEVION» в русском словаре
  // проходило незамеченным, пока файлов не было в этом списке.
  //
  // Перечисляем поимённо, а не каталогом: список поверхностей — это
  // ЗНАМЕНАТЕЛЬ проверки, и он должен быть виден глазом. Каталог молча
  // изменил бы охват в тот день, когда кто-нибудь добавит туда файл.
  "src/lib/i18n-lang/ar.ts",
  "src/lib/i18n-lang/de.ts",
  "src/lib/i18n-lang/en.ts",
  "src/lib/i18n-lang/es.ts",
  "src/lib/i18n-lang/fr.ts",
  "src/lib/i18n-lang/ja.ts",
  "src/lib/i18n-lang/kk.ts",
  "src/lib/i18n-lang/pt.ts",
  "src/lib/i18n-lang/ru.ts",
  "src/lib/i18n-lang/tr.ts",
  "src/lib/i18n-lang/zh.ts",
];

/** Убирает //-строки и многострочные комментарии, чтобы сканировать только код. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("pitch — счётчики модулей приходят из pitchFacts, а не вписаны цифрой", () => {
  // Диапазон 25–45 — порядок величины реестра с запасом на устаревшие копии.
  // Первая версия ловила только 33–45 и молча пропустила «29 живых модулей»
  // на /go: у устаревшего счётчика число МЕНЬШЕ настоящего, поэтому нижняя
  // граница по текущему значению реестра и есть слепое пятно. Числа вроде
  // 3 флагманов, 4 приоритетных модулей или 12 месяцев сюда не попадают.
  //
  // Существительные: английские — по границе слова, русские — по основе БЕЗ
  // \b. В JS `\b` считает границей только ASCII-словарные символы, поэтому
  // `\bмодул` не совпадает никогда (та же грабля, что в
  // feedback_regex_word_boundary_cyrillic) — сторож был бы вечно зелёным
  // ровно на русских страницах, ради которых его и расширяли.
  //
  // Число должно СТОЯТЬ ПЕРЕД существительным (с парой определений между) —
  // «29 живых модулей», «41 product nodes», «12 live MVPs». Версия «число
  // где-то рядом с существительным» краснела на честной строке «across 40
  // nodes vs. 27 separate API contracts»: 27 — это контракты, а не модули.
  // Сторож, который врёт на живом файле, снимают через неделю, поэтому
  // требование именно такое: счётчик, а не соседство.
  const NOUN = "(?:nodes|modules|MVPs?|модул|узл)";
  const NUM = "(?:2[5-9]|3[0-9]|4[0-5])";
  const COUNT_NEAR_NOUN = new RegExp(
    `\\b${NUM}\\b(?:\\s+[\\p{L}-]{1,15}){0,2}\\s+${NOUN}`,
    "iu",
  );

  for (const rel of COUNT_SURFACES) {
    it(`${rel} не печатает счётчик модулей литералом`, () => {
      // Записи чейнджлога — история: «сравнение 37 модулей» было правдой в
      // день выпуска той возможности. Переписать её значит подделать историю,
      // поэтому для файлов переводов такие строки выбрасываются — ровно так
      // же, как в соседней проверке выше. Механизм один, продублировать его
      // вторым способом значило бы завести два ответа на один вопрос.
      // ⚠️ ДОЛГ, найденный 31.08.2026 расширением охвата на переводы. Это НЕ
      // принятое состояние: восемь ключей печатают число модулей литералом —
      // 36, 37 и 40 при 41 в реестре, то есть человек читает устаревшее число
      // на витрине, в глоссарии и в дорожной карте. 21 строка на трёх языках.
      //
      // Не чиню здесь по двум причинам: это текст витрины (правка числа —
      // решение основателя, у нас числа в интерфейсе берутся только из
      // фактического замера), и правка нужна во всех языках сразу.
      //
      // Список ЯВНЫЙ и датированный, а не «пропустить переводы»: так сторож
      // продолжает ловить НОВЫЕ вписанные числа, а долг виден глазом и
      // сокращается по мере починки.
      const ДОЛГ_ПЕРЕВОДОВ = [
        "about.cta.body",
        "home.subtitle",
        "modulePage.pipeline.title",
        "pricing.glossary.def.saas",
        "pricing.roadmap.subtitle",
        "primer.creator.b3",
        "referralLanding.about.body",
        "tip.trustTier",
      ];
      const raw = readFileSync(path.resolve(FRONTEND_ROOT, rel), "utf8");
      const code = stripComments(rel.includes("i18n-lang") ? stripChangelogLines(raw) : raw);
      const hits = code
        .split("\n")
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => COUNT_NEAR_NOUN.test(line))
        .filter(({ line }) => !ДОЛГ_ПЕРЕВОДОВ.some((k) => line.startsWith('"' + k + '"')));

      expect(
        hits.map((h) => `  ${rel}:${h.n}  ${h.line.slice(0, 120)}`).join("\n"),
        "Счётчик модулей вписан числом. Возьми его из @/data/pitchFacts " +
          "(MODULE_NODES / LIVE_MODULES / DEEP_DIVE_MODULES / COMMITTED_NODES) — " +
          "иначе страница снова начнёт спорить сама с собой.",
      ).toBe("");
    });
  }

  it("DEEP_DIVE_MODULES равен числу карточек со stage:\"live\" в pitchModel", async () => {
    const src = readFileSync(path.resolve(FRONTEND_ROOT, "src/data/pitchModel.ts"), "utf8");
    const deckLive = (src.match(/stage:\s*"live"/g) ?? []).length;
    const { DEEP_DIVE_MODULES } = await import("@/data/pitchFacts");
    expect(
      DEEP_DIVE_MODULES,
      `в колоде ${deckLive} карточек со stage:"live" — обнови DEEP_DIVE_MODULES в pitchFacts.ts`,
    ).toBe(deckLive);
  });

  it("COMMITTED_NODES не превышает MODULE_NODES", async () => {
    const { COMMITTED_NODES, MODULE_NODES } = await import("@/data/pitchFacts");
    expect(COMMITTED_NODES).toBeGreaterThan(0);
    expect(COMMITTED_NODES).toBeLessThanOrEqual(MODULE_NODES);
  });
});

/**
 * Запасное значение живого счётчика не пишется числом.
 *
 * Отдельный класс от литерала в тексте, и куда неприятнее. `registry?.total ?? 27`
 * выглядит аккуратно и в браузере показывает правду — запрос отрабатывает и
 * подменяет число. Но серверный HTML отдаётся ДО запроса, поэтому в исходнике
 * страницы, в превью-карточках соцсетей и у всех, к кому бэкенд не доехал,
 * остаётся запасное значение. Прогоном это не ловится: смотришь глазами в
 * браузере — всё верно.
 *
 * Найдено 10.08.2026 сплошным свипом витрины: /investor обещал инвестору
 * «27 modules tracked», /api-explorer — 29, при 41 записи в реестре. Обе
 * страницы занижали платформу примерно в полтора раза, обе — молча.
 *
 * Правило: запасное значение счётчика реестра берётся из pitchFacts, который
 * заперт на сам реестр считающим сторожем. Ноль (`?? 0`) разрешён — это
 * честное «данных нет», а не выдуманное число.
 */
describe("витрина — запасное значение счётчика реестра не вписано числом", () => {
  const FALLBACK_SURFACES = [
    "src/app/investor/page.tsx",
    "src/app/api-explorer/page.tsx",
    "src/app/explore/page.tsx",
    "src/app/acquire/page.tsx",
  ];
  // Ноль пропускаем намеренно: `?? 0` означает «нечего показывать».
  const HARDCODED_FALLBACK = /\b(?:total|count|live|modules|nodes)\b[^\n]{0,20}\?\?\s*([1-9][0-9]*)/i;

  for (const rel of FALLBACK_SURFACES) {
    it(`${rel} не подставляет счётчик числом`, () => {
      const code = stripComments(readFileSync(path.resolve(FRONTEND_ROOT, rel), "utf8"));
      const hits = code
        .split("\n")
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => HARDCODED_FALLBACK.test(line));

      expect(
        hits.map((h) => `  ${rel}:${h.n}  ${h.line.slice(0, 120)}`).join("\n"),
        "Запасное значение счётчика вписано числом. Возьми REGISTRY_ENTRIES / " +
          "LIVE_MODULES / MODULE_NODES из @/data/pitchFacts — иначе страница будет " +
          "занижать платформу ровно тогда, когда бэкенд не ответил.",
      ).toBe("");
    });
  }
});
