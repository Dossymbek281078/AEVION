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

import { migrateWallet, type WalletState } from "../chessyLedger";

const EMPTY: WalletState = { v: 1, balance: 0, lifetime: 0, streak: 0, welcome: false, owned: {}, ach: {} };

describe("чтение кошелька с диска", () => {
  it("незнакомая версия НЕ стирает кошелёк", () => {
    // именно это и делал прежний загрузчик: v!==1 → пустой кошелёк
    const stored = { v: 7, balance: 340, lifetime: 900, streak: 4, welcome: true, owned: { streak_shield: true }, ach: { first_win: 123 } };
    const w = migrateWallet(stored, EMPTY);
    expect(w.balance).toBe(340);
    expect(w.lifetime).toBe(900);
    expect(w.owned.streak_shield).toBe(true);
    expect(w.ach.first_win).toBe(123);
  });

  it("версия приводится к текущей, чтобы запись не осталась в старом формате", () => {
    expect(migrateWallet({ v: 7, balance: 10 }, EMPTY).v).toBe(1);
  });

  it("испорченный баланс не пролезает, но достижения сохраняются", () => {
    const w = migrateWallet({ v: 1, balance: "много", ach: { first_win: 5 } }, EMPTY);
    expect(w.balance).toBe(0);
    expect(w.ach.first_win).toBe(5);
  });

  it("отрицательный баланс отвергается", () => {
    expect(migrateWallet({ v: 1, balance: -50 }, EMPTY).balance).toBe(0);
  });

  it("пожизненный счёт не может быть меньше баланса", () => {
    expect(migrateWallet({ v: 1, balance: 100, lifetime: 3 }, EMPTY).lifetime).toBe(100);
  });

  it("мусор вместо объекта даёт пустой кошелёк, а не падение", () => {
    for (const junk of [null, undefined, 42, "строка", [1, 2, 3]]) {
      expect(migrateWallet(junk, EMPTY).balance).toBe(0);
    }
  });

  it("owned/ach не массивы: массив вместо словаря отбрасывается", () => {
    const w = migrateWallet({ v: 1, balance: 5, owned: ["a"], ach: 7 }, EMPTY);
    expect(w.owned).toEqual({});
    expect(w.ach).toEqual({});
    expect(w.balance).toBe(5);
  });
});
