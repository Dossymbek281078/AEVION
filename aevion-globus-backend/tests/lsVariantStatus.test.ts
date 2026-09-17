import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * «Что случится, если это купят» — вопрос, на который до 13.08.2026 нельзя было
 * ответить иначе как покупкой. Соответствие «товар → модуль» держится на
 * переменных Railway, снаружи их не видно.
 *
 * Теперь /api/health отдаёт признаки: у каких ссылок вариант задан. Товар,
 * который продаётся, а здесь `false`, — это будущий отказ на живом покупателе.
 *
 * С 15.09.2026 продаются 30 ссылок: tier_<ступень> и app_<приложение>_<ступень>.
 * Прежние переменные (…_LITE_MONTHLY, …_DEVHUB_STUDIO_PRO) узнаются вебхуком при
 * продлении, но в статусе продаваемого их нет — иначе прежний товар выглядел бы
 * рабочей продажей.
 *
 * Тест держит условия: признак отражает РЕАЛЬНОЕ наличие переменной, и сами
 * идентификаторы наружу не уходят.
 */

async function statusWith(vars: Record<string, string | undefined>) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("LEMON_SQUEEZY_VARIANT_")) delete process.env[k];
  }
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules(); // модуль читает env при вызове, но кэш сбрасываем на всякий
  const mod = await import("../src/data/lemonSqueezyVariants");
  return mod.lemonSqueezyVariantStatus() as Record<string, boolean>;
}

beforeEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("LEMON_SQUEEZY_VARIANT_")) delete process.env[k];
  }
});

describe("видно, какие товары реально можно выдать", () => {
  test("без переменных все признаки false — и это честный ответ, а не поломка", async () => {
    const s = await statusWith({});

    expect(Object.keys(s).length).toBe(30);
    expect(Object.values(s).every((v) => v === false)).toBe(true);
  });

  test("заданная переменная поднимает признак ровно у своей ссылки", async () => {
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_QVENTURE_PRO: "1903059" });

    expect(s.app_qventure_pro).toBe(true);
    // Соседняя ступень того же приложения и та же ступень планеты — не тронуты.
    expect(s.app_qventure_max).toBe(false);
    expect(s.tier_pro).toBe(false);
    expect(s.tier_lite).toBe(false);
  });

  test("прежняя переменная не выдаёт себя за продаваемый товар", async () => {
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_LITE_MONTHLY: "1903060" });
    expect(Object.keys(s)).not.toContain("tier_lite_monthly");
    expect(s.tier_lite, "прежний месячный товар засчитан как ступень Lite").toBe(false);
    expect(Object.values(s).every((v) => v === false)).toBe(true);
  });

  test("идентификаторы вариантов наружу НЕ уходят", async () => {
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_DEVHUB_MAX: "1902349" });

    expect(s.app_devhub_max).toBe(true);
    const dump = JSON.stringify(s);
    expect(dump).not.toContain("1902349");
    expect(Object.values(s).every((v) => typeof v === "boolean")).toBe(true);
  });

  test("контроль: пустая строка не считается заданной переменной", async () => {
    // Иначе «задано» означало бы «переменная существует», а не «есть значение»,
    // и пустая переменная выглядела бы рабочим товаром.
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_QVENTURE_PRO: "   " });

    expect(s.app_qventure_pro).toBe(false);
  });
});
