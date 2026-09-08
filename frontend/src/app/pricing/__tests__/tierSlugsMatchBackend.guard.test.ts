import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Список тарифов на витрине совпадает со списком тарифов бэкенда.
 *
 * ЗАЧЕМ. Маршрут /pricing/[tierId] помечает noindex всё, чего нет в своём
 * списке (замер 08.09.2026: любой выдуманный адрес отвечал 200 с полной
 * страницей — бесконечный индексируемый мусор на денежном разделе). Список
 * пришлось держать в самом layout: страница клиентская, а серверный запрос
 * за тарифами уже пробовали 29.08 и откатывали.
 *
 * 🔴 Второй указатель на то же самое расходится молча — и разойдётся в
 * ХУДШУЮ сторону: заведут новый тариф в бэкенде, его страница окажется вне
 * списка и уйдёт из поиска, оставшись при этом продаваемой. Поэтому сверка.
 *
 * ГРАНИЦА. Сверяются ИДЕНТИФИКАТОРЫ, а не цены и не состав: цена живёт в
 * каталоге и меняется отдельно.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const LAYOUT = join(HERE, "../[tierId]/layout.tsx");
const BACKEND_PRICING = join(HERE, "../../../../../aevion-globus-backend/src/data/pricing.ts");

/** Идентификаторы из массива TIERS бэкенда (только он, без BUNDLES). */
function тарифыБэкенда(src: string): string[] {
  const начало = src.indexOf("export const TIERS");
  expect(начало, "в pricing.ts бэкенда нет массива TIERS").toBeGreaterThan(-1);
  const конец = src.indexOf("export const ", начало + 10);
  const блок = src.slice(начало, конец < 0 ? src.length : конец);
  const out: string[] = [];
  const re = /id:\s*"([a-z][a-z-]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(блок))) out.push(m[1]);
  return out;
}

/** Идентификаторы из набора в layout витрины. */
function тарифыВитрины(src: string): string[] {
  const i = src.indexOf("ИЗВЕСТНЫЕ_ТАРИФЫ");
  expect(i, "в layout нет набора ИЗВЕСТНЫЕ_ТАРИФЫ").toBeGreaterThan(-1);
  const блок = src.slice(i, src.indexOf("]", i));
  return [...блок.matchAll(/"([a-z][a-z-]*)"/g)].map((m) => m[1]);
}

describe("неизвестный тариф не индексируется", () => {
  /*
   * Сверка списков закрепляет ФОРМУ, а не следствие: мутация
   * `const известный = true` её переживала — списки-то на месте, а noindex
   * перестаёт ставиться. Поэтому здесь вызывается сама generateMetadata и
   * проверяется её ответ.
   */
  it("выдуманный идентификатор помечается noindex", async () => {
    const { generateMetadata } = await import("../[tierId]/layout");
    const m = await generateMetadata({ params: Promise.resolve({ tierId: "no-such-tier-zzz" }) });
    expect(
      (m.robots as { index?: boolean } | undefined)?.index,
      "страница выдуманного тарифа индексируется — это бесконечный мусор в поиске",
    ).toBe(false);
  });

  it("настоящий тариф индексируется", async () => {
    const { generateMetadata } = await import("../[tierId]/layout");
    const m = await generateMetadata({ params: Promise.resolve({ tierId: "full" }) });
    expect(
      (m.robots as { index?: boolean } | undefined)?.index,
      "живой тариф спрятан от поиска — это потеря денежной страницы",
    ).not.toBe(false);
  });
});

describe("списки тарифов витрины и бэкенда не расходятся", () => {
  const layout = readFileSync(LAYOUT, "utf8");
  const backend = readFileSync(BACKEND_PRICING, "utf8");
  const вБэкенде = тарифыБэкенда(backend);
  const наВитрине = тарифыВитрины(layout);

  it("прибор видит оба списка", () => {
    // без этого «расхождений нет» означало бы «оба пустые»
    expect(вБэкенде.length).toBeGreaterThanOrEqual(4);
    expect(наВитрине.length).toBeGreaterThanOrEqual(4);
    expect(вБэкенде).toContain("full");
    expect(наВитрине).toContain("full");
  });

  it("каждый тариф бэкенда известен витрине", () => {
    const пропущены = вБэкенде.filter((id) => !наВитрине.includes(id));
    expect(
      пропущены,
      "тариф есть в бэкенде, но его страница помечена noindex — он продаётся "
      + "и при этом не попадает в поиск: " + пропущены.join(", "),
    ).toEqual([]);
  });

  it("витрина не знает тарифов, которых нет в бэкенде", () => {
    const лишние = наВитрине.filter((id) => !вБэкенде.includes(id));
    expect(
      лишние,
      "витрина индексирует страницу тарифа, которого в бэкенде нет: " + лишние.join(", "),
    ).toEqual([]);
  });
});
