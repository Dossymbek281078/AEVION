import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Имя тарифа в тексте для человека обязано существовать в реестре.
 *
 * «Business» — тариф из старой четырёхступенчатой лестницы. С 22.07.2026 его
 * нет: в TIERS шесть записей (Free / Lite / Medium / Full / Universe /
 * Enterprise), а `business` остался лишь техническим алиасом, который
 * provisioning.ts переводит в Full.
 *
 * Аудит 10.08 вычистил его в ОДНОМ месте — в подписи блока доверия. 19.08.2026
 * замер нашёл ещё 24 упоминания в тарифном контексте, и среди них не мелочи:
 *
 *   - политика возврата обещала money-back «на любой платный тариф
 *     (Pro / Business)» — покупатель на Lite не мог понять, распространяется ли
 *     обещание на него;
 *   - раздел безопасности перечислял, каким тарифам доступна локализация данных
 *     в ЕС и РФ, через несуществующее имя;
 *   - SEO-описания обещали «4 тарифа AEVION» при шести.
 *
 * Опасность тут не в опечатке. Обещание, адресованное несуществующему тарифу,
 * нельзя ни выполнить, ни оспорить: адресата нет.
 */

const SRC = path.resolve(__dirname, "../..");
const REGISTRY = path.resolve(SRC, "../../aevion-globus-backend/src/data/pricing.ts");

const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"]);

/**
 * Имена тарифов, которые реально существуют (из реестра бэкенда).
 *
 * ⚠️ РАЗБОР ПЕРЕПИСАН 16.09.2026, и прежний был слеп на пять тарифов из семи.
 * Он искал `\n    name: "..."` внутри TIERS и находил ДВА имени — Free и
 * Enterprise. С лестницей сроков (слово основателя 15.09.2026) платные тарифы
 * строятся функцией `planetTier("lite")`, и литерального поля `name:` у них нет
 * вовсе: имена живут в таблице TERM_NAME. Контроль «в реестре нашлось ≥4 имён»
 * от этого падал — но опаснее другое: будь контроль слабее, сторож считал бы
 * МЁРТВЫМ любое из пяти живых имён сроков.
 *
 * Теперь берём ОБА источника: литеральные объекты (Free / Enterprise) и
 * TERM_NAME. Позиционно, без регулярок, собранных из строк.
 */
function liveTierNames(): Set<string> {
  const src = readFileSync(REGISTRY, "utf8");
  // ⚠️ Срез ДО MODULES_PRICING, а не «до конца файла». Ниже в реестре у модулей
  // есть своё необязательное поле `name:` с тем же отступом в четыре пробела, и
  // без правой границы в «живые имена тарифов» попадали имена МОДУЛЕЙ: замер
  // 16.09.2026 дал 10 имён вместо семи. Прежняя версия этого не замечала,
  // потому что утверждала только «имён не меньше четырёх» — слабое утверждение
  // прятало лишнее так же надёжно, как прятало бы недостающее.
  const start = src.indexOf("export const TIERS");
  const end = src.indexOf("export const MODULES_PRICING");
  const block = src.slice(start, end > start ? end : undefined);
  const literal = [...block.matchAll(/\n {4}name:\s*"([^"]+)"/g)].map((m) => m[1]);
  return new Set([...literal, ...Object.values(termNames(src))]);
}

