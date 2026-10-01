/**
 * Событие «открыл задачу дня» доезжает до сервера, а не теряется по дороге.
 *
 * 🔴 ПОВОД 30.09.2026, день запуска шахмат: пришло 99 человек, задачу дня
 * решил НОЛЬ. Механизм возврата в тот день чинили весь день, и он работает —
 * проверено ручкой, серия 0 → 1. Но почему до него не дошли, сказать было
 * нечем: события «открыл задачу дня» не существовало.
 *
 * ⚠️ И почему этот тест вообще написан. 29.09 я завёл событие ТОЛЬКО на
 * фронте. Сервер отбрасывал его как неизвестный тип, шаг воронки терялся
 * целиком, и снаружи это выглядело исправной работой. Новое имя обязано жить
 * в ДВУХ списках — EventType на фронте и ALLOWED_TYPES здесь, — и проверять
 * это надо запросом к ручке, а не чтением исходников.
 */
import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { eventsRouter } from "../src/routes/events";

const app = express();
app.use(express.json());
app.use("/api/pricing/events", eventsRouter);

describe("событие daily_open", () => {
  test("🔴 сервер его ПРИНИМАЕТ", async () => {
    const r = await request(app)
      .post("/api/pricing/events")
      .send({ type: "daily_open", sid: "probe-61-daily", path: "/cyberchess", source: "cyberchess/goals" });
    expect(
      r.status,
      "сервер не знает типа daily_open — значит событие с фронта теряется молча",
    ).toBeLessThan(400);
  });

  test("контроль: выдуманный тип по-прежнему отвергается", async () => {
    // Без этого первая проверка была бы зелёной и для ручки, принимающей всё.
    const r = await request(app)
      .post("/api/pricing/events")
      .send({ type: "daily_open_выдумка", sid: "probe-61-daily" });
    expect(r.status).toBe(400);
    expect(r.body?.error).toBe("invalid_type");
  });

  test("🔴 принятое событие ВИДНО в выдаче", async () => {
    // Приняли и потеряли — то же самое, что не приняли.
    //
    // ⚠️ Метка УНИКАЛЬНАЯ на каждый прогон, и это не украшение. Первая версия
    // искала просто слово "daily_open" — и осталась зелёной, когда я снял тип
    // из списка сервера: хранилище событий переживает прогон, и в выдаче
    // лежало событие от ПРЕДЫДУЩЕГО, успешного запуска. Мутация это вскрыла:
    // упал один тест вместо двух.
    const метка = `probe-61-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "daily_open", sid: метка, path: "/cyberchess", meta: { channel: "probe-61" } });
    const r = await request(app).get("/api/pricing/events/recent?limit=200");
    expect(r.status).toBe(200);
    expect(
      JSON.stringify(r.body),
      "событие этого прогона в выдаче не найдено",
    ).toContain(метка);
  });
});
