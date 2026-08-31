import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allAppSlugs, appSlugForModuleId } from "../src/data/lemonSqueezyVariants";

/**
 * Метка возврата из кассы совпадает со слагом права, а не с именем товара.
 *
 * Договор: касса возвращает человека на `/account?purchased=<метка>`, и страница
 * подтверждает покупку, если такая метка есть среди его прав
 * (`GET /api/apps/access` отдаёт слаги вида `qcontract`, `ip_bureau`).
 *
 * Замер 31.08.2026, до того как инструкция ушла основателю. У модуля ТРИ имени,
 * и они не совпадают:
 *
 *     каталог витрины   bureau
 *     реестр модулей    aevion-ip-bureau
 *     слаг права        ip_bureau
 *
 * Поставь в кассе `?purchased=bureau` — и заплативший за Бюро увидит
 * «ждём подтверждения» НАВСЕГДА: право придёт под другим именем, а страница
 * сравнивает буквально. Остальные шесть товаров совпадают случайно, поэтому
 * дефект виден только на одном и только у того, кто заплатил.
 *
 * Этот тест закрепляет договор с той стороны, которая его исполняет: для
 * каждого продаваемого модуля существует слаг права, и именно он должен стоять
 * в адресе возврата. Разойдётся — покраснеет здесь, а не у покупателя.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(HERE, "..", "..", "frontend", "src", "lib", "products.ts");

/** Продаваемые модули витрины: id и appId (id модуля в реестре). */
function soldModules(): Array<{ id: string; appId: string }> {
  const src = readFileSync(CATALOG, "utf8");
  const anchors = [...src.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => ({
    id: m[1],
    at: m.index ?? 0,
  }));
  const out: Array<{ id: string; appId: string }> = [];
  for (let i = 0; i < anchors.length; i += 1) {
    const end = i + 1 < anchors.length ? anchors[i + 1].at : src.length;
    const win = src.slice(anchors[i].at, end);
    if (!/priceUsd:\s*\d/.test(win)) continue;
    const kind = /kind:\s*"([a-z]+)"/.exec(win);
    if (kind && kind[1] !== "module") continue;
    const app = /appId:\s*"([a-z0-9_-]+)"/.exec(win);
    out.push({ id: anchors[i].id, appId: app ? app[1] : anchors[i].id });
  }
  return out;
}

describe("метка возврата совпадает со слагом права", () => {
  const sold = soldModules();
  const slugs = allAppSlugs();

  test("контроль: каталог прочитан и слаги прав получены", () => {
    // Пустые списки сделали бы проверки ниже зелёными при любом состоянии.
    expect(sold.length, `продаваемых модулей: ${sold.map((s) => s.id).join(", ")}`)
      .toBeGreaterThanOrEqual(5);
    expect(slugs.length, `слагов прав: ${slugs.length}`).toBeGreaterThanOrEqual(5);
  });

  test("у каждого продаваемого модуля есть слаг права", () => {
    // Иначе покупку нечем подтвердить: страница сравнивает метку со слагом.
    // Перевод спрашиваем у штатной таблицы, а не угадываем по форме имени.
    // Первая редакция сравнивала строки сама и записала Бюро в сироты, хотя
    // слаг у него есть — просто называется ip_bureau, а модуль
    // aevion-ip-bureau. Догадка о форме имени тут работает ровно до первого
    // псевдонима.
    const orphans = sold.filter((s) => appSlugForModuleId(s.appId) === null);
    expect(
      orphans.map((s) => `${s.id} (модуль ${s.appId})`),
      "модуль продаётся, а слага права у него нет — подтвердить покупку нечем",
    ).toEqual([]);
  });

  test("имя товара НЕ всегда годится как метка возврата", () => {
    // Ради этого тест и написан: у части товаров имя каталога и слаг права
    // расходятся, и подставить первое в адрес возврата значит никогда не
    // подтвердить покупку. Проверка фиксирует, что расхождение существует —
    // если оно исчезнет, инструкцию можно упростить, и это надо заметить.
    const mismatched = sold.filter((s) => appSlugForModuleId(s.appId) !== s.id);
    expect(
      mismatched.length,
      "расхождений больше нет — инструкцию по возврату можно упростить до имени товара",
    ).toBeGreaterThan(0);
  });
});
