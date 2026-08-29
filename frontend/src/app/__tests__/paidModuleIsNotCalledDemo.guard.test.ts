import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Модуль, за который берут деньги, не должен объявлять себя демонстрацией.
 *
 * Замер 29.08.2026. Баннер соответствия ComplianceBanner отрисовывается в
 * layout.tsx девяти модулей, то есть на КАЖДОЙ их странице. Три его варианта —
 * financial, trading, legal — начинаются словами «Только демонстрация»
 * (в оригинале «Demonstration only»). Дальше идёт настоящая правовая оговорка:
 * не является юридической консультацией, не лицензированный банк. Оговорка
 * уместна. Первая фраза — нет: она утверждение не о правовом статусе, а о
 * САМОМ ПРОДУКТЕ.
 *
 * Семь модулей из девяти ничего не стоят, и там эта фраза безвредна. Два
 * продаются:
 *
 *   qcontract  $19 в месяц   вариант legal
 *   qpaynet    $29           вариант financial
 *
 * Покупатель читает «только демонстрация» ровно в тот момент, когда нажимает
 * «Купить», и касса при этом живая. Противоречие в описании стоит недорого;
 * противоречие В МОМЕНТ ОПЛАТЫ стоит покупателя и доверия.
 *
 * Что с этим делать — решение основателя, а не сторожа, потому что развилка
 * продуктовая: либо модуль действительно демонстрация и тогда за него не берут
 * денег, либо он работает и тогда фразу надо снять, оставив правовую оговорку.
 * Поэтому здесь ХРАПОВИК: два известных случая записаны поимённо и ждут
 * решения, а любой НОВЫЙ платный модуль с этой фразой красит сборку сразу.
 *
 * Храповик обязан ужиматься: как только случай починят, его надо убрать из
 * списка — проверка «в списке нет протухших» этого требует.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const SRC = resolve(APP, "..");

/** Ждут решения основателя; список обязан только сокращаться. */
const KNOWN = ["qcontract", "qpaynet"];

/** Варианты баннера, которые объявляют продукт демонстрацией. */
function demoVariants(): string[] {
  const src = readFileSync(join(SRC, "components", "ComplianceBanner.tsx"), "utf8");
  const out: string[] = [];
  const re = /(\w+):\s*\{\s*\r?\n\s*en:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[2].trim().startsWith("Demonstration only")) out.push(m[1]);
  }
  return out;
}

/** Какой вариант баннера отрисовывает модуль (null — баннера нет). */
function bannerVariantOf(moduleDir: string): string | null {
  const layout = join(APP, moduleDir, "layout.tsx");
  if (!existsSync(layout)) return null;
  const text = readFileSync(layout, "utf8");
  if (!text.includes("ComplianceBanner")) return null;
  const m = /variant="([a-z]+)"/.exec(text);
  return m ? m[1] : null;
}

/** Модули каталога, у которых есть цена. Окно режется по СЛЕДУЮЩЕМУ якорю. */
function pricedIds(): string[] {
  const src = readFileSync(join(SRC, "lib", "products.ts"), "utf8");
  const out: string[] = [];
  const re = /id:\s*"([a-z0-9-]+)"/g;
  const anchors: Array<{ id: string; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) anchors.push({ id: m[1], at: m.index });
  for (let i = 0; i < anchors.length; i += 1) {
    const end = i + 1 < anchors.length ? anchors[i + 1].at : src.length;
    const win = src.slice(anchors[i].at, end);
    if (/priceUsd:\s*\d+/.test(win)) out.push(anchors[i].id);
  }
  return out;
}

describe("платный модуль не называет себя демонстрацией", () => {
  const variants = demoVariants();
  const modules = readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name);
  const priced = pricedIds();

  const offenders = modules.filter((m) => {
    const v = bannerVariantOf(m);
    return v !== null && variants.includes(v) && priced.includes(m);
  });

  test("контроль: варианты баннера прочитались", () => {
    // Пустой список сделал бы проверку ниже зелёной при любом состоянии сайта.
    expect(variants.length, `варианты: ${variants.join(", ")}`).toBeGreaterThan(0);
  });

  test("контроль: каталог прочитался и в нём есть платные модули", () => {
    expect(priced.length, `с ценой: ${priced.length}`).toBeGreaterThan(0);
  });

  test("контроль: баннер вообще где-то отрисовывается", () => {
    const withBanner = modules.filter((m) => bannerVariantOf(m) !== null);
    expect(withBanner.length, `с баннером: ${withBanner.join(", ")}`).toBeGreaterThan(0);
  });

  test("новых случаев нет", () => {
    const fresh = offenders.filter((m) => !KNOWN.includes(m));
    expect(fresh, `платит и читает «только демонстрация»: ${fresh.join(", ")}`).toEqual([]);
  });

  test("храповик не протух: всё, что в списке, всё ещё так и есть", () => {
    // Иначе список тихо разрастётся оправданиями для уже починенного.
    const stale = KNOWN.filter((m) => !offenders.includes(m));
    expect(stale, `уже не нарушают, убрать из списка: ${stale.join(", ")}`).toEqual([]);
  });
});
