import { describe, test, expect, vi, afterAll } from "vitest";

/**
 * Старый тариф, проданный через Gumroad, обязан выдаваться — и при покупке, и при продлении.
 *
 * Замер на проде 17.09.2026. После перехода на лестницу сроков (15.09) вебхук Gumroad
 * узнаёт только ступени GUMROAD_PERMALINK_TIER_{LITE..MAX} и позиции витрины. А на проде
 * заданы прежние GUMROAD_PERMALINK_TIER_{LITE,MEDIUM,FULL}_{MONTHLY,ANNUAL} — все шесть
 * ведут на живые товары aevion-lite / aevion-medium / aevion-full. Запуск resolveReference
 * с этими именами давал "unknown": вебхук отвечал 500 unmapped_product, деньги списаны,
 * доступа нет. Снятие товаров с публикации останавливает новые продажи, но не продления.
 *
 * Для Lemon Squeezy этот случай решён (LEGACY_VARIANT_ENV). Здесь — то же для Gumroad.
 *
 * Тонкость: месячный и годовой старый тариф — ОДИН адрес. Период по адресу не узнать,
 * а ошибка дорогая: годовой покупатель с месячной ссылкой теряет доступ через месяц
 * (billingPeriod: tier_lite_monthly = 1 мес, tier_lite_annual = 12). Период решает
 * ПРОВЕРЕННАЯ продажа (recurrence), не решилось — самый короткий, как у лестницы.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const U = (s: string) => `https://aevion.gumroad.com/l/${s}`;
const ПРОД: Record<string, string> = {};
for (const t of ["LITE", "MEDIUM", "FULL"]) {
  for (const p of ["MONTHLY", "ANNUAL"]) ПРОД[`GUMROAD_PERMALINK_TIER_${t}_${p}`] = U(`aevion-${t.toLowerCase()}`);
}
ПРОД.GUMROAD_CONSTITUTION_PRO_PERMALINK = U("pyiaz");
ПРОД.GUMROAD_CONSTITUTION_TEAM_PERMALINK = U("wjvquw");

const прежние: Record<string, string | undefined> = {};
for (const k of [...Object.keys(ПРОД), "GUMROAD_DEFAULT_PERMALINK"]) прежние[k] = process.env[k];
delete process.env.GUMROAD_DEFAULT_PERMALINK;
Object.assign(process.env, ПРОД);
afterAll(() => {
  for (const [k, v] of Object.entries(прежние)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const { __testables } = await import("../src/routes/gumroadWebhook");
const { termMonthsForReference } = await import("../src/lib/payment/billingPeriod");
const узнать = (slug: string) => __testables.resolveReference({ product_permalink: U(slug) });

describe("старый тариф Gumroad выдаётся, а не падает в 500", () => {
  test("контроль: известные товары разрешаются как прежде", () => {
    expect(__testables.resolveReference({ product_permalink: "pyiaz" })).toBe("constitution-pro");
    expect(__testables.resolveReference({ product_permalink: "orcfbo" })).toBe("external");
    expect(__testables.resolveReference({ product_permalink: "zzzzzznet" })).toBe("unknown");
  });

  for (const [слаг, тариф] of [["aevion-lite", "lite"], ["aevion-medium", "medium"], ["aevion-full", "full"]] as const) {
    test(`${слаг}: узнаётся и даёт тариф ${тариф}`, () => {
      const ref = узнать(слаг);
      expect(ref, "вебхук не узнал оплаченный старый тариф").not.toBe("unknown");
      expect(__testables.tierForReference(ref)).toBe(тариф);
      // Короткая форма адреса (301 на aevion-*) пингом не приходит, но и её не терять.
    });

    test(`${слаг}: период решает проверенная продажа, по умолчанию — самый короткий`, () => {
      const ref = узнать(слаг);
      const год = __testables.срокПоПродаже(ref, { recurrence: "yearly" }, undefined);
      const месяц = __testables.срокПоПродаже(ref, { recurrence: "monthly" }, undefined);
      const неясно = __testables.срокПоПродаже(ref, null, undefined);
      expect(termMonthsForReference(год), "годовой покупатель получил не год").toBe(12);
      expect(termMonthsForReference(месяц)).toBe(1);
      expect(termMonthsForReference(неясно), "без проверенной продажи — самый короткий срок").toBe(1);
      expect(__testables.tierForReference(год)).toBe(тариф);
    });
  }

  test("ступень лестницы на том же адресе важнее прежней ссылки", () => {
    process.env.GUMROAD_PERMALINK_TIER_LITE = U("aevion-lite");
    try {
      expect(узнать("aevion-lite")).toBe("tier_lite");
    } finally {
      delete process.env.GUMROAD_PERMALINK_TIER_LITE;
    }
  });
});
