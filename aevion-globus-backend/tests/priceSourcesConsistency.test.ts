import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getModulePrice, TIERS, BUNDLES, MODULES_PRICING } from "../src/data/pricing";

/**
 * Одна цена — один источник. Сегодня (2026-07-26) в бэкенде живут ТРИ места, где
 * записаны деньги:
 *   1. `data/pricing.ts` — прайс платформы (источник истины);
 *   2. LS-варианты на стороне процессинга (сверяет `scripts/ls-variant-price-drift.js`);
 *   3. `routes/constitutionCheckout.ts` → `TIER_PRICES_USD` — своя копия цены
 *      Constitution, которая реально идёт в `amountCents` платёжного интента.
 *
 * Третье место — прямой риск дрейфа: поменяют `constitution.addonMonthly` в
 * прайсе, витрина покажет новую цену, а Constitution-чекаут выставит старую.
 * Ничего не упадёт — просто спишут не то, что показали. Тот же класс, что
 * «промо считалось двумя способами» (найдено этим же днём).
 *
 * Тест не запрещает разные цены — он требует, чтобы совпадение НЕ РАЗЪЕХАЛОСЬ
 * молча: если цены сознательно разводят, тест обязан упасть и заставить это
 * зафиксировать.
 */

const SRC = join(__dirname, "..", "src", "routes", "constitutionCheckout.ts");

function constitutionPrices(): Record<string, number> {
  const src = readFileSync(SRC, "utf8");
  const block = src.slice(src.indexOf("const TIER_PRICES_USD"), src.indexOf("function lsVariantId"));
  const out: Record<string, number> = {};
  for (const m of block.matchAll(/(pro|team):\s*([0-9.]+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

describe("цены не расходятся между источниками", () => {
  test("парсинг Constitution-цен работает (иначе тест бессмысленен)", () => {
    const p = constitutionPrices();
    expect(Object.keys(p).sort()).toEqual(["pro", "team"]);
    expect(p.pro).toBeGreaterThan(0);
  });

  test("Constitution Pro == цена модуля constitution в прайсе", () => {
    const module = getModulePrice("constitution");
    expect(module, "модуль constitution пропал из прайса").toBeTruthy();
    expect(constitutionPrices().pro).toBe(module!.addonMonthly);
  });

  test("Constitution Team дороже Pro — иначе тарифная сетка бессмысленна", () => {
    const p = constitutionPrices();
    expect(p.team).toBeGreaterThan(p.pro);
  });

  test("годовая цена тарифа = 10 месяцев (заявленные «2 месяца бесплатно»)", () => {
    // На /pricing и в письмах обещано «annual экономит ~16%». Если кто-то
    // поменяет priceAnnualTotal вручную, обещание станет ложным.
    for (const t of TIERS) {
      if (t.priceMonthly == null || t.priceAnnualTotal == null || t.priceMonthly === 0) continue;
      expect(Math.round(t.priceAnnualTotal * 100), `${t.id}: годовая цена != 10 месяцев`).toBe(
        Math.round(t.priceMonthly * 10 * 100),
      );
    }
  });

  /** Реальная скидка бандла против заявленной, в процентных пунктах. */
  function bundleGap(b: (typeof BUNDLES)[number]): number | null {
    const sum = b.modules.reduce((s, id) => {
      const m = MODULES_PRICING.find((x) => x.id === id);
      return s + (typeof m?.addonMonthly === "number" ? m.addonMonthly : 0);
    }, 0);
    if (sum <= 0) return null;
    return (1 - b.priceMonthly / sum) * 100 - b.savingsPercent;
  }

  test("ни один бандл не обещает БОЛЬШЕ, чем даёт", () => {
    // Направление важно. Обещать 8%, а давать 4.8% — это неправда клиенту.
    // Давать больше обещанного — просто консервативный маркетинг (проверяется
    // отдельным тестом ниже, без падения).
    //
    // `fintech-suite` — ЗНАЕМАЯ расходимость на 2026-07-26: обещает 8%, даёт
    // 4.8% ($79 против суммы компонентов $83). Решение о цене за основателем
    // (docs/FAN_DISCOUNTS_2026-07.md §6): либо $76, либо savingsPercent: 5.
    // Список поимённый, чтобы новый бандл с ложной цифрой упал сразу, а этот
    // конкретный не забылся.
    const knownOverstated = new Set(["fintech-suite"]);
    const overstated = BUNDLES.filter((b) => {
      const gap = bundleGap(b);
      return gap != null && gap < -1; // реальная меньше заявленной больше чем на 1 п.п.
    }).map((b) => b.id);
    expect(overstated.sort()).toEqual([...knownOverstated].sort());
  });

  test("бандлы, которые дают БОЛЬШЕ обещанного, зафиксированы (не падение, а учёт)", () => {
    // ip-suite: $29 против суммы $37 = 21.6% при заявленных 20%. Клиента это не
    // обманывает, но 1.6 п.п. отданы молча — основатель вправе либо поднять
    // цифру в бандле, либо цену. Тест держит список актуальным.
    const understated = BUNDLES.filter((b) => {
      const gap = bundleGap(b);
      return gap != null && gap > 1;
    }).map((b) => b.id);
    expect(understated.sort()).toEqual(["ip-suite"]);
  });
});
