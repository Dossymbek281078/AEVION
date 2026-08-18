import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * «Что случится, если это купят» — вопрос, на который до 13.08.2026 нельзя было
 * ответить иначе как покупкой. Соответствие «товар → модуль» держится на
 * переменных Railway, снаружи их не видно.
 *
 * Теперь /api/health отдаёт признаки: у каких ссылок вариант задан. Товар,
 * который продаётся, а здесь `false`, — это будущий отказ на живом покупателе.
 *
 * Тест держит два условия: признак отражает РЕАЛЬНОЕ наличие переменной, и сами
 * идентификаторы наружу не уходят.
 */

const ENV_KEYS = [
  "LEMON_SQUEEZY_VARIANT_LITE_MONTHLY",
  "LEMON_SQUEEZY_VARIANT_QVENTURE",
  "LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO",
];

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
  return mod.lemonSqueezyVariantStatus();
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("видно, какие товары реально можно выдать", () => {
  test("без переменных все признаки false — и это честный ответ, а не поломка", async () => {
    const s = await statusWith({});

    expect(Object.keys(s).length).toBeGreaterThanOrEqual(16);
    expect(Object.values(s).every((v) => v === false)).toBe(true);
  });

  test("заданная переменная поднимает признак ровно у своей ссылки", async () => {
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_QVENTURE: "1903059" });

    expect(s.app_qventure).toBe(true);
    expect(s.app_qcontract).toBe(false);
    expect(s.tier_lite_monthly).toBe(false);
  });

  test("идентификаторы вариантов наружу НЕ уходят", async () => {
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO: "1902349" });

    const dump = JSON.stringify(s);
    expect(dump).not.toContain("1902349");
    expect(Object.values(s).every((v) => typeof v === "boolean")).toBe(true);
  });

  test("контроль: пустая строка не считается заданной переменной", async () => {
    // Иначе «задано» означало бы «переменная существует», а не «есть значение»,
    // и пустая переменная выглядела бы рабочим товаром.
    const s = await statusWith({ LEMON_SQUEEZY_VARIANT_QVENTURE: "   " });

    expect(s.app_qventure).toBe(false);
  });
});
