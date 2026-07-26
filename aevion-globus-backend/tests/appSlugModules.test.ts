import { describe, test, expect } from "vitest";
import {
  APP_SLUG_TO_MODULE,
  moduleForAppSlug,
} from "../src/data/lemonSqueezyVariants";
import { MODULES_PRICING, getModulePrice } from "../src/data/pricing";

/**
 * Покупки одиночных приложений живут в таблице `AppSubscription` под слагами
 * (`ip_bureau`, `smeta`, `qpaynet`), а прайс и веер работают с id модулей
 * (`aevion-ip-bureau`, `smeta-trainer`, `qpaynet-embedded`). Опечатка в
 * APP_SLUG_TO_MODULE не роняет ничего — она просто делает веер СЛЕПЫМ к этой
 * покупке, и покупатель видит «веер включается после первой покупки», уже
 * заплатив. Проверяем на реальном каталоге.
 */

describe("app-slug → модуль прайса", () => {
  test("каждый слаг ведёт на существующий модуль", () => {
    const broken = Object.entries(APP_SLUG_TO_MODULE).filter(([, id]) => !getModulePrice(id));
    expect(broken).toEqual([]);
  });

  test("все слаги LS-вариантов app_* покрыты маппингом", () => {
    // Источник истины по слагам — сами ссылки app_* в lemonSqueezyVariants.
    // Если добавили app_qmelanin, а в маппинг не внесли — тест обязан упасть.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "src", "data", "lemonSqueezyVariants.ts"),
      "utf8",
    ) as string;
    const refBlock = src.slice(src.indexOf("export type LemonSqueezyReference"), src.indexOf("const TIER_VARIANT_ENV"));
    const slugs = [...refBlock.matchAll(/"app_([a-z_]+)"/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(5); // защита от «зелёный на пустом парсе»
    const missing = slugs.filter((s) => !APP_SLUG_TO_MODULE[s]);
    expect(missing).toEqual([]);
  });

  test("moduleForAppSlug терпим к регистру и пробелам, но не выдумывает модули", () => {
    expect(moduleForAppSlug(" IP_Bureau ")).toBe("aevion-ip-bureau");
    expect(moduleForAppSlug("нет-такого")).toBeNull();
  });

  test("три слага действительно НЕ равны id модуля — маппинг не декоративный", () => {
    // Если однажды слаги переименуют в id, этот тест напомнит, что маппинг можно
    // выбросить, а не тащить вечно.
    const differing = Object.entries(APP_SLUG_TO_MODULE).filter(([slug, id]) => slug !== id);
    expect(differing.map(([slug]) => slug).sort()).toEqual(["ip_bureau", "qpaynet", "smeta"]);
  });

  test("модули из маппинга платные — иначе веер от них не включится", () => {
    for (const id of Object.values(APP_SLUG_TO_MODULE)) {
      const m = MODULES_PRICING.find((x) => x.id === id)!;
      expect(typeof m.addonMonthly === "number" && (m.addonMonthly as number) > 0, `${id} бесплатный`).toBe(true);
    }
  });
});
