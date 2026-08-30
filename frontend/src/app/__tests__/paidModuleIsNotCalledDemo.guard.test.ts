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
 * ⚠️ ПОПРАВКА к первой версии этого файла, проверенная на живом сайте.
 *
 * Сперва здесь стояло: «покупатель читает эту фразу ровно тогда, когда нажимает
 * Купить». Суть верна, МЕСТО было названо неверно. На страницах qcontract и
 * qpaynet кнопки покупки нет вовсе: ни в их поддереве, ни через платную стену
 * (её рендерят 13 других модулей, этих двух среди них нет). Проверено обходом
 * исходников и загрузкой обеих страниц с прода — слов «Купить» и «checkout» в
 * отданной разметке ноль.
 *
 * Настоящее место — ВИТРИНА. `shop/page.tsx` рисует поле `notice` из каталога
 * прямо на карточке товара, рядом с ценой и кнопкой, и у обоих платных оно
 * начинается словами «Демонстрационный режим». Замер на живой /shop:
 * 4 вхождения. То есть противоречие действительно В МОМЕНТ ОПЛАТЫ, но текст
 * другой и живёт в другом файле.
 *
 * Поэтому сторож смотрит на ОБЕ поверхности, и первая из них — витрина:
 * противоречие рядом с кнопкой дороже противоречия на странице описания.
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

/**
 * Товары каталога, у которых ЕСТЬ цена и чья оговорка `notice` начинается со
 * слов про демонстрацию. Это та самая пара, которую человек видит на витрине
 * рядом с кнопкой «Купить».
 */
function pricedWithDemoNotice(): string[] {
  const src = readFileSync(join(SRC, "lib", "products.ts"), "utf8");
  const out: string[] = [];
  const re = /id:\s*"([a-z0-9-]+)"/g;
  const anchors: Array<{ id: string; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) anchors.push({ id: m[1], at: m.index });
  for (let i = 0; i < anchors.length; i += 1) {
    const end = i + 1 < anchors.length ? anchors[i + 1].at : src.length;
    const win = src.slice(anchors[i].at, end);
    if (!/priceUsd:\s*\d+/.test(win)) continue;
    const notice = /notice:\s*[\s\S]{0,40}?"([^"]{0,60})/.exec(win);
    if (notice && /Демонстрацион|Demonstration/.test(notice[1])) out.push(anchors[i].id);
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

  // ── Витрина: то, что человек читает рядом с кнопкой «Купить» ────────────
  const onStorefront = pricedWithDemoNotice();

  test("контроль: витрина действительно печатает оговорку каталога", () => {
    // Без этого проверка ниже стерегла бы поле, которого никто не показывает.
    const shop = readFileSync(join(APP, "shop", "page.tsx"), "utf8");
    expect(shop, "витрина не рисует notice — тогда проверка ниже бессмысленна")
      .toContain("p.notice");
  });

  test("на витрине рядом с ценой нет новых оговорок про демонстрацию", () => {
    const fresh = onStorefront.filter((m) => !KNOWN.includes(m));
    expect(
      fresh,
      `продаётся и тут же названо демонстрацией: ${fresh.join(", ")}`,
    ).toEqual([]);
  });

  test("новых случаев на страницах модулей нет", () => {
    const fresh = offenders.filter((m) => !KNOWN.includes(m));
    expect(fresh, `платит и читает «только демонстрация»: ${fresh.join(", ")}`).toEqual([]);
  });

  test("храповик не протух: всё, что в списке, всё ещё так и есть", () => {
    // Иначе список тихо разрастётся оправданиями для уже починенного.
    // Случай считается закрытым, только когда чист НА ОБЕИХ поверхностях:
    // снять фразу с карточки, оставив её на странице модуля, — это половина.
    const stale = KNOWN.filter((m) => !offenders.includes(m) && !onStorefront.includes(m));
    expect(stale, `уже не нарушают, убрать из списка: ${stale.join(", ")}`).toEqual([]);
  });
});
