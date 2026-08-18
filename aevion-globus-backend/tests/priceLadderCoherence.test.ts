import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TIERS, MODULES_PRICING, BUNDLES, getTier } from "../src/data/pricing";

/**
 * Лестница цен обязана быть выбираемой: у покупателя не должно быть варианта,
 * который хуже другого по всем признакам сразу.
 *
 * 13.08.2026 тарифы снизили ($24/$39/$89/$249.99 → $19/$29/$49/$149), а цены
 * модулей и сборок остались от старой лестницы. 14.08 замер показал, во что это
 * превратилось:
 *
 *   - Fintech Suite стоил $79, а тариф Full — $49, и Full ПРЯМО перечисляет
 *     «Финтех-стек: QTrade, QPayNet, QContract». Сборка давала меньше за больше.
 *   - Она же обещала «−8%», а по частям стек стоил $63: это была не скидка,
 *     а наценка +25%. Ложное число на публичной странице.
 *   - Модуль QPayNet стоил $49 — ровно столько же, сколько ВСЯ платформа.
 *   - Пять модулей стоили в прайсе одно, а в кассе другое: смету собирали по
 *     $19 за Smeta Trainer, а списывалось $49.
 *
 * Ни один из четырёх случаев не падал и не ломал тесты — все они просто тихо
 * стояли на сайте. Поэтому проверка смысловая, а не арифметическая.
 */

const FRONT_PRODUCTS = join(__dirname, "..", "..", "frontend", "src", "lib", "products.ts");

/** Цены, которые реально спишет касса (витрина сайта = ссылки в магазин). */
function storePrices(): Map<string, number> {
  const src = readFileSync(FRONT_PRODUCTS, "utf8");
  const out = new Map<string, number>();
  for (const m of src.matchAll(/\{[^{}]*processor:\s*"lemonsqueezy"[^{}]*\}/gs)) {
    const appId = /appId:\s*"([^"]+)"/.exec(m[0])?.[1];
    const price = /priceUsd:\s*([\d.]+)/.exec(m[0])?.[1];
    if (appId && price) out.set(appId, Number(price));
  }
  return out;
}

const FULL = getTier("full")?.priceMonthly ?? 0;

