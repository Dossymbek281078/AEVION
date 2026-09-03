import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Каждый ключ словаря, который просят страницы денежной зоны, существует.
 *
 * ЗАЧЕМ. Оба наших переводчика при промахе возвращают САМ КЛЮЧ:
 *
 *     pricingI18n.ts   dict[lang]?.[key] ?? dict.en?.[key] ?? key
 *     i18n.tsx         tbl[lang]?.[key] || tbl["en"]?.[key] || key
 *
 * Падения нет, типы молчат, сборка проходит — человек просто видит на экране
 * `pricing.checkoutSuccess.titlePending` вместо заголовка. На экране ПОСЛЕ
 * ОПЛАТЫ это худшее место из возможных.
 *
 * Класс не теоретический: 02.09.2026 соседнее окно перетащило файл страницы
 * между ветками и привезло ключ, которого у принимающей стороны не было.
 * Поймал это их сторож на отрисовке — но только для ОДНОГО экрана. Здесь
 * проверка статическая и потому широкая: 26 страниц, 744 обращения.
 *
 * ГРАНИЦА. Сторож видит обращения вида `tp("...")` с
 * ЛИТЕРАЛЬНЫМ ключом. Ключ, собранный из переменной (`t(prefix + id)`), он
 * пропустит — это честное «не проверял», а не «там хорошо».
 *
 * ⚠️ У СЛОВАРЯ ЦЕН ТРИ ИСТОЧНИКА, и это стоило мне ложной находки. Первая
 * редакция читала `pricingI18n.ts` и `i18n-lang/*.ts` и объявила пропавшими
 * три ключа страницы миграций — а они лежат в `pricingI18n/sections/`.
 * Сторож, читающий два источника из трёх, требует «починить» работающее.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "..", "..");            // src/
const PAGES = resolve(HERE, "..");                       // src/app/pricing/

/** Весь словарь, из всех источников сразу. */
function словарь(): string {
  const части: string[] = [];
  const en = join(SRC, "lib", "i18n-lang", "en.ts");
  if (existsSync(en)) части.push(readFileSync(en, "utf8"));
  const pr = join(SRC, "lib", "pricingI18n.ts");
  if (existsSync(pr)) части.push(readFileSync(pr, "utf8"));
  const sec = join(SRC, "lib", "pricingI18n", "sections");
  if (existsSync(sec)) {
    for (const f of readdirSync(sec)) {
      if (f.endsWith(".ts")) части.push(readFileSync(join(sec, f), "utf8"));
    }
  }
  return части.join("\n");
}

function страницы(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === "__tests__" || n === "__fixtures__") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...страницы(p));
    else if (n === "page.tsx") out.push(p);
  }
  return out;
}

/** Литеральные ключи, которые страница просит у словаря. */
function ключиСтраницы(src: string): string[] {
  const out: string[] = [];
  // ТОЛЬКО `tp(` — и это не упрощение, а разделение труда.
  //
  // Обращения вида `t("...")` по всему `src/app` уже стережёт
  // `src/lib/__tests__/everyCalledKeyExists.guard.test.ts` (обходит все
  // страницы, читает `i18n-lang`, ведёт список известного долга). Его
  // шаблон — `\bt\(` — до `tp(` не достаёт по устройству, поэтому словарь
  // ЦЕН не проверял никто.
  //
  // Второй сторож на тот же вопрос был бы хуже отсутствия: два списка
  // известного долга расходятся молча, и починка в одном оставляет второй
  // красным. Поэтому здесь ровно непокрытая половина.
  for (const вызов of ['tp("']) {
    let i = 0;
    for (;;) {
      const j = src.indexOf(вызов, i);
      if (j < 0) break;
      const k = src.indexOf('"', j + вызов.length);
      i = j + вызов.length;
      if (k < 0) continue;
      const ключ = src.slice(j + вызов.length, k);
      if (ключ.includes(".") && !ключ.includes(" ") && /^[a-zA-Z][A-Za-z0-9._-]*$/.test(ключ)) {
        out.push(ключ);
      }
      i = k;
    }
  }
  return out;
}

describe("страницы не просят у словаря того, чего в нём нет", () => {
  const текстСловаря = словарь();
  const files = страницы(PAGES);

  test("контроль: страницы и словарь прочитаны", () => {
    expect(files.length, "обход не нашёл страниц — сторож пуст").toBeGreaterThan(10);
    expect(текстСловаря.length, "словарь прочитан пустым").toBeGreaterThan(10000);
  });

  test("контроль: способ отличает существующий ключ от выдуманного", () => {
    // Обе стороны пробой. Иначе «пропавших нет» могло бы значить «мой способ
    // считает существующим что угодно».
    expect(текстСловаря.includes('"error.whatNow"'), "не вижу ключ, который ТОЧНО есть").toBe(true);
    expect(текстСловаря.includes('"pricing.netTakogoKlyucha.xyz"'), "вижу выдуманный ключ").toBe(false);
  });

  test("ни одна страница не просит несуществующий ключ", () => {
    const пропавшие: string[] = [];
    let обращений = 0;
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const ключ of ключиСтраницы(src)) {
        обращений += 1;
        if (!текстСловаря.includes(`"${ключ}"`)) {
          пропавшие.push(`${f.slice(f.indexOf("pricing"))}: ${ключ}`);
        }
      }
    }
    // Знаменатель рядом с ответом: «пропавших 0» из двадцати обращений и из
    // семисот — разные утверждения.
    expect(обращений, "обращений к словарю цен подозрительно мало — разбор сломан").toBeGreaterThan(100);
    expect(
      пропавшие,
      "страница просит ключ, которого в словаре нет: человек увидит на экране " +
        "сам ключ вместо текста, и ни типы, ни сборка этого не заметят",
    ).toEqual([]);
  });
});
