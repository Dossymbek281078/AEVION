import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: счётчик событий по типам считает ДЕНЬ и отделяет НАШИ заходы.
 *
 * Повод 02.10.2026: оркестратору понадобилось daily_open за день. Публичного
 * источника не было — срез по типам жил в закрытой ручке /events/aggregate, токена
 * у окон нет, и число добывалось бы перепиской вместо замера.
 *
 * Проверяется ОТВЕТ РУЧКИ через supertest, а не функция рядом: за прошлую смену
 * трижды зеленели сторожа, проверявшие помощника вместо вывода.
 */

const каталог = mkdtempSync(join(tmpdir(), "aevion-bytype-"));
const ФАЙЛ = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = ФАЙЛ;

// 🔴 ТОЛЬКО динамический импорт, и это не стиль. Статический `import` поднимается
// ВЫШЕ присваивания process.env.EVENTS_FILE, поэтому роутер успевает прочитать путь
// хранилища до подмены и читает боевой файл. Симптом ровно тот, на который я попался:
// «измерено: true», а все счётчики нули — файл-то существует, просто не тот.
const { eventsRouter } = await import("../src/routes/events");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

const событие = (о: {
  ts: string;
  type: string;
  sid?: string;
  path?: string;
}) => JSON.stringify(о);

beforeEach(() => {
  writeFileSync(
    ФАЙЛ,
    [
      // живой человек открыл задачу дня дважды
      событие({ ts: "2026-10-02T08:00:00.000Z", type: "page_view", sid: "живой", path: "/cyberchess" }),
      событие({ ts: "2026-10-02T08:01:00.000Z", type: "daily_open", sid: "живой" }),
      событие({ ts: "2026-10-02T09:00:00.000Z", type: "daily_open", sid: "живой" }),
      // наше окно: метка пробы в адресе первого просмотра
      событие({ ts: "2026-10-02T10:00:00.000Z", type: "page_view", sid: "окно", path: "/cyberchess?c=probe-63" }),
      событие({ ts: "2026-10-02T10:01:00.000Z", type: "daily_open", sid: "окно" }),
      // ДРУГОЙ день — не должен попасть в счёт
      событие({ ts: "2026-10-01T10:00:00.000Z", type: "daily_open", sid: "вчерашний" }),
    ].join("\n") + "\n",
    "utf8",
  );
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
  delete process.env.EVENTS_FILE;
});

describe("счётчик событий по типам", () => {
  test("считает только запрошенный день и отделяет наши", async () => {
    const о = await request(приложение()).get(
      "/api/pricing/events/by-type?day=2026-10-02&types=daily_open",
    );
    expect(о.status).toBe(200);
    expect(о.body.измерено).toBe(true);
    expect(о.body.день).toBe("2026-10-02");
    // три открытия за 02.10: два живых и одно наше. Вчерашнее не считается.
    expect(о.body.поТипу.daily_open.всего, "день отфильтрован неверно").toBe(3);
    expect(о.body.поТипу.daily_open.наши, "наше окно не отделено").toBe(1);
  });

  test("несколько типов разом, и неизвестный тип не роняет ответ", async () => {
    const о = await request(приложение()).get(
      "/api/pricing/events/by-type?day=2026-10-02&types=daily_open,page_view,выдуманный_тип",
    );
    expect(о.status).toBe(200);
    expect(о.body.поТипу.page_view.всего).toBe(2);
    expect(Object.keys(о.body.поТипу), "выдуманный тип не должен появиться в ответе").toEqual([
      "daily_open",
      "page_view",
    ]);
  });

  test("ни одного известного типа — это 4xx, а не 5xx и не ноль", async () => {
    const о = await request(приложение()).get(
      "/api/pricing/events/by-type?day=2026-10-02&types=выдуманный",
    );
    expect(о.status, "неверный запрос обязан быть 4xx: 5xx поднимает людей зря").toBe(400);
  });

  test("в ответе нет ничего личного", async () => {
    const о = await request(приложение()).get("/api/pricing/events/by-type?day=2026-10-02");
    const текст = JSON.stringify(о.body);
    for (const запрещено of ["живой", "окно", "/cyberchess", "probe-63"]) {
      expect(текст, `в ответ утекло «${запрещено}»`).not.toContain(запрещено);
    }
  });

  test("сервер ПРИНИМАЕТ daily_solved и считает его", async () => {
    // 🔴 Это главная проверка для новой пары событий, и вот почему. 29.09 событие
    // завели только на фронте: сервер отвечал 400 «invalid_type», шаг воронки терялся
    // целиком, и выглядело это как «никто не делал». Имя обязано жить в ДВУХ списках —
    // здесь охраняется серверный. Отправку из задачи дня добавляет окно 61; пока её
    // нет, by-type честно покажет ноль, и это значит «фронт ещё не шлёт».
    const приём = await request(приложение())
      .post("/api/pricing/events")
      .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131")
      .send({ type: "daily_solved", source: "cyberchess", sid: "решивший" });
    expect(приём.status, "сервер не принял daily_solved — имя не попало в ALLOWED_TYPES").toBe(204);

    const о = await request(приложение()).get(
      `/api/pricing/events/by-type?day=${new Date().toISOString().slice(0, 10)}&types=daily_solved`,
    );
    expect(о.status).toBe(200);
    expect(о.body.поТипу.daily_solved, "типа нет в списке счётчика").toBeTruthy();
    expect(о.body.поТипу.daily_solved.всего, "принятое событие не посчиталось").toBe(1);
  });

  test("контроль: выдуманный тип сервер по-прежнему НЕ принимает", async () => {
    // Без этого контроля проверка выше зеленела бы и на «принимаем что угодно»,
    // а тогда любой мусор попадал бы в числа отчётов.
    const о = await request(приложение())
      .post("/api/pricing/events")
      .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131")
      .send({ type: "daily_vyigral_milliard", source: "cyberchess" });
    expect(о.status, "сервер принял выдуманный тип").toBe(400);
  });

  test("день по умолчанию — сегодняшний, а не вчерашний", async () => {
    const о = await request(приложение()).get("/api/pricing/events/by-type");
    expect(о.body.день).toBe(new Date().toISOString().slice(0, 10));
  });
});
