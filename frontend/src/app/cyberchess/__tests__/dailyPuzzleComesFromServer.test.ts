import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Задача дня — одна на всех, и знает её сервер.
 *
 * 28.08.2026 их было две. Кнопка «☀ Задача дня» в модуле открывала задачу,
 * посчитанную на телефоне из загруженного набора (400 штук), а страница
 * /cyberchess/daily брала задачу с сервера — в тот день li_0m2HH из банка
 * 502 584. Совпасть они не могли.
 *
 * Хуже данных был расклад последствий: решивший в модуле получал +50 Chessy
 * и отметку цели, но в таблицу лидеров не попадал вовсе — решение никуда не
 * отправлялось. Решивший на странице попадал в таблицу, но без награды.
 * Ни один путь не давал целого.
 */
const PAGE = path.join(__dirname, "..", "page.tsx");
const src = fs.readFileSync(PAGE, "utf8");

describe("задача дня приходит с сервера и решение возвращается туда же", () => {
  it("модуль спрашивает серверную задачу дня", () => {
    expect(src).toContain("/api-backend/api/cyberchess-daily/puzzle");
  });

  it("кнопка открывает серверную задачу, а не локально посчитанную", () => {
    expect(src).toContain("srvDaily.fen");
    expect(
      src.includes("const pz=PUZZLES[dailyState.idx];"),
      "локальный выбор задачи дня не должен вернуться",
    ).toBe(false);
  });

  it("решение уходит на сервер — иначе человека нет в таблице лидеров", () => {
    expect(src).toContain("/api-backend/api/cyberchess-daily/solve");
    expect(src, "без userId сервер считает игрока анонимом").toContain("userId:tournamentUserId()");
  });

  it("недоступную задачу дня не подменяют другой", () => {
    expect(src).toContain("srvDailyFailed");
    expect(src).toContain("Задача дня не загрузилась");
  });
});
