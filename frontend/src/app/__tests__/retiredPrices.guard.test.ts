/**
 * Сторож отставных цен AEVION.
 *
 * ЗАЧЕМ. Репрайсинг 22.07.2026 поменял тарифы в реестре
 * (`aevion-globus-backend/src/data/pricing.ts`) — файл, по которому
 * `routes/checkout.ts` считает КАЖДОЕ реальное списание, — и больше нигде.
 * Три недели посетитель читал «$19/мес» в FAQ, а с карты уходило $24.
 * Ничего не падало, тесты не краснели.
 *
 * `pitchNumbers.guard` сверяет цены на ИМЕНОВАННОМ списке поверхностей.
 * Этого не хватило: баннер «All-Access $59» и ссылка «Upgrade — $149/mo»
 * в devhub нашлись руками 10.08.2026, а не тестом. Поэтому здесь — как в
 * соседнем `scaleClaims.guard`: сканируется ВЕСЬ фронтенд, а законные
 * вхождения перечисляются поимённо и с причиной.
 *
 * ЧТО ИМЕННО ЛОВИМ. Не «любую цену» — их во фронтенде больше тысячи, и
 * почти все чужие (цены конкурентов, суммы сделок, аванс $10M). Ловим
 * ровно ЧЕТЫРЕ отставные цены тарифов: 19 / 29 / 49 / 149.99. Набор
 * маленький и точный, поэтому список исключений можно собрать по фактам,
 * а не на глаз. Каждое исключение ниже сверено 10.08.2026 с кодом, который
 * реально списывает деньги, либо с каталогом `lib/products.ts` (его цены
 * сверены с живым дашбордом Gumroad 26.07.2026).
 *
 * ЕСЛИ СТОРОЖ УПАЛ. Либо вернулась отставная цена — тогда правь исходник,
 * а не тест. Либо появилась НОВАЯ законная цена с таким же номиналом —
 * тогда допиши строку в ALLOWED с причиной и ссылкой на то, что списывает.
 * Строка без причины — это не исключение, а заглушённый сторож.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../..");
const REGISTRY = path.resolve(SRC_ROOT, "../../aevion-globus-backend/src/data/pricing.ts");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  // Сторожа и их объяснения сами цитируют отставные цены.
  "__tests__",
  // Учебные сметы: там суммы работ, а не цены подписок.
  "drawings-practice",
]);

/**
 * Отставные цены тарифов. Держим списком, а не «всё, чего нет в реестре»:
 * в реестре нет и цен Bureau, Constitution, API — они законные.
 */
const RETIRED: Array<{ amount: string; was: string }> = [
  { amount: "19", was: "Lite (стал $24 22.07.2026)" },
  { amount: "29", was: "Medium (стал $39 22.07.2026)" },
  { amount: "49", was: "Full (стал $89 22.07.2026)" },
  { amount: "149.99", was: "Universe/pro (стал $249.99 22.07.2026)" },
];

/**
 * Законные вхождения этих же номиналов. Совпадение по подстроке строки
 * исходника. Причина обязательна.
 */
