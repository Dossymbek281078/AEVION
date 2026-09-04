import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { allTranslations, FALLBACK_LANG } from "../__tests__/localeSource";

/**
 * Каждый ключ, который зовёт модуль, обязан быть в словаре.
 *
 * ПОВОД (31.08.2026). Вызов `t("ключ")` и сам ключ живут в РАЗНЫХ файлах.
 * Пока мерж идёт по коммитам, они не разлучаются: я меняю оба одним коммитом.
 * Но у платформы есть приём «их вершина + мои файлы» — он берёт файлы
 * ПОИМЁННО. Возьмут страницу и не возьмут словарь — человек увидит на экране
 * голое `qskyway.wait.promise` вместо текста.
 *
 * Почему этого не ловит ничто другое:
 *   tsc            — строка есть, она просто не та;
 *   тесты страницы — отрисовка не падает, текст «какой-то» присутствует;
 *   localeParity   — он сравнивает языки МЕЖДУ СОБОЙ, а тут ключа нет ни в одном.
 *
 * Проверка идёт от ФАКТА вызова в исходниках, а не от списка ключей: список
 * можно забыть пополнить, а вызов — это то, что реально произойдёт у человека.
 */
const DIR = __dirname;
// Берём ТОТ ЖЕ источник, что и штатный сторож localeParity: второй способ
// читать словарь разошёлся бы с первым молча.

function sourcesOfModule(): string[] {
  return readdirSync(DIR)
    .filter((n) => (n.endsWith(".tsx") || n.endsWith(".ts")) && !n.includes(".test."))
    .map((n) => join(DIR, n));
}

const dynamic: string[] = [];

function keysCalledIn(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  // Только ПОЛНОСТЬЮ литеральные ключи. Собранные из кусков —
  // `t("qskyway.just." + reason)` — пропускаем: шаблон схватил бы обрубок
  // "qskyway.just." и объявил его пропавшим ключом. Так и вышло на первом
  // прогоне: единственная находка оказалась ложной, моей же.
  //
  // Пропущенные СЧИТАЕМ и печатаем: охват, о котором не сказано вслух,
  // читается как полный.
  const re = /\bt\(\s*"([a-z][a-zA-Z0-9_.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (after.trimStart().startsWith("+")) { dynamic.push(m[1]); continue; }
    out.push(m[1]);
  }
  return out;
}

describe("вызванный ключ существует в словаре", () => {
  test("ни один t(\"...\") модуля не остался без строки", () => {
    const files = sourcesOfModule();
    // Контроль охвата: пустой список файлов дал бы зелёный результат ни о чём.
    expect(files.length, "исходников модуля не найдено — мерить нечего").toBeGreaterThan(2);

    const called = Array.from(new Set(files.flatMap(keysCalledIn)));
    // Контроль прибора: если вызовов ноль, значит сломан разбор, а не код чист.
    expect(called.length, "ни одного вызова t() не найдено — сломан разбор").toBeGreaterThan(10);

    const tbl = allTranslations();
    const en = new Set(Object.keys(tbl[FALLBACK_LANG] ?? {}));
    // Английский — последний рубеж отката: tbl[lang] || tbl["en"] || key.
    // Ключа нет и там — человек увидит имя ключа.
    const missing = called.filter((k) => !en.has(k)).sort();

    // Граница проверки названа вслух, а не подразумевается.
    if (dynamic.length) {
      console.log("[everyKeyCalledExists] собранных на ходу ключей пропущено: " +
        dynamic.length + " (" + Array.from(new Set(dynamic)).join(", ") + ") — " +
        "их значения проверяются типом, см. verifyReason");
    }

    expect(
      missing,
      "эти ключи зовутся, но их нет в английском словаре — на экране покажется имя ключа: " +
        JSON.stringify(missing.slice(0, 5)),
    ).toEqual([]);
  });
});

/**
 * ДИНАМИЧЕСКИЕ ключи: сторож выше их честно ПРОПУСКАЕТ и печатает счёт.
 *
 * Это правильная граница, но дырка настоящая: `t("qskyway.just." + reason)`
 * собирает ключ из значения, и если словарь его не знает, человек читает на
 * экране сам ключ — «qskyway.just.forged». Ни один греп такого не найдёт,
 * потому что литерала в коде нет.
 *
 * Значения закрыты типом, поэтому список ВЫВОДИТСЯ ИЗ КОДА, а не пишется
 * руками: добавят третью причину — сторож потребует её ключ сам. Руками
 * написанный список был бы второй копией того же знания и разошёлся бы молча.
 *
 * Разбор позиционный, без регулярок: класс символов, собранный из строки,
 * на этой машине уже терял слэши и молча совпадал ни с чем.
 */
describe("динамические ключи модуля покрыты словарём", () => {
  const reasonsFromType = (): string[] => {
    const src = readFileSync(join(DIR, "verifyVerdict.ts"), "utf8");
    const MARK = "export type VerifyReason";
    const i = src.indexOf(MARK);
    if (i === -1) return [];
    const semi = src.indexOf(";", i);
    const body = src.slice(src.indexOf("=", i) + 1, semi);
    return body
      .split("|")
      .map((x) => x.trim())
      .filter((x) => x.startsWith('"') && x.endsWith('"'))
      .map((x) => x.slice(1, -1));
  };

  test("список причин читается из типа, а не задан руками", () => {
    const r = reasonsFromType();
    // Контроль прибора: ноль означал бы, что разбор сломан, а не что причин нет.
    expect(r.length, "причины из VerifyReason не разобраны — сторож ослеп").toBeGreaterThanOrEqual(2);
    expect(r, "ожидались обе известные причины").toContain("tampered");
    expect(r, "ожидались обе известные причины").toContain("forged");
  });

  test("динамический ключ есть везде, где есть его статический сосед", () => {
    // Требуем СОГЛАСОВАННОСТИ, а не полноты. Восемь языков переведены на 1 %,
    // и требовать в них наши ключи значит завести вечно красную проверку —
    // такую отключают в первый же день. Сосед qskyway.just.invalid стоит рядом
    // с причиной в одной строке: где есть он, там обязана быть и причина,
    // иначе человек прочитает половину фразы и сам ключ.
    const SIBLING = "qskyway.just.invalid";
    const table = allTranslations();
    const langs = Object.keys(table).filter((l) => typeof table[l]?.[SIBLING] === "string");

    // Контроль прибора: соседа нет нигде — значит сломан разбор, а не словарь.
    expect(langs.length, "язык-сосед не найден ни разу — сторож ослеп").toBeGreaterThanOrEqual(2);

    const missing: string[] = [];
    let checked = 0;
    for (const reason of reasonsFromType()) {
      for (const lang of langs) {
        checked += 1;
        const v = table[lang]?.["qskyway.just." + reason];
        if (typeof v !== "string" || v.trim() === "") missing.push(lang + ": " + reason);
      }
    }
    expect(checked, "ни одной пары язык-причина не проверено").toBeGreaterThan(0);
    expect(missing, "причина без перевода там, где сосед переведён: " + missing.join(", ")).toEqual([]);
  });
});
