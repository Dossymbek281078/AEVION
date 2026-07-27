import { describe, it, expect } from "vitest";
import { award, canSpend, spend, unlock, type LedgerState } from "../chessyLedger";

const st = (balance: number, ach: Record<string, number> = {}): LedgerState =>
  ({ balance, lifetime: balance, ach });

describe("кошелёк Chessy", () => {
  it("начисление поднимает и баланс, и пожизненный счёт", () => {
    const c = award(st(10), 5);
    expect(c.balance).toBe(15);
    expect(c.lifetime).toBe(15);
  });

  it("списание НЕ трогает пожизненный счёт", () => {
    const c = spend(st(10), 4);
    expect(c.balance).toBe(6);
    expect(c.lifetime).toBe(10);
  });

  it("не хватает — состояние не меняется вовсе", () => {
    const before = st(3);
    const after = spend(before, 10);
    expect(after).toBe(before);
    expect(canSpend(before, 10)).toBe(false);
  });

  it("баланс не уходит в минус даже при двух списаниях подряд", () => {
    // ровно этот случай ломался: решение принималось не по актуальному балансу
    let c = st(10);
    c = spend(c, 7);
    c = spend(c, 7);
    expect(c.balance).toBe(3);
  });

  it("покупка ровно на весь баланс проходит", () => {
    expect(canSpend(st(10), 10)).toBe(true);
    expect(spend(st(10), 10).balance).toBe(0);
  });

  it("достижение выдаётся один раз, сколько ни вызывай", () => {
    let c = st(0);
    c = unlock(c, "first_win", 25, 1);
    const afterFirst = c;
    c = unlock(c, "first_win", 25, 2);
    expect(c).toBe(afterFirst);
    expect(c.balance).toBe(25);
  });

  it("ключ из прототипа не считается уже выданным достижением", () => {
    // `key in obj` нашёл бы constructor/toString и молча съел награду
    const c = unlock(st(0), "constructor", 10, 1);
    expect(c.balance).toBe(10);
    expect(c.ach.constructor).toBe(1);
  });

  it("нулевые и отрицательные суммы ничего не меняют", () => {
    const before = st(10);
    expect(award(before, 0)).toBe(before);
    expect(award(before, -5)).toBe(before);
    expect(canSpend(before, 0)).toBe(false);
    expect(canSpend(before, -1)).toBe(false);
  });
});
