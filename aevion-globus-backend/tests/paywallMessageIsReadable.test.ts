import { describe, it, expect } from "vitest";
import { isModuleEntitled, normalizeTier } from "../src/lib/planGate";

/**
 * Что читает человек, упёршийся в платную стену.
 *
 * Замер на проде 24.09.2026, все пять закрытых модулей отвечали:
 *   requiredTiers: ["full","full","full","full","full","enterprise"]
 *   message: «доступен на тарифах: full, full, full, full, full, enterprise»
 *
 * Причина не в правах, а в отображении: с 15.09 любой платный тариф — доступ ко
 * всей планете, и normalizeTier схлопывает lite/medium/pro/max в «full», а
 * список `includedIn` из шести ступеней превращался в шесть одинаковых слов.
 * Это последний текст перед покупкой, и он выглядел поломкой.
 *
 * Здесь же закреплено ГЛАВНОЕ, что едва не было принято за дефект доступа:
 * подписчик Lite В САМОМ ДЕЛЕ пускается — его план нормализуется тем же
 * правилом. Соседняя запись памяти утверждала обратное как вывод, не как замер.
 */

const план = (tier: string) => ({
  tier: normalizeTier(tier),
  rawTier: tier,
  chosenModules: [] as string[],
  email: "buyer@test.aev",
});

describe("платная стена: доступ и текст", () => {
  it("подписчик Lite ПУСКАЕТСЯ в модуль, обещанный каталогом", () => {
    for (const m of ["multichat-engine", "qai", "qlearn", "qnews", "qfusionai"]) {
      expect(isModuleEntitled(план("lite"), m), `${m} обязан пускать Lite`).toBe(true);
    }
  });

  it("гость НЕ пускается — контроль в другую сторону", () => {
    expect(isModuleEntitled(план("free"), "qai")).toBe(false);
  });

  it("любая платная ступень даёт тот же доступ, что и full", () => {
    for (const t of ["medium", "pro", "max", "full"]) {
      expect(isModuleEntitled(план(t), "qnews"), `${t} обязан пускать`).toBe(true);
    }
  });
});
