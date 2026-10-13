import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hodyashchie } from "../logikaZadachi";
import { PZ_SLOVA, pzT } from "../pzSlova";

/*
 * 🔴 Лёгкая задача объясняет в кадре «чей ход, что найти, как ходить» и считается
 * в разрезе byPost наравне с полной версией.
 *
 * Повод 13.10.2026 (bd, 14 дней по 20 подметкам chess): 56 живых дошли до доски,
 * ходов 0 — ни одного game_progress и ни одной неверной попытки. Лёгкий маршрут
 * слал только puzzle_link_open/first_move/puzzle_solved и в byPost попадал лишь
 * в puzzleSolved. Теперь: подсказка у доски на трёх языках, подсветка фигур с
 * ходом, события game_progress (plies, отПопытки) и puzzle_wrong_move той же
 * формы, что у page.tsx, и surface:"light" на каждом событии маршрута.
 */
const ROUTE = readFileSync(join(process.cwd(), "src/app/cyberchess/p/[id]/route.ts"), "utf8") + readFileSync(join(process.cwd(), "src/app/cyberchess/p/klientSkript.ts"), "utf8");

describe("подсказка в кадре и события byPost у лёгкой задачи", () => {
  it("подсказка «как ходить» есть в словаре на трёх языках (для статуса), в кадр отдельной строкой не ставится", () => {
    for (const l of ["ru", "en", "kk"] as const) expect(pzT(l, "pz.hint"), l).not.toBe("pz.hint");
    expect(/[а-яА-ЯёЁ]/.test(pzT("en", "pz.hint"))).toBe(false);
    expect(PZ_SLOVA.ru["pz.hint"]).toMatch(/фигур/);
    // строка подсказки в кадр НЕ ставится (поправка оркестратора 13.10: кадры bd показали, что условие и «как ходить» уже видны)
    expect(ROUTE).not.toContain("data-cc-hint");
  });

  it("подсветка фигур с ходом: логика отдаёт только фигуры стороны игрока, у которых есть ход", () => {
    // белые: ладья e1 и король g1; чёрный король g8 — у чёрных нет хода, не их очередь
    expect(hodyashchie("6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", "w")).toEqual(["e1", "g1"]);
    expect(hodyashchie("6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", "b")).toEqual([]);
    expect(ROUTE).toContain('mogut.has(k.sq) ? " m" : ""');
    expect(ROUTE).toContain("movable: r.reshena ? [] : hodyashchie(");
  });

  it("🔴 события byPost той же формы, что у полной версии, и surface:light на каждом", () => {
    expect(ROUTE).toContain('type:"game_progress",source:"cyberchess/board"');
    expect(ROUTE).toContain('"отПопытки":false');
    expect(ROUTE).toContain('"отПопытки":true');
    expect(ROUTE).toContain('type:"puzzle_wrong_move",source:"cyberchess/puzzle"');
    expect(ROUTE).toContain('"попытка":popytok');
    const тела = (ROUTE.match(/ev\(\{type:"[a-z_]+"/g) || []).length;
    const сПоверхностью = (ROUTE.match(/surface:"light"/g) || []).length;
    expect(тела, "знаменатель: отправок событий в скрипте").toBeGreaterThanOrEqual(6);
    expect(сПоверхностью, "каждое тело несёт surface:light").toBeGreaterThanOrEqual(тела);
  });
});
