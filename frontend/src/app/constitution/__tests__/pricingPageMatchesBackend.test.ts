import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Витрина «Конституции» продаёт ПРЯМЫМИ ссылками на Gumroad, а цены на ней
 * написаны руками. Два числа и две ссылки живут в трёх файлах и держатся
 * вместе только вниманием — то есть не держатся.
 *
 * Чем это кончается (проверено 29.08.2026 на бэкенде, где тот же класс был
 * настоящим дефектом): покупатель одного тарифа уходит на товар другого, то
 * есть платит не ту цену за не тот продукт. Ошибка не падает и не видна в
 * журналах — заметит её только человек, которому пришёл чужой счёт.
 *
 * Источники правды здесь:
 *   цена   — CONSTITUTION_TIERS в бэкенде (`data/pricing.ts`);
 *   товар  — таблица вебхука (`gumroadWebhook.ts`), где ссылка Gumroad
 *            сопоставлена тарифу. Именно по ней выдаётся доступ после оплаты,
 *            поэтому она и есть настоящий ответ на вопрос «что это за товар».
 *
 * Разбор позиционный, без регулярок, собранных из строк: такие теряют
 * обратные слэши на границе вызова и молча находят ноль.
 */

const root = join(__dirname, "..", "..", "..", "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

const page = read("frontend/src/app/constitution/pricing/page.tsx");
const pricing = read("aevion-globus-backend/src/data/pricing.ts");
const webhook = read("aevion-globus-backend/src/routes/gumroadWebhook.ts");

/** Значение поля внутри блока тарифа на витрине. */
function fieldAfterTier(tier: string, field: string): string {
  const at = page.indexOf(`id: "${tier}"`);
  expect(at, `на витрине нет блока тарифа ${tier}`).toBeGreaterThan(-1);
  const window = page.slice(at, at + 2000);
  const k = window.indexOf(`${field}: "`);
  expect(k, `у тарифа ${tier} нет поля ${field}`).toBeGreaterThan(-1);
  const from = k + field.length + 3;
  return window.slice(from, window.indexOf('"', from));
}

/** Цена тарифа из источника правды бэкенда. */
function backendPrice(tier: string): number {
  const at = pricing.indexOf(`${tier}: { name:`);
  expect(at, `в CONSTITUTION_TIERS нет тарифа ${tier}`).toBeGreaterThan(-1);
  const window = pricing.slice(at, at + 200);
  const k = window.indexOf("priceUsd:");
  const digits = window.slice(k + 9).trim();
  return Number.parseInt(digits, 10);
}

/** Ссылка товара Gumroad, сопоставленная тарифу в таблице вебхука. */
function permalinkFor(reference: string): string {
  const at = webhook.indexOf(`: "${reference}"`);
  expect(at, `в таблице вебхука нет ${reference}`).toBeGreaterThan(-1);
  const lineStart = webhook.lastIndexOf("\n", at) + 1;
  return webhook.slice(lineStart, at).trim();
}

describe("витрина «Конституции» не расходится с бэкендом", () => {
  test.each([
    ["pro", "constitution-pro"],
    ["team", "constitution-team"],
  ])("тариф %s: цена и товар совпадают с источниками правды", (tier, reference) => {
    const shown = fieldAfterTier(tier, "price");
    const real = backendPrice(tier);
    expect(shown, `витрина показывает ${shown}, а расчёт идёт по $${real}`).toBe(`$${real}`);

    const href = fieldAfterTier(tier, "ctaHref");
    const expected = permalinkFor(reference);
    expect(
      href,
      `кнопка тарифа ${tier} ведёт на ${href}, а доступ за этот тариф выдаётся по товару ${expected}`,
    ).toContain(`/l/${expected}`);
  });

  test("тарифы ведут на РАЗНЫЕ товары", () => {
    expect(fieldAfterTier("pro", "ctaHref")).not.toBe(fieldAfterTier("team", "ctaHref"));
  });
});