describe("лестница цен непротиворечива", () => {
  test("контроль: тарифы, модули и сборки вообще прочитались", () => {
    // Пустые списки дали бы зелёный на любом состоянии прайса.
    expect(TIERS.length).toBeGreaterThan(3);
    expect(MODULES_PRICING.length).toBeGreaterThan(10);
    expect(BUNDLES.length).toBeGreaterThan(0);
    expect(FULL).toBeGreaterThan(0);
  });

  /**
   * Известные расхождения, которые НЕЛЬЗЯ починить кодом: цена живёт в кабинете
   * кассы, менять её — рука основателя. Держим поимённо и с тем, что должно
   * произойти, иначе сторож стал бы вечно красным и его перестали бы читать.
   */
  const AWAITING_FOUNDER: Record<string, string> = {
    "smeta-trainer":
      "в кассе $49, но модуль входит в тариф Medium за $29 — покупать отдельно невыгодно всегда. " +
      "Решение: снизить цену в Lemon Squeezy до <$29 либо убрать Smeta из состава Medium.",
    qrenew:
      "в кассе $29, ровно как тариф Medium, который его уже включает. Вскрылось 16.08.2026 при " +
      "сведении прайса с кассой: раньше в прайсе стояло $19 и расхождение прятало эту пару. " +
      "Решение то же: снизить цену в Lemon Squeezy либо убрать QRenew из состава Medium.",
  };

  test("модуль не дороже самого дешёвого тарифа, который его включает", () => {
    // Раньше сравнивали с Full, но это грубо: если модуль входит уже в Medium
    // за $29, то и сравнивать надо с $29. Иначе проверка пропустила бы ровно
    // тот случай, который на витрине и стоит.
    const cheapestTierPrice = (ids: readonly string[]) =>
      ids
        .map((id) => getTier(id)?.priceMonthly)
        .filter((p): p is number => typeof p === "number" && p > 0)
        .sort((a, b) => a - b)[0];

    const over: string[] = [];
    for (const m of MODULES_PRICING) {
      const addon = m.addonMonthly;
      if (typeof addon !== "number") continue;
      const tierPrice = cheapestTierPrice(m.includedIn ?? []);
      if (!tierPrice || addon < tierPrice) continue;
      const line = `${m.id} $${addon} ≥ тариф $${tierPrice}, который его уже включает`;
      if (AWAITING_FOUNDER[m.id]) continue;
      over.push(line);
    }

    expect(over, `модуль отдельно дороже тарифа с ним внутри: ${over.join(", ")}`).toEqual([]);
  });

  test("список «ждёт основателя» не протух — каждый случай ещё настоящий", () => {
    // Исключение, которое уже неверно, опаснее отсутствия проверки: оно молча
    // разрешает то, что давно починили.
    const stale: string[] = [];
    for (const id of Object.keys(AWAITING_FOUNDER)) {
      const m = MODULES_PRICING.find((x) => x.id === id);
      if (!m || typeof m.addonMonthly !== "number") {
        stale.push(`${id}: модуля или его цены больше нет`);
        continue;
      }
      const tierPrice = (m.includedIn ?? [])
        .map((t) => getTier(t)?.priceMonthly)
        .filter((p): p is number => typeof p === "number" && p > 0)
        .sort((a, b) => a - b)[0];
      if (tierPrice && (m.addonMonthly as number) < tierPrice) {
        stale.push(`${id}: расхождение устранено — уберите из AWAITING_FOUNDER`);
      }
    }

    expect(stale, stale.join("; ")).toEqual([]);
  });

  test("ни одна сборка не стоит дороже тарифа, который её содержит", () => {
    // Full объявлен как «вся экосистема», значит содержит любую сборку.
    const over = BUNDLES.filter((b) => b.priceMonthly >= FULL).map(
      (b) => `${b.name} $${b.priceMonthly} ≥ Full $${FULL}`,
    );

    expect(over, `сборка дороже тарифа со всем: ${over.join(", ")}`).toEqual([]);
  });

  test("заявленная скидка сборки — настоящая, а не наценка", () => {
    const priceOf = new Map(MODULES_PRICING.map((m) => [m.id, m.addonMonthly]));
    const wrong: string[] = [];

    for (const b of BUNDLES) {
      const parts = b.modules.reduce((sum, id) => sum + (Number(priceOf.get(id)) || 0), 0);
      expect(parts, `${b.name}: не нашлись цены частей — сторож ослеп`).toBeGreaterThan(0);

      if (b.priceMonthly >= parts) {
        wrong.push(`${b.name}: по частям $${parts.toFixed(2)}, сборкой $${b.priceMonthly} — это наценка`);
        continue;
      }
      const actual = Math.round((1 - b.priceMonthly / parts) * 100);
      // Допуск в 2 пункта: округление, а не расхождение по смыслу.
      if (Math.abs(actual - b.savingsPercent) > 2) {
        wrong.push(`${b.name}: обещает −${b.savingsPercent}%, на деле −${actual}% (части $${parts.toFixed(2)})`);
      }
    }

    expect(wrong, wrong.join("; ")).toEqual([]);
  });

  test("цена модуля в прайсе равна той, что спишет касса", () => {
    const store = storePrices();
    expect(store.size, "цены магазина не прочитались — сторож ослеп").toBeGreaterThan(3);

    const diff: string[] = [];
    for (const [appId, storePrice] of store) {
      const mod = MODULES_PRICING.find((m) => m.id === appId);
      if (!mod || typeof mod.addonMonthly !== "number") continue; // модуля нет в прайсе — это другой вопрос
      if (Math.abs((mod.addonMonthly as number) - storePrice) > 0.01) {
        diff.push(`${appId}: прайс $${mod.addonMonthly}, касса $${storePrice}`);
      }
    }

    expect(
      diff,
      `калькулятор посчитает одно, а спишется другое: ${diff.join("; ")}`,
    ).toEqual([]);
  });
});
