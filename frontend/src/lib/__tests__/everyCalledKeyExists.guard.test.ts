import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * Каждый ключ, который страница ЗОВЁТ, обязан быть в словаре.
 *
 * ЗАЧЕМ. 30.08.2026 рефакторинг вынес 23 584 строки переводов из одного файла в
 * одиннадцать по языкам — и потерял по дороге ЧЕТЫРЕ ключа. Все четыре на
 * денежном пути: экран благодарности после оплаты и экран «оплата недоступна».
 * Человек, только что заплативший, увидел бы вместо благодарности пустоту.
 *
 * Нашлись они потому, что на них СЛУЧАЙНО стояли отдельные сторожа. Остальные
 * 7286 ключей не стерёг никто: потеряйся один — узнали бы от пользователя.
 * Эта проверка закрывает класс целиком.
 *
 * Отсутствие ключа не падает и не предупреждает: `t()` возвращает пустоту или
 * сам ключ, страница отрисовывается, тесты зелёные.
 */

const LIB = join(__dirname, "..");
const APP = join(LIB, "..", "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Ключи словаря: разнесённые по языкам файлы плюс то, что осталось в общем. */
function dictKeys(): Set<string> {
  const keys = new Set<string>();
  const langDir = join(LIB, "i18n-lang");
  for (const f of readdirSync(langDir)) {
    if (!f.endsWith(".ts")) continue;
    for (const m of readFileSync(join(langDir, f), "utf8").matchAll(/"([a-z][a-zA-Z0-9_.]{2,})"\s*:/g)) {
      keys.add(m[1]);
    }
  }
  // Словари бывают и МОДУЛЬНЫЕ: у devhub и шахмат свои (строки лежат рядом с
  // модулем, чтобы не конфликтовать в общем файле на 23 тысячи строк). Не
  // прочитав их, проверка объявила бы потерянными 146 живых ключей.
  for (const f of walk(APP)) {
    if (!basename(f).startsWith("i18n.")) continue;   // без регулярки: путь на Windows с обратной косой
    for (const m of readFileSync(f, "utf8").matchAll(/"([a-z][a-zA-Z0-9_.]{2,})"\s*:/g)) keys.add(m[1]);
  }
  for (const m of readFileSync(join(LIB, "i18n-data.ts"), "utf8").matchAll(/"([a-z][a-zA-Z0-9_.]{2,})"\s*:/g)) {
    keys.add(m[1]);
  }
  return keys;
}

/**
 * Зовущие места. Берём только ключи С ТОЧКОЙ: `t("save")` без точки почти всегда
 * не наш словарь, а локальный помощник или чужая функция с тем же именем.
 * Граница узкая намеренно — широкая дала бы шум, в котором настоящая потеря
 * утонет.
 */
function calledKeys(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const f of walk(APP)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+)"/g)) {
      const list = used.get(m[1]) ?? [];
      list.push(basename(f));
      used.set(m[1], list);
    }
  }
  return used;
}

describe("каждый вызываемый ключ есть в словаре", () => {
  it("контроль: словарь и вызовы прочитаны — иначе сравнение пусто", () => {
    // Без этого пустой разбор дал бы зелёный тест: «ни один ключ не потерян»
    // верно и для нуля ключей.
    expect(dictKeys().size, "словарь не прочитан").toBeGreaterThan(1000);
    expect(calledKeys().size, "вызовы не найдены").toBeGreaterThan(100);
  });

  /**
   * Известная задолженность, найденная этой же проверкой при её написании.
   * `qpaynet.payouts.submit` — подпись кнопки отправки выплаты: зовётся в
   * app/qpaynet/payouts/page.tsx и не существует НИГДЕ, то есть кнопка
   * отрисуется пустой или сырым ключом.
   *
   * Не чиню: qpaynet чужая зона, а подпись кнопки в модуле выплат — не то,
   * что стоит сочинять со стороны. Исключение ИМЕННОЕ: появится второй такой
   * ключ — проверка его поднимет.
   */
  const ИЗВЕСТНЫЙ_ДОЛГ = ["qpaynet.payouts.submit"];

  it("ни один зовущийся ключ не потерян", () => {
    const dict = dictKeys();
    const missing: string[] = [];
    const неПроверяемые: string[] = [];
    for (const [key, files] of calledKeys()) {
      // Ключ, собранный конкатенацией — t("prefix." + переменная), — до нас
      // доезжает приставкой с точкой на конце. Проверить его нельзя: значение
      // известно только во время работы. Молча считать такую приставку
      // ПРОПАВШИМ ключом — ложная тревога, а к красному, которое «всегда
      // такое», привыкают и сторожа отключают.
      //
      // Поэтому такие вызовы не объявляются пропавшими, но и не забываются:
      // они собираются отдельно и печатаются ниже как непроверяемые. Сторож
      // обязан называть, чего он НЕ видит, — иначе зелёный цвет читается как
      // «все ключи на месте», а означает «все, которые я умею разобрать».
      //
      // Найдено 31.08.2026 при сборке: t("qskyway.just." + verifyReason).
      if (key.endsWith(".")) { неПроверяемые.push(`${key} (${[...new Set(files)][0]})`); continue; }
      if (!dict.has(key) && !ИЗВЕСТНЫЙ_ДОЛГ.includes(key)) missing.push(`${key} (${[...new Set(files)].slice(0, 2).join(", ")})`);
    }
    if (неПроверяемые.length) {
      // Не падение: сторож честно называет границу своего охвата.
      console.log(`  ключей собрано из частей и потому НЕ проверено: ${неПроверяемые.length} — ${неПроверяемые.join(", ")}`);
    }
    expect(missing, "ключ зовут, а в словаре его нет — человек увидит пустоту").toEqual([]);
  });
});
