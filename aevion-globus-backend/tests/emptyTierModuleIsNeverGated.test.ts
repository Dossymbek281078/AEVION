import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Модуль без единого тарифа НЕЛЬЗЯ закрывать стеной.
 *
 * Шлюз требует тариф из includedIn. Если список пуст, подходящего тарифа нет
 * ни у кого — отказ получают ВСЕ, включая платящих. Это хуже «бесплатных с
 * 402»: доступа не остаётся вовсе.
 *
 * Латентность и есть опасность: пока стена выключена, дефект невидим, а
 * включается он одной переменной окружения. Проверка стоит здесь, чтобы
 * решение основателя «включить стену» не обернулось отказом всем.
 */

const ПЕРЕМЕННЫЕ = ["PAYWALL_MODULES", "PAYWALL_DISABLED"];

describe("модуль без тарифов не закрывается стеной", () => {
  const было: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ПЕРЕМЕННЫЕ) { было[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ПЕРЕМЕННЫЕ) {
      if (было[k] === undefined) delete process.env[k];
      else process.env[k] = было[k];
    }
  });

  it("контроль: прибор видит закрытие модуля, у которого тарифы ЕСТЬ", async () => {
    const { paywallEnabledFor } = await import("../src/lib/planGate");
    const { MODULES_PRICING } = await import("../src/data/pricing");
    const сТарифами = MODULES_PRICING.find(
      (m: { id: string; includedIn?: string[] }) =>
        (m.includedIn?.length ?? 0) > 0 && !["qcoreai", "qright", "qsign"].includes(m.id),
    );
    expect(сТарифами, "в каталоге нет ни одного модуля с тарифами — проверять нечем").toBeTruthy();
    process.env.PAYWALL_MODULES = сТарифами!.id;
    expect(
      paywallEnabledFor(сТарифами!.id),
      "контроль: модуль С тарифами не закрылся — значит проверка меряет не то",
    ).toBe(true);
  });

  it("модуль с пустым includedIn НЕ закрывается, даже если назван явно", async () => {
    const { paywallEnabledFor } = await import("../src/lib/planGate");
    const { MODULES_PRICING } = await import("../src/data/pricing");
    const безТарифов = MODULES_PRICING.filter(
      (m: { id: string; includedIn?: string[] }) => (m.includedIn?.length ?? 0) === 0,
    );
    expect(
      безТарифов.length,
      "в каталоге не осталось модулей без тарифов — проверка потеряла предмет",
    ).toBeGreaterThan(0);
    for (const m of безТарифов) {
      process.env.PAYWALL_MODULES = m.id;
      expect(
        paywallEnabledFor(m.id),
        `${m.id}: закрыт стеной при пустом списке тарифов — откажут ВСЕМ, включая платящих`,
      ).toBe(false);
    }
  });

  it("звёздочка тоже не закрывает модуль без тарифов", async () => {
    const { paywallEnabledFor } = await import("../src/lib/planGate");
    const { MODULES_PRICING } = await import("../src/data/pricing");
    const без = MODULES_PRICING.find(
      (m: { id: string; includedIn?: string[] }) => (m.includedIn?.length ?? 0) === 0,
    );
    if (!без) return;
    process.env.PAYWALL_MODULES = "*";
    expect(
      paywallEnabledFor(без.id),
      `${без.id}: «закрыть всё» закрыло и модуль без тарифов`,
    ).toBe(false);
  });
});
