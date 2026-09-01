import { describe, test, expect } from "vitest";
import { upgradeDisclosure } from "./kycDisclosure";

const PASSPORT = /passport|national ID/i;

describe("что покупатель читает перед оплатой $19", () => {
  test("заглушка — обещания про паспорт НЕТ и есть предупреждение", () => {
    const d = upgradeDisclosure("stub");
    expect(d.identityStep, "обещан паспорт при неподключённом поставщике").not.toMatch(PASSPORT);
    expect(d.notice, "покупателя не предупредили до оплаты").not.toBeNull();
    expect(String(d.notice)).toMatch(/before paying/i);
  });

  test("заглушка — не выдумываем вендора, у которого «остаются документы»", () => {
    const d = upgradeDisclosure("stub");
    expect(d.vendorNote).not.toMatch(/KYC vendor|retention policy/i);
  });

  test("поставщик подключён — сильная формулировка на месте, предупреждения нет", () => {
    const d = upgradeDisclosure("live");
    expect(d.identityStep).toMatch(PASSPORT);
    expect(d.notice).toBeNull();
  });

  test("спросить не удалось — паспорт НЕ обещаем (это денежный путь)", () => {
    // На значке тарифа «не знаю» давало сдержанное «by request»: занизить
    // доступность безобидно. Здесь человек платит, и цена ошибки обратная.
    const d = upgradeDisclosure(null);
    expect(d.identityStep, "необеспеченное обещание перед оплатой").not.toMatch(PASSPORT);
    expect(d.notice, "пугать отказом из-за собственной неосведомлённости тоже нельзя").toBeNull();
    expect(d.identityStep.length).toBeGreaterThan(20);
  });

  test("три состояния дают три разных текста", () => {
    const seen = new Set((["live", "stub", null] as const).map((m) => upgradeDisclosure(m).identityStep));
    expect(seen.size).toBe(3);
  });

  test("ни одно состояние не оставляет экран пустым", () => {
    for (const m of ["live", "stub", null] as const) {
      const d = upgradeDisclosure(m);
      expect(d.identityStep.trim().length, `пусто при ${m}`).toBeGreaterThan(0);
      expect(d.vendorNote.trim().length, `пусто при ${m}`).toBeGreaterThan(0);
    }
  });
});
