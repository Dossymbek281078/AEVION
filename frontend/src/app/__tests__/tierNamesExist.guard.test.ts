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

/** Имена тарифов, которые реально существуют (из реестра бэкенда). */
function liveTierNames(): Set<string> {
  const src = readFileSync(REGISTRY, "utf8");
  const block = src.slice(src.indexOf("export const TIERS"));
  const names = [...block.matchAll(/\n {4}name:\s*"([^"]+)"/g)].map((m) => m[1]);
  return new Set(names);
}

/**
 * Мёртвые имена: были тарифами, тарифами быть перестали. Держим списком, а не
 * «всё, чего нет в реестре»: слово Business встречается в названиях категорий
 * («Business & Legal»), в чужих продуктах (DocuSign Business) и просто в тексте.
 */
const RETIRED_TIER_NAMES = ["Business"];

/** Контекст, в котором слово означает ИМЕННО тариф, а не что-то ещё. */
const TIER_CONTEXT =
  /тариф|tier|подписк|subscription|Free\s*\/|\/\s*Enterprise|плана|\bplan\b|seats|money-back|возврат|residency/i;

/** Чужие продукты со своими тарифами — они не про нас. */
const FOREIGN = /DocuSign|Google Workspace|Dropbox|Notion|Slack|Stripe/i;

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
    expect(files.length).toBeGreaterThan(50);
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
      src.split("\n").forEach((line, i) => {
        if (!TIER_CONTEXT.test(line) || FOREIGN.test(line)) return;
        for (const dead of RETIRED_TIER_NAMES) {
          if (new RegExp(`\\b${dead}\\b`).test(line)) {
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

  /** id тарифа → часы ответа, из реестра. */
  function slaHours(): Record<string, number | null> {
    const src = readFileSync(REGISTRY, "utf8");
    const block = src.slice(src.indexOf("export const TIERS"));
    const out: Record<string, number | null> = {};
    for (const m of block.matchAll(/id:\s*"(\w+)"[\s\S]{0,1400}?supportSlaHours:\s*(\d+|null)/g)) {
      out[m[1]] = m[2] === "null" ? null : Number(m[2]);
    }
    return out;
  }

  test("контроль: часы из реестра прочитались", () => {
    const hours = slaHours();
    expect(Object.keys(hours).length).toBeGreaterThanOrEqual(4);
    expect(hours.enterprise).toBe(1);
    expect(hours.pro).toBe(6);
  });

  test("ни один текст не обещает другого срока", () => {
    const hours = slaHours();
    const bad: string[] = [];

    let seen = 0;
    for (const line of dictLines()) {
      const key = /"(pricing\.tierDetail[^"]+)":/.exec(line)?.[1];
      if (!key) continue;
      seen++;
      const tier = /\.(free|lite|medium|full|pro|enterprise)\./.exec(key)?.[1];
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