const ALLOWED: Array<{ fragment: string; reason: string }> = [
  // ── AEVION IP Bureau: Verified-сертификат, живое списание ────────────────
  {
    fragment: "verifiedTierCents",
    reason: "цена Verified приходит с бэкенда; $19 — фолбэк, равный дефолту getVerifiedTierPriceCents()",
  },
  { fragment: '"$19 / cert"', reason: "Bureau Verified — живой чек $19/сертификат" },
  { fragment: "Pay $19", reason: "тот же Bureau Verified, шаг оплаты" },
  { fragment: "$19 for the Verified-tier", reason: "тот же Bureau Verified, пояснение шага" },
  { fragment: "Continue to payment ($19)", reason: "тот же Bureau Verified, кнопка" },
  { fragment: "Upgrade to Verified ($19)", reason: "тот же Bureau Verified, вход из QRight" },
  {
    fragment: '{ tier: "Verified", price: "$19"',
    reason: "тот же Bureau Verified на /investor; закреплён отдельно в pitchNumbers.guard",
  },
  {
    fragment: '{ tier: "Notarized (planned)", price: "$49"',
    reason: "Notarized ещё не продаётся — помечен planned, ценой тарифа не притворяется",
  },

  // ── AEVION Constitution: свой продукт, свои тарифы ───────────────────────
  {
    fragment: "Team $49",
    reason: "Constitution Team $49/мес — сверено с constitutionCheckout.ts (team: 49)",
  },
  { fragment: "Team ($49/mo)", reason: "тот же Constitution Team" },
  { fragment: "$49/mo (5 seats", reason: "тот же Constitution Team, SEO-описание" },
  {
    fragment: "live charge: $19/cert",
    reason: "комментарий на /investor, объясняющий, откуда взята цена Bureau Verified",
  },
  { fragment: "$0 → $9 → $49", reason: "лестница Constitution целиком" },
  {
    fragment: "$49/mo — for teams",
    reason: "Constitution Team в i18n (en)",
  },
  { fragment: "$49/мес — для команды", reason: "Constitution Team в i18n (ru)" },
  { fragment: "$49/ай — команда үшін", reason: "Constitution Team в i18n (kk)" },
  {
    fragment: 'price: "$49",',
    reason: "карточка тарифа Constitution Team на /constitution/pricing",
  },
  {
    fragment: '"constitution:team"',
    reason: "permalink Constitution Team в каталоге Gumroad",
  },
  {
    fragment: "подписка · $49 / мес",
    reason: "Constitution Team в lib/products — сверено с дашбордом Gumroad 26.07.2026",
  },
  { fragment: "Pro ($9) и Team ($49)", reason: "комментарий о совпадающих описаниях на Gumroad" },

  // ── Тарифы API / финтеха: своя лестница, не платформенная ────────────────
  {
    fragment: 'name: "Build",     price: "$49/mo"',
    reason: "тариф Build в API-лимитах — своя лестница (/developers/fintech/rate-limits)",
  },
  { fragment: 'price: "$49/mo",', reason: "тот же тариф Build на /fintech/compare" },
  { fragment: 'priceAmount: "$49"', reason: "тот же тариф Build на /pricing/api-pricing" },
  {
    fragment: 'e.g. "$49"',
    reason: "пример формата в комментарии к типу, не цена",
  },

  // ── Add-on'ы модулей: цены из MODULES_PRICING, не из тарифов ─────────────
  {
    fragment: "$19/мес add-on (IP Bureau)",
    reason: "aevion-ip-bureau addonMonthly = 19 в data/pricing.ts",
  },
  {
    fragment: "$19/mo add-on (IP Bureau)",
    reason: "то же самое, английская версия",
  },
  {
    fragment: "Paid add-on $29/mo",
    reason: "qreal addonMonthly = 29 в data/pricing.ts",
  },

  // ── Отдельные товары Gumroad ─────────────────────────────────────────────
  {
    fragment: "Anti-Grey Protocol $19",
    reason: "английское издание гайда qrenew — priceUsd 19 в lib/products",
  },
  {
    fragment: "Get for&nbsp;$19",
    reason: "кнопка того же английского издания на /qmelanin",
  },
  {
    fragment: "($59/$49/$9 в мес)",
    reason: "комментарий о трёх живых подписках Gumroad",
  },

  // ── Прочее ───────────────────────────────────────────────────────────────
  {
    fragment: "Additional seats are $49/user/month",
    reason: "доп-места Planet — своя цена, не тариф платформы",
  },
  {
    fragment: "Create a $29 payment link",
    reason: "текст демонстрационного промта для AI-агента, не цена AEVION",
  },
  {
    fragment: "4 990 ₽/mo Pro (≈$49",
    reason: "пересчёт рублёвого тарифа QBuild в доллары по названному курсу",
  },

  // ── Видимый пользователю текст, который НАМЕРЕННО называет старую цену ───
  // Это не комментарии, а строки инвесторской модели: они объясняют читателю,
  // что выросли только цены, а допущения не трогали. Убрать их — значит
  // спрятать от диligence именно то, что делает пересчёт честным.
  {
    fragment: "Subscriber counts unchanged from the $49 version",
    reason: "модель прямо говорит, что двинулась только цена — иначе рост ARR выглядит подгонкой",
  },
  {
    fragment: "$49 → $89/mo. No conversion or reach assumption",
    reason: "то же самое в примечании к итогам bottom-up",
  },
  {
    fragment: "(repriced from $149.99 on 2026-07-22)",
    reason: "честная пометка о репрайсинге рядом с ценой места Universe",
  },
  {
    fragment: "unchanged from the $149.99 version of this model",
    reason: "то же самое для допущений сценария роста",
  },
];

/**
 * Строки, которые ОБЪЯСНЯЮТ устаревание, а не утверждают цену: комментарии
 * вида «было $49 → стало $89». Их запрещать бессмысленно — они и есть
 * защита от повторения.
 *
 * Работает ТОЛЬКО на строках-комментариях. Иначе достаточно дописать слово
 * «repriced» в обычную строку интерфейса, и живая неверная цена проедет
 * мимо сторожа — то есть у него появится лазейка ровно того вида, ради
 * закрытия которого он написан.
 */
const LINE_COMMENT = /^\s*(\/\/|\*)/;

/**
 * Внутри блочного комментария продолжающие строки не начинаются ни с `*`,
 * ни с `//` — их надо отслеживать состоянием, а не префиксом. Первая версия
 * этой проверки смотрела только на префикс и объявила нарушениями два
 * абзаца собственных пояснений.
 */