/** Таблица TERM_NAME реестра: id срока → человеческое имя. */
function termNames(src: string): Record<string, string> {
  const at = src.indexOf("export const TERM_NAME: Record<TermTier, string> = {");
  if (at < 0) return {};
  const open = src.indexOf("{", at);
  const close = src.indexOf("}", open);
  if (open < 0 || close < 0) return {};
  const out: Record<string, string> = {};
  for (const m of src.slice(open + 1, close).matchAll(/(\w+):\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

/**
 * Мёртвые имена: были тарифами, тарифами быть перестали. Держим списком, а не
 * «всё, чего нет в реестре»: слово Business встречается в названиях категорий
 * («Business & Legal»), в чужих продуктах (DocuSign Business) и просто в тексте.
 *
 * «Universe» добавлен 16.09.2026. Это был верхний помесячный тариф (id `pro`,
 * $149/мес); с переходом на лестницу сроков тариф с таким именем перестал
 * существовать — у срока `pro` имя «Pro». Опасность прежняя и та же, что была с
 * Business: обещание, адресованное несуществующему тарифу, нельзя ни выполнить,
 * ни оспорить — адресата нет.
 */
const RETIRED_TIER_NAMES = ["Business", "Universe"];

/** Контекст, в котором слово означает ИМЕННО тариф, а не что-то ещё. */
const TIER_CONTEXT =
  /тариф|tier|подписк|subscription|Free\s*\/|\/\s*Enterprise|плана|\bplan\b|seats|money-back|возврат|residency/i;

/** Чужие продукты со своими тарифами — они не про нас. */
const FOREIGN = /DocuSign|Google Workspace|Dropbox|Notion|Slack|Stripe/i;

/**
 * Где мёртвое имя стоит ЗАКОННО. Порода исключений всего две, и обе узкие.
 *
 * 1. ЗАПИСЬ ЖУРНАЛА ИЗМЕНЕНИЙ. «Отдельная страница на тариф: Free / Lite /
 *    Medium / Full / Universe / Enterprise» — правда о том, что выпустили в
 *    день, когда тариф Universe существовал. Переписать её значит подделать
 *    историю; ровно ту же ставку делает pitchNumbers.guard для чисел.
 * 2. КОММЕНТАРИЙ, ОБЪЯСНЯЮЩИЙ СНЯТИЕ. «Человек, оплативший «Universe» (тариф
 *    снят 15.09.2026), видел у себя «Pro»» — это защита от повторения, а не
 *    обещание. Запрети её — и в коде нельзя будет объяснить, почему имя мёртвое.
 *
 * Оба исключения привязаны к ПРИЗНАКУ, а не к файлу: журнал — к ключу
 * changelog, объяснение — к тому, что строка является комментарием И говорит о
 * снятии. Комментарий БЕЗ слова о снятии по-прежнему ловится: иначе достаточно
 * дописать `//` перед живым обещанием, и оно проедет мимо сторожа — лазейка
 * ровно того вида, ради закрытия которого сторож и написан.
 */
const RETIREMENT_NOTE = /снят|Снят|сняты|Сняты|retired|no longer sold|больше не продаётся/;

/**
 * Маска комментариев по файлу — СОСТОЯНИЕМ, а не по префиксу строки.
 *
 * ⚠️ Первая версия проверяла префикс (`//`, `*`, `/*`) и на этом же и попалась,
 * 16.09.2026: внутри блочного комментария продолжающие строки не начинаются НИ
 * С ЧЕГО. Живой случай — `app/account/page.tsx`, где объяснение снятия тарифа
 * лежит второй строкой блока, и сторож поднял его как нарушение. Тот же урок
 * уже записан в retiredPrices.guard: комментарий отслеживается состоянием.
 */
function маскаКомментариев(lines: string[]): boolean[] {
  let вБлоке = false;
  return lines.map((line) => {
    const открыт = line.includes("/*");
    const закрыт = line.includes("*/");
    const былВБлоке = вБлоке;
    if (открыт && !закрыт) вБлоке = true;
    else if (закрыт) вБлоке = false;
    const t = line.trim();
    return былВБлоке || открыт || t.startsWith("//") || t.startsWith("*");
  });
}

/** Часть идентификатора: буква, цифра, _ или $. */
function частьСлова(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_" || c === "$";
}

/**
 * Упоминается ли имя ЦЕЛИКОМ, а не куском другого слова.
 *
 * Намеренно БЕЗ границы слова: `\b` пишется обратным слэшем, а он теряется на
 * границе вызова и молча становится символом ЗАБОЯ (U+0008) — выражение тогда
 * не совпадает НИ С ЧЕМ, и сторож зеленеет на сломанном коде. В этом файле это
 * уже случалось, разбор — в шапке describe про время ответа ниже.
 */
function упоминаетЦеликом(line: string, name: string): boolean {
  let i = 0;
  for (;;) {
    i = line.indexOf(name, i);
    if (i < 0) return false;
    const до = i > 0 ? line[i - 1] : " ";
    const после = i + name.length < line.length ? line[i + name.length] : " ";
    if (!частьСлова(до) && !частьСлова(после)) return true;
    i += name.length;
  }
}

/**
 * Ловится ли мёртвое имя в этой строке. Вынесено, чтобы у прибора были контроли.
 *
 * `вКомментарии` приходит СНАРУЖИ, из маски по всему файлу: по одной строке
 * этого не определить — см. рассказ у маскиКомментариев выше.
 */
export function нарушение(line: string, dead: string, вКомментарии: boolean): boolean {
  if (!TIER_CONTEXT.test(line) || FOREIGN.test(line)) return false;
  if (!упоминаетЦеликом(line, dead)) return false;
  if (line.includes("changelog.")) return false;
  if (вКомментарии && RETIREMENT_NOTE.test(line)) return false;
  return true;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

describe("имена тарифов в текстах существуют", () => {
  const live = liveTierNames();
  const files = walk(SRC);

  test("контроль: реестр и файлы прочитались", () => {
    // Пустой реестр или пустой обход дали бы зелёный на любом состоянии кода.
    expect(existsSync(REGISTRY)).toBe(true);
    expect(live.size, "в реестре не нашлось имён тарифов").toBeGreaterThanOrEqual(4);
    expect(live.has("Full")).toBe(true);
    // Обе половины разбора живы. Без этих двух строк одна из них может
    // отвалиться молча: прежний разбор читал только литеральные объекты и
    // пропускал все пять имён сроков.
    expect(live.has("Free"), "не прочитались литеральные тарифы (free / enterprise)").toBe(true);
    expect(live.has("Max"), "не прочиталась таблица TERM_NAME (имена сроков)").toBe(true);
    expect(live.size, "семь тарифов: free, пять сроков, enterprise").toBe(7);
    expect(files.length).toBeGreaterThan(50);
  });

  test("контроль прибора: ловит живое обещание и молчит на истории", () => {
    // НАХОДИТ: обычная строка интерфейса, обещающая что-то мёртвому тарифу.
    expect(
      нарушение('  "refund.body": "money-back на любой платный тариф (Pro / Universe)",', "Universe", false),
    ).toBe(true);
    // МОЛЧИТ: запись журнала — правда о том дне, когда тариф был жив.
    expect(
      нарушение(
        '  "pricing.changelog.entry.tierPages.body": "Отдельная страница на тариф: Free / Universe / Enterprise",',
        "Universe",
        false,
      ),
    ).toBe(false);
    // МОЛЧИТ: комментарий, объясняющий снятие тарифа.
    expect(
      нарушение("  // Человек, оплативший «Universe» (тариф снят 15.09.2026), видел у себя «Pro»", "Universe", true),
    ).toBe(false);
    // НО НАХОДИТ комментарий БЕЗ объяснения снятия — иначе достаточно дописать
    // `//` перед живым обещанием, и оно проедет мимо.
    expect(нарушение("  // тариф Universe даёт 10 seats", "Universe", true)).toBe(true);
    // МОЛЧИТ на чужом продукте и вне тарифного контекста.
    expect(нарушение("  desc: 'Notion Business tier',", "Business", false)).toBe(false);
    expect(нарушение("  title: 'Universe of ideas',", "Universe", false)).toBe(false);
  });

  test("контроль прибора: маска видит ПРОДОЛЖЕНИЕ блочного комментария", () => {
    // Ровно этот случай сторож поднял как нарушение 16.09.2026: объяснение
    // снятия тарифа лежит ВТОРОЙ строкой блока, а она не начинается ни с `//`,
    // ни с `*`. По префиксу такую строку комментарием не признать.
    const m = маскаКомментариев([
      "  const x = 1;",
      "  /* Замечание про тариф.",
      "     Человек, оплативший «Universe» (тариф снят 15.09.2026), видел «Pro» */",
      "  const y = 2;",
    ]);
    expect(m).toEqual([false, true, true, false]);
    // Однострочный блок не «открывает» комментарий для следующих строк.
    expect(маскаКомментариев(["/* одна строка */", "  тариф Universe"])).toEqual([true, false]);
  });

  test("контроль: мёртвое имя действительно мертво", () => {
    // Если Business однажды вернут в реестр, сторож обязан замолчать сам,
    // а не продолжать ловить законное имя.
    for (const dead of RETIRED_TIER_NAMES) {
      expect(live.has(dead), `${dead} снова в реестре — уберите его из RETIRED_TIER_NAMES`).toBe(false);
    }
  });

  test("ни одно мёртвое имя не встречается в тарифном контексте", () => {
    const found: string[] = [];

    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const rel = f.slice(SRC.length + 1).replace(/\\/g, "/");
      const lines = src.split("\n");
      const комментарий = маскаКомментариев(lines);
      lines.forEach((line, i) => {
        for (const dead of RETIRED_TIER_NAMES) {
          if (нарушение(line, dead, комментарий[i])) {
            found.push(`${rel}:${i + 1} — «${dead}» (${line.trim().slice(0, 80)})`);
          }
        }
      });
    }

    expect(
      found,
      `тариф с таким именем не существует, обещание некому адресовать:\n  ${found.join("\n  ")}`,
    ).toEqual([]);
  });
});

/**
 * Обещанное время ответа поддержки обязано совпадать с тарифом.
 *
 * ⚠️ ИСТОРИЯ ЭТОГО СТОРОЖА стоит того, чтобы её прочесть, — она про инструмент,
 * а не про код. Сначала он был написан, оказался зелёным и НЕ КРАСНЕЛ на
 * собственной мутации: подмена «6h» на «2h» его не роняла. Отладка показывала,
 * что проверка видит и ключ, и подменённое значение, и верные часы из реестра,
 * а расхождений не находит. Та же логика отдельным node-скриптом расхождение
 * находила. Причину я тогда не нашёл и сторожа СНЯЛ — зелёный за непроделанную
 * работу хуже отсутствия проверки.
 *
 * Причина нашлась через час, в другом файле, при точно таком же симптоме:
 * регулярки я писал через heredoc, где `\b` превращался не в границу слова, а
 * в настоящий символ BACKSPACE (U+0008) внутри выражения. Регулярка требовала
 * в тексте символ забоя и не совпадала никогда — при этом в редакторе выглядела
 * правильной, потому что управляющий символ невидим.
 *
 * Поэтому здесь регулярки записаны БЕЗ границ слова вовсе: разбор идёт
 * построчно и по кодам, а не по хитрому выражению. Сплошной поиск управляющих
 * символов по scripts/, src/ и tests/ показал ровно два места — то и это.
 */
describe("время ответа в текстах совпадает с тарифом", () => {
  // ⚠️ Починено 31.08.2026 при сборке к 10.09.
  //
  // Читался lib/i18n-data.ts — а словарь разбит по языкам 10.08 (ради веса
  // страницы: 1.3 МБ из 2.5 грузились на каждой), и там осталось 3.3 КБ
  // служебных данных. Проверка «ни один текст не обещает другого срока»
  // перебирала пустоту и была ЗЕЛЁНОЙ, ничего не охраняя.
  //
  // Контроля прибора у неё не было — поэтому и не заметили. Теперь есть:
  // ниже отдельная проверка, что ключи tierDetail вообще нашлись.
  const I18N_DIR = path.resolve(SRC, "lib/i18n-lang");
  function dictLines(): string[] {
    const out: string[] = [];
    for (const f of readdirSync(I18N_DIR)) {
      if (!f.endsWith(".ts")) continue;
      out.push(...readFileSync(path.join(I18N_DIR, f), "utf8").split(String.fromCharCode(10)));
    }
    return out;
  }

  /**
   * id тарифа → часы ответа, из реестра.
   *
   * ⚠️ ПЕРЕПИСАНО 16.09.2026, и прежняя версия не находила платные тарифы
   * ВОВСЕ. Она искала `id: "..." … supportSlaHours: N` внутри TIERS; с
   * лестницей сроков платные тарифы строятся `planetTier(id)`, у них нет ни
   * литерального `id:`, ни своего `supportSlaHours` — SLA у всех пяти сроков
   * ОДИН и живёт в PLANET_LIMITS. Контроль «часы прочитались» падал, а сама
   * проверка текстов сверялась с двумя тарифами из семи.
   */
  function slaHours(): Record<string, number | null> {
    const src = readFileSync(REGISTRY, "utf8");
    const block = src.slice(src.indexOf("export const TIERS"));
    const out: Record<string, number | null> = {};
    // Литеральные тарифы — free и enterprise.
    for (const m of block.matchAll(/id:\s*"(\w+)"[\s\S]{0,1400}?supportSlaHours:\s*(\d+|null)/g)) {
      out[m[1]] = m[2] === "null" ? null : Number(m[2]);
    }
    // Пять сроков: SLA общий, из PLANET_LIMITS.
    const общий = planetSlaHours(src);
    for (const id of termIdsInTiers(src)) out[id] = общий;
    return out;
  }

  /** supportSlaHours из PLANET_LIMITS — один на все сроки. */
  function planetSlaHours(src: string): number | null {
    const at = src.indexOf("const PLANET_LIMITS: TierLimits = {");
    if (at < 0) return null;
    const close = src.indexOf("};", at);
    if (close < 0) return null;
    const m = /supportSlaHours:\s*(\d+|null)/.exec(src.slice(at, close));
    if (!m) return null;
    return m[1] === "null" ? null : Number(m[1]);
  }

  /** id сроков, которые реестр ставит в TIERS через planetTier(). */
  function termIdsInTiers(src: string): string[] {
    const start = src.indexOf("export const TIERS");
    const end = src.indexOf("export const MODULES_PRICING");
    if (start < 0 || end < start) return [];
    return [...src.slice(start, end).matchAll(/planetTier\("(\w+)"/g)].map((m) => m[1]);
  }

  test("контроль: часы из реестра прочитались", () => {
    const hours = slaHours();
    expect(Object.keys(hours).length).toBeGreaterThanOrEqual(4);
    expect(hours.enterprise).toBe(1);
    // 8 часов — ФАКТИЧЕСКИЙ общий SLA всех пяти сроков (PLANET_LIMITS). Прежде
    // здесь стояло 6 — SLA помесячного тарифа pro, которого больше нет.
    expect(hours.pro, "SLA срока pro — из PLANET_LIMITS").toBe(8);
    expect(hours.max, "SLA у всех сроков одинаковый").toBe(8);
    // Обе половины разбора: литеральный тариф и тариф-срок.
    expect(hours.free, "у free SLA не обещан").toBeNull();
    expect(Object.keys(hours).sort()).toEqual([
      "enterprise",
      "free",
      "full",
      "lite",
      "max",
      "medium",
      "pro",
    ]);
  });

  test("ни один текст не обещает другого срока", () => {
    const hours = slaHours();
    const bad: string[] = [];

    let seen = 0;
    for (const line of dictLines()) {
      const key = /"(pricing\.tierDetail[^"]+)":/.exec(line)?.[1];
      if (!key) continue;
      seen++;
      const tier = /\.(free|lite|medium|full|pro|max|enterprise)\./.exec(key)?.[1];
      if (!tier) continue;
      const expected = hours[tier];
      if (expected == null) continue;
      if (!/SLA|поддержк|support|қолдау/i.test(line)) continue;

      for (const m of line.matchAll(/(\d+)\s*(?:h |h\.|hour|час|ч |сағат)/gi)) {
        if (Number(m[1]) !== expected) {
          bad.push(`${key}: обещает ${m[1]}ч, тариф ${tier} — ${expected}ч`);
        }
      }
    }

      // Контроль прибора: если ключей tierDetail не нашлось вовсе, проверка
      // ничего не проверила. До 31.08 она читала опустевший файл и была
      // зелёной именно так.
      expect(seen, "ключей pricing.tierDetail не найдено — сторож читает пустоту").toBeGreaterThan(0);
    expect(bad, bad.join("; ")).toEqual([]);
  });
});
