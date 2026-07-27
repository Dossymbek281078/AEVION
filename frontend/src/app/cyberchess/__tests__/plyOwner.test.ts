import { describe, it, expect } from "vitest";
import { isPlayerPly, isPlayerIndex } from "../plyOwner";

/* Два счёта полуходов сдвинуты на единицу, и оба пишутся как «%2». Тест держит
   их порознь: он проверяет не формулу, а то, что ply=1 и index=0 — это ОДИН И
   ТОТ ЖЕ первый ход белых. */

describe("кому принадлежит полуход", () => {
  it("ply считается с 1: первый ход белых — это ply 1", () => {
    expect(isPlayerPly(1, "w")).toBe(true);
    expect(isPlayerPly(1, "b")).toBe(false);
    expect(isPlayerPly(2, "b")).toBe(true);
  });

  it("index считается с 0: первый ход белых — это index 0", () => {
    expect(isPlayerIndex(0, "w")).toBe(true);
    expect(isPlayerIndex(0, "b")).toBe(false);
    expect(isPlayerIndex(1, "b")).toBe(true);
  });

  it("ply k+1 и index k — один и тот же ход", () => {
    for (let k = 0; k < 20; k++) {
      expect(isPlayerPly(k + 1, "w")).toBe(isPlayerIndex(k, "w"));
      expect(isPlayerPly(k + 1, "b")).toBe(isPlayerIndex(k, "b"));
    }
  });

  it("у каждого полухода ровно один владелец", () => {
    for (let k = 1; k <= 20; k++) {
      expect(isPlayerPly(k, "w")).not.toBe(isPlayerPly(k, "b"));
    }
  });

  it("перепутанный счёт даёт ровно противоположный ответ — так и выглядела ошибка", () => {
    // спарклайн фильтровал сохранённый ply правилом для индекса
    const asIndexRule = (ply: number, c: "w" | "b") => isPlayerIndex(ply, c);
    for (let ply = 1; ply <= 10; ply++) {
      expect(asIndexRule(ply, "w")).toBe(!isPlayerPly(ply, "w"));
    }
  });
});
