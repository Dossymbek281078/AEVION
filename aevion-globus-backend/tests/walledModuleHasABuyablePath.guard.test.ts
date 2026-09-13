import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { lemonSqueezySellable } from "../src/data/lemonSqueezyVariants";
import { MODULES_PRICING } from "../src/data/pricing";
import { tiersForModule, normalizeTier, paywallEnabledFor } from "../src/lib/planGate";

/**
 * У КАЖДОГО закрытого модуля должен быть путь, по которому его правда можно
 * купить.
 *
 * Замер на проде 13.09.2026 из публичных ручек (`/api/paywall/policy` и
 * `/api/pricing/checkout/healthz`): стена включена у 6 модулей из 44, и на них
 * пришлось 14 тысяч отказов за 30 дней. Все шесть называют в `requiredTiers`
 * тариф `enterprise` — а товара с таким тарифом НЕТ вовсе: продаются
 * lite/medium/full/planet и девять модулей поштучно.
 *
 * Сегодня это безвредно: рядом с enterprise стоят medium и full, они
 * продаются. Но связь держится на совпадении ДВУХ независимых списков —
 * политики стены и списка настроенных товаров. Сузь кто-нибудь политику
 * модуля до enterprise, и модуль станет непокупаемым МОЛЧА: ручка ответит
 * 402 и предложит оформить тариф, а оформлять будет нечего.
 *
 * Ни один тест этого не ловил, а ежедневный аудит каталога проверяет
 * 16 позиций и НИ ОДНОГО тарифа.
 *
 * Список продаваемого передаётся АРГУМЕНТОМ, а не читается из окружения:
 * тогда отрицательный контроль не требует возни с переменными, а проверка
 * остаётся чистой функцией.
 */
function безПутиКпокупке(продаётсяСписок: string[]): string[] {
  const продаётся = new Set(продаётсяСписок);
  const тарифы = new Set(
    [...продаётся]
      .filter((r) => r.startsWith("tier_"))
      .map((r) => r.slice("tier_".length).replace(/_(monthly|annual)$/, ""))
  );
  const поштучно = new Set([...продаётся].filter((r) => r.startsWith("app_")).map((r) => r.slice("app_".length)));

  return MODULES_PRICING.filter((m) => paywallEnabledFor(m.id))
    .filter((m) => {
      const нужно = tiersForModule(m.id).map(normalizeTier).filter((t) => t !== "free");
      const путьТариф = нужно.some((t) => тарифы.has(t));
      // Второй путь — купить модуль отдельно. В каталоге идентификаторы через
      // дефис, в ссылках товаров через подчёркивание.
      const путьМодуль = поштучно.has(m.id) || поштучно.has(m.id.replace(/-/g, "_"));
      return !путьТариф && !путьМодуль;
    })
    .map((m) => m.id);
}

/** Ровно то, что отдавал прод 13.09.2026: configured 17, missing 0. */
const КАК_НА_ПРОДЕ = [
  "app_constitution", "app_cyberchess", "app_devhub", "app_ip_bureau", "app_qcontract",
  "app_qpaynet", "app_qrenew", "app_qventure", "app_smeta",
  "tier_full_annual", "tier_full_monthly", "tier_lite_annual", "tier_lite_monthly",
  "tier_medium_annual", "tier_medium_monthly", "tier_planet_annual", "tier_planet_monthly",
];

const СОХРАНЕНО: Record<string, string | undefined> = {};

beforeEach(() => {
  СОХРАНЕНО.PAYWALL_MODULES = process.env.PAYWALL_MODULES;
  СОХРАНЕНО.PAYWALL_DISABLED = process.env.PAYWALL_DISABLED;
  // Те же шесть модулей за стеной, что и на проде.
  process.env.PAYWALL_MODULES = "qlearn,healthai,qai,qfusionai,qnews,multichat-engine";
  delete process.env.PAYWALL_DISABLED;
});

afterEach(() => {
  for (const [k, v] of Object.entries(СОХРАНЕНО)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("закрытый модуль обязан быть покупаемым", () => {
  test("проверка не пуста: за стеной кто-то есть", () => {
    // Без этого «нарушений ноль» означало бы «за стеной никого», и сторож был
    // бы вечно зелёным по пустоте, а не по здоровью.
    const заСтеной = MODULES_PRICING.filter((m) => paywallEnabledFor(m.id)).map((m) => m.id);
    expect(заСтеной.length, "за стеной пусто — сторож ничего не проверяет").toBeGreaterThanOrEqual(6);
  });

  test("на состоянии прода непокупаемых нет", () => {
    expect(безПутиКпокупке(КАК_НА_ПРОДЕ)).toEqual([]);
  });

  test("отрицательный контроль: без тарифных товаров модули становятся непокупаемыми", () => {
    // Доказывает, что проверка УМЕЕТ краснеть, а не всегда возвращает пусто.
    const толькоМодули = КАК_НА_ПРОДЕ.filter((r) => !r.startsWith("tier_"));
    const плохие = безПутиКпокупке(толькоМодули);
    expect(плохие.length, "погасили все тарифы, а непокупаемых не нашлось — проверка слепа").toBeGreaterThan(0);
    expect(плохие).toContain("qlearn");
  });

  test("enterprise товаром не подкреплён — зафиксировать, пока это безвредно", () => {
    const всеСсылки = [...lemonSqueezySellable().configured, ...lemonSqueezySellable().missing];
    const естьEnterprise = всеСсылки.some((r) => r.startsWith("tier_enterprise"));
    expect(естьEnterprise, "появился товар enterprise — правило про medium/full можно упростить").toBe(false);
    // И контроль в обратную сторону: список ссылок вообще не пуст.
    expect(всеСсылки.length, "список ссылок пуст — предыдущая проверка ничего не значит").toBeGreaterThan(10);
  });
});
