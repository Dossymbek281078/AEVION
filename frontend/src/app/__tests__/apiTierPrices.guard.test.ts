/**
 * Сторож цен API-тарифов (Developer / Build / Scale / Enterprise).
 *
 * ЗАЧЕМ. У API своя лестница, отдельная от подписок платформы: она живёт в
 * `aevion-globus-backend/src/routes/apiQuotas.ts` и отдаётся МАШИНАМ на
 * `/api/quotas` — на него ссылается /launch-status и его читают в примерах
 * curl. То есть у этих цифр есть публичный машиночитаемый ответ, с которым
 * страницы обязаны совпадать.
 *
 * 10.08.2026 не совпадали: `/developers/fintech/rate-limits` и
 * `/fintech/compare` печатали Scale за $199, при $249 в реестре и на
 * `/pricing/api-pricing`. Разработчик, сверивший таблицу с ответом
 * эндпоинта, получал два разных числа — и оба выглядели официально.
 *
 * Проверка позитивная: цена реестра ДОЛЖНА присутствовать на каждой
 * поверхности. Так ловится и возврат старого числа, и молчаливое удаление
 * строки тарифа.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FRONTEND_ROOT = path.resolve(__dirname, "../../..");
const API_QUOTAS = path.resolve(
  FRONTEND_ROOT,
  "../aevion-globus-backend/src/routes/apiQuotas.ts",
);

/** id тарифа → цена в USD/мес из реестра (null у enterprise — «по запросу»). */
function registryApiPrices(): Record<string, number | null> {
  const src = readFileSync(API_QUOTAS, "utf8");
  const out: Record<string, number | null> = {};
  const re = /id:\s*"([a-z]+)",[\s\S]{0,200}?priceUsdMonthly:\s*([\d.]+|null)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out[m[1]] = m[2] === "null" ? null : Number(m[2]);
  }
  return out;
}

/** Поверхности, печатающие эту лестницу вручную. */
const SURFACES = [
  "src/app/developers/fintech/rate-limits/page.tsx",
  "src/app/fintech/compare/page.tsx",
  "src/app/pricing/api-pricing/page.tsx",
];

describe("цены API-тарифов совпадают с реестром квот", () => {
  it("реестр читается и держит известные тарифы", () => {
    const tiers = registryApiPrices();
    expect(Object.keys(tiers).sort()).toEqual(["build", "developer", "enterprise", "scale"]);
    expect(tiers.developer).toBe(0);
    expect(tiers.enterprise).toBeNull();
  });

  for (const rel of SURFACES) {
    it(`${rel} печатает цены из реестра`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      const tiers = registryApiPrices();
      for (const id of ["build", "scale"] as const) {
        const price = tiers[id];
        expect(price, `${id} пропал из apiQuotas.ts`).toBeTypeOf("number");
        expect(
          src.includes(`$${price}`),
          `${rel} не содержит цену тарифа ${id} ($${price} по ` +
            `aevion-globus-backend/src/routes/apiQuotas.ts, он же ответ /api/quotas). ` +
            `Если цена изменилась — правь реестр и все ${SURFACES.length} поверхности; ` +
            `если тариф убрали — убери его и здесь.`,
        ).toBe(true);
      }
    });
  }
});
