// Единственная ручка модуля событий БЕЗ входа писала в базу без предела.
//
// НАЙДЕНО 28.08.2026 сплошным проходом по 217 таблицам бэкенда: где есть
// INSERT, но нет чтения содержимого. "QEventShare" оказалась в списке — и
// разбор показал не просто мёртвые данные, а открытую запись:
//
//   POST /me/events        401 без токена
//   DELETE /me/events/:id  401 без токена
//   POST /events/:id/rsvp  401 без токена
//   POST /events/:id/waitlist  401 без токена
//   POST /events/:id/share ← отвечает ВСЕМ, ограничителя не было
//
// Каждый вызов писал строку, а SELECT по этой таблице в коде нет ни одного.
// То есть любой мог неограниченно наращивать платную базу данными, которые
// никому не пригодятся.

import { describe, expect, test, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

let inserts = 0;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      const q = String(sql);
      if (q.includes('INSERT INTO "QEventShare"')) {
        inserts++;
        return { rows: [] };
      }
      if (q.includes('FROM "QEvent"')) return { rows: [{ id: "ev-1" }] };
      return { rows: [] };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    })),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { qeventsRouter } from "../src/routes/qevents";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/qevents", qeventsRouter);
  return a;
};

const share = () => request(app()).post("/api/qevents/events/ev-1/share").send({});

beforeEach(() => {
  inserts = 0;
});

describe("анонимная запись ограничена", () => {
  test("контроль: первое обращение проходит", async () => {
    // Если бы предел срабатывал сразу, проверка ниже была бы зелёной и не
    // значила бы ничего.
    const r = await share();
    expect(r.status).not.toBe(429);
  });

  test("поток обращений упирается в 429, а записей заметно меньше обращений", async () => {
    // Обе проверки в ОДНОМ тесте намеренно: ограничитель хранит состояние
    // между тестами (общий бакет по ключу), поэтому к следующему тесту он уже
    // исчерпан и записей не будет вовсе. Первая версия набора разносила их по
    // двум тестам, и контроль «хоть что-то записалось» это поймал.
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) codes.push((await share()).status);
    expect(codes, `коды: ${[...new Set(codes)].join(", ")}`).toContain(429);
    expect(inserts, `записей ${inserts} на 40 обращений`).toBeLessThan(40);
    // Контроль в другую сторону: ручка вообще пишет. Иначе набор проходил бы
    // и на сломанной, которая не пишет никогда.
    expect(inserts).toBeGreaterThan(0);
  });

  test("после отказа запись в базу больше НЕ идёт", async () => {
    // Главное свойство: предел должен останавливать именно запись, а не просто
    // менять код ответа. Иначе таблица растёт по-прежнему.
    for (let i = 0; i < 40; i++) await share();
    const afterFlood = inserts;
    await share();
    await share();
    expect(inserts, `записей было ${afterFlood}, стало ${inserts}`).toBe(afterFlood);
  });

});

describe("остальные ручки модуля закрыты входом", () => {
  const guarded: Array<[string, "post" | "delete", string]> = [
    ["создание события", "post", "/api/qevents/me/events"],
    ["удаление события", "delete", "/api/qevents/me/events/ev-1"],
    ["RSVP", "post", "/api/qevents/events/ev-1/rsvp"],
    ["лист ожидания", "post", "/api/qevents/events/ev-1/waitlist"],
  ];

  test.each(guarded)("%s без токена — 401", async (_n, method, path) => {
    // Закрепляем границу: эти четыре ограничены входом, и потому ограничителя
    // им не добавлял. Откроют любую из них — тест напомнит, что предела нет.
    const r = await request(app())[method](path).send({});
    expect(r.status).toBe(401);
  });
});
