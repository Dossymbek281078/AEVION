import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { eventsRouter, ALLOWED_TYPES } from "../src/routes/events";

/*
 * Сторож: три шага внутри задачи ПРИНИМАЮТСЯ сервером.
 *
 * Класс, от которого он защищает, у меня уже случался: имя события заведено на
 * фронте и не заведено в ALLOWED_TYPES — сервер отвечает 400 `invalid_type`,
 * страница этого не замечает (track() не читает ответ), и шаг теряется молча.
 * Поэтому проверка делает ЗАПРОС К РУЧКЕ и смотрит код, а не читает список.
 */

const app = express();
app.use(express.json());
app.use("/api/pricing/events", eventsRouter);

const НОВЫЕ = ["puzzle_wrong_move", "puzzle_hint", "puzzle_abandon"] as const;

describe("шаги внутри задачи принимаются сервером", () => {
  for (const тип of НОВЫЕ) {
    test(`${тип} принят, а не отбит как invalid_type`, async () => {
      const res = await request(app)
        .post("/api/pricing/events")
        .set("content-type", "application/json")
        .send({ type: тип, sid: `guard-${тип}`, path: "/cyberchess?c=probe-guard&probe=guard",
                meta: { app: "cyberchess", id: "li_075iw", fen: "5r1k/8/8/8/8/8/8/K6k b - - 0 1", попытка: 1 } });
      expect([200, 202, 204]).toContain(res.status);
      expect(String(res.text || "")).not.toMatch(/invalid_type/);
    });
  }

  test("🔴 отрицательный контроль: выдуманное имя ОТБИВАЕТСЯ", async () => {
    const res = await request(app)
      .post("/api/pricing/events")
      .set("content-type", "application/json")
      .send({ type: "puzzle_vydumannoe_sobytie", sid: "guard-neg", path: "/cyberchess" });
    expect(res.status).toBe(400);
    expect(String(res.text || "")).toMatch(/invalid_type/);
  });

  test("имена живут в ALLOWED_TYPES (второй слой к запросу)", () => {
    for (const тип of НОВЫЕ) expect(ALLOWED_TYPES.has(тип)).toBe(true);
    /* Знаменатель: список не должен худеть молча. Число ЗАМЕРЕНО самим
       множеством (30 имён на 12.10.2026), а не посчитано глазами: мой первый
       подсчёт кавычек в исходнике дал 43, потому что внутри блока есть
       комментарии с кавычками, и этот сторож меня на этом поймал. */
    expect(ALLOWED_TYPES.size).toBeGreaterThanOrEqual(30);
  });
});
