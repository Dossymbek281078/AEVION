import { describe, it, expect } from "vitest";
import { isModuleEntitled } from "../src/lib/planGate";

/**
 * У модуля ДВА имени, и на ступени lite сравнивались они как строки.
 *
 * Слаг кассы уходит в `custom_data.module` на чекауте, оттуда попадает в
 * запись подписки (`chosenModules`), а гейт спрашивает по ID модуля. У
 * `startup_exchange` и `multichat` эти имена РАЗНЫЕ. Соседний путь — подписка
 * на отдельное приложение — имя переводит (`appSubscriptionState` →
 * `appSlugForModuleId`), а этот не переводил: заплативший на lite не был бы
 * опознан.
 *
 * Замер 23.09.2026: сегодня латентно (ни один спорный модуль не в
 * PAYWALL_MODULES), но включение стены — открытое решение основателя, и оно
 * заперло бы уже купивших.
 */

const план = (chosenModules: string[]) => ({
  tier: "lite" as const,
  chosenModules,
  email: "buyer@test.aev",
});

describe("ступень lite опознаёт модуль по обоим его именам", () => {
  it("записан слаг кассы — гейт спрашивает по id и пускает", () => {
    expect(isModuleEntitled(план(["startup_exchange"]), "startup-exchange")).toBe(true);
  });

  it("записан id модуля — тоже пускает", () => {
    expect(isModuleEntitled(план(["startup-exchange"]), "startup-exchange")).toBe(true);
  });

  it("второе расхождение того же класса: multichat", () => {
    expect(isModuleEntitled(план(["multichat"]), "multichat-engine")).toBe(true);
  });

  // Контроль: терпимость к форме имени не должна превратиться в «пускать всех».
  // Без него оба утверждения выше прошли бы и у реализации `return true`.
  it("купленное ДРУГОЕ — не пускает", () => {
    expect(isModuleEntitled(план(["startup_exchange"]), "qright")).toBe(false);
    expect(isModuleEntitled(план([]), "startup-exchange")).toBe(false);
  });
});