function commentMask(lines: string[]): boolean[] {
  let inBlock = false;
  return lines.map((line) => {
    const opens = line.includes("/*");
    const closes = line.includes("*/");
    const wasInBlock = inBlock;
    if (opens && !closes) inBlock = true;
    else if (closes) inBlock = false;
    return wasInBlock || opens || LINE_COMMENT.test(line);
  });
}
const EXPLANATORY =
  /repriced|moved \$|was\s*≈?\$|used to|long-dead|still quoted|does not exist|→ \$|version of this model|устарев|отставн/i;

/** Суммы сделок и рынков: $29B, $49M. Это не цены. */
const MAGNITUDE_SUFFIX = /^[BMKbmk]/;

/**
 * Один обход на модуль. Оба теста здесь читают всё дерево; без кеша под
 * нагрузкой они выходили за дефолтный таймаут vitest, и сторож падал не по
 * делу. Сторож, который иногда красный без причины, перестают читать.
 */
let corpusCache: Array<{ rel: string; lines: string[] }> | null = null;

function corpus(): Array<{ rel: string; lines: string[] }> {
  if (!corpusCache) {
    corpusCache = walk(SRC_ROOT).map((file) => ({
      rel: path.relative(SRC_ROOT, file).replace(/\\/g, "/"),
      lines: readFileSync(file, "utf8").split("\n"),
    }));
  }
  return corpusCache;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

/** Текущая цена тарифа в реестре — чтобы сообщение об ошибке было полезным. */
function registryPrice(tierId: string): string {
  const src = readFileSync(REGISTRY, "utf8");
  const start = src.indexOf("export const TIERS");
  const end = src.indexOf("export const MODULES_PRICING");
  const slice = src.slice(start, end);
  const m = slice.match(new RegExp(`id:\\s*"${tierId}",[\\s\\S]*?priceMonthly:\\s*([\\d.]+)`));
  return m ? `$${m[1]}` : "(не найдена в реестре)";
}


/**
 * Явный таймаут: это не юнит-тест, а обход ~1000 файлов с чтением каждого.
 * Дефолтные 5 секунд vitest рассчитаны на юниты, и при полном прогоне (54
 * файла параллельно на загруженной машине) обход в них не укладывался —
 * сторож краснел из-за очереди на диск, а не из-за находки. Красный без
 * причины опаснее отсутствующего теста: его начинают пролистывать.
 */
const SWEEP_TIMEOUT_MS = 30_000;

describe("отставные цены тарифов не возвращаются ни на одну поверхность", () => {
  it("сплошной обход фронтенда не находит ни одной", () => {
    const amounts = RETIRED.map((r) => r.amount.replace(".", "\\.")).join("|");
    // $19 — но не $199, не $19.99, не $19B.
    const re = new RegExp(`\\$(${amounts})(?![\\d.,]*[\\dBMKbmk])`, "g");

    const violations: string[] = [];
    for (const { rel, lines } of corpus()) {
      const isComment = commentMask(lines);
      lines.forEach((line, idx) => {
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) {
            if (MAGNITUDE_SUFFIX.test(line.slice(m.index + m[0].length))) continue;
            if (isComment[idx] && EXPLANATORY.test(line)) continue;
            if (ALLOWED.some((a) => line.includes(a.fragment))) continue;
            const retired = RETIRED.find((r) => r.amount === m![1])!;
            violations.push(`${rel}:${idx + 1}  «${line.trim().slice(0, 100)}»  ← $${retired.amount} = ${retired.was}`);
          }
        });
    }

    expect(
      violations,
      `Найдены отставные цены тарифов. Живые цены сейчас: Lite ${registryPrice("lite")}, ` +
        `Medium ${registryPrice("medium")}, Full ${registryPrice("full")}, Universe ${registryPrice("pro")}.\n  ` +
        violations.join("\n  ") +
        `\n\nЕсли это НОВАЯ законная цена с тем же номиналом — допиши строку в ALLOWED ` +
        `с причиной и ссылкой на код, который её списывает. Без причины — это заглушённый сторож.`,
    ).toEqual([]);
  }, SWEEP_TIMEOUT_MS);

  it("каждое исключение действительно что-то исключает", () => {
    // Протухший фрагмент — тихая дыра: он ничего не разрешает, но выглядит как
    // осознанное решение, и следующий человек не станет его перепроверять.
    const all = corpus()
      .map((f) => f.lines.join("\n"))
      .join("\n");
    const dead = ALLOWED.filter((a) => !all.includes(a.fragment)).map((a) => a.fragment);
    expect(
      dead,
      `Эти фрагменты ALLOWED больше не встречаются во фронтенде — удали их, ` +
        `иначе список превращается в свалку:\n  ${dead.join("\n  ")}`,
    ).toEqual([]);
  }, SWEEP_TIMEOUT_MS);
});
