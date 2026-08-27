import { describe, test, expect } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { asPublicTournament } from "../src/routes/cyberchess";
import type { Tournament } from "../src/lib/ecosystemStore";

/**
 * Образец турнира не приносит наружу денег и людей, которых нет.
 *
 * Замер на проде 27.08.2026, `GET /api/cyberchess/upcoming`:
 *
 *   tour_demo_swiss_001  prizePool 250  entries 32  startsAt 28 августа
 *   tour_demo_arena_002  prizePool 100  entries 14  startsAt 30 августа
 *
 * Это ОБРАЗЦЫ, заведённые чтобы раздел не был пустым. Но числа из них видит
 * человек: `bank/_components/ChessWinnings.tsx` печатает призовой фонд
 * отформатированным как деньги. То есть витрина обещала призовой фонд, которого
 * нет, и участников, которых нет, — а после починки дат один из образцов
 * пришёлся ровно на день запуска.
 *
 * Дату образцу освежать можно: он для того и заведён. Придумывать за него
 * деньги — нельзя. Это первый пункт ворот запуска: каждое обещание проверено.
 */

const real: Tournament = {
  id: "tour_real_2026_08_30",
  startsAt: "2026-08-30T17:00:00.000Z",
  format: "Arena · 1+0 · 60 min",
  prizePool: 100,
  entries: 14,
  capacity: 100,
  status: "upcoming",
};

describe("образец не выдумывает призовой фонд и участников", () => {
  test("у образца деньги и люди обнуляются", () => {
    const t = asPublicTournament({ ...real, id: "tour_demo_arena_002" });
    expect(t.prizePool).toBe(0);
    expect(t.entries).toBe(0);
  });

  test("образец назван образцом — читателю не нужно знать наши префиксы", () => {
    // До этой правки отличить образец можно было только по `tour_demo_` в
    // идентификаторе, то есть знанием внутреннего соглашения. Партнёр по API,
    // страница диагностики и наша же страница выигрышей такого знания не имеют.
    expect(asPublicTournament({ ...real, id: "tour_demo_swiss_001" }).demo).toBe(true);
  });

  test("НАСТОЯЩИЙ турнир проходит насквозь — его числа из жизни", () => {
    const t = asPublicTournament(real);
    expect(t.prizePool).toBe(100);
    expect(t.entries).toBe(14);
    expect(t.demo).toBeUndefined();
    expect(t).toEqual(real);
  });

  test("вместимость у образца остаётся — она не обещание, а форма раздела", () => {
    expect(asPublicTournament({ ...real, id: "tour_demo_arena_002" }).capacity).toBe(100);
  });

  test("исходный объект не портится", () => {
    // Список приходит из хранилища; правка на месте испортила бы и запись,
    // которую другой читатель считает настоящей.
    const src: Tournament = { ...real, id: "tour_demo_arena_002" };
    asPublicTournament(src);
    expect(src.prizePool).toBe(100);
  });
});

describe("вид для читателя применён к ОТВЕТУ, а не только написан", () => {
  // Рабочая функция ничего не значит, если её не позвали. Мутация «убрать
  // .map(asPublicTournament) из ответа» проверкой типов и тестами выше НЕ
  // ловилась: механизм собран, части не связаны.
  const src = readFileSync(join(__dirname, "..", "src", "routes", "cyberchess.ts"), "utf8");

  test("/upcoming пропускает список через asPublicTournament", () => {
    const at = src.indexOf('cyberchessRouter.get("/upcoming"');
    expect(at, "не нашёл обработчик /upcoming").toBeGreaterThan(-1);
    const handler = src.slice(at, at + 600);
    // Ищется ВЫЗОВ, а не слово: рядом стоит комментарий, где имя функции тоже
    // упомянуто, и первая версия этой проверки была зелёной на снятых воротах —
    // она находила собственный комментарий.
    expect(handler, "ответ /upcoming отдаёт турниры мимо вида для читателя").toContain(
      ".map(asPublicTournament)",
    );
  });
});
