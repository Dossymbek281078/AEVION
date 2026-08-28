import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Ссылка, которую не удалось сохранить, обязана СКАЗАТЬ об этом.
 *
 * Замер 28.08.2026, найдено в собственном коде того же дня. Накануне ссылку
 * научили жить в базе, но запасной путь оставили прежним: без базы токен
 * ложится в память, а ответ всё так же обещает срок действия на сутки вперёд
 * и ничем не отличается от настоящего сохранения.
 *
 * Последствие тихое и обидное: владелец отправляет ссылку, сервер
 * перезапускается (на проде это несколько раз в день), а получатель видит
 * «владелец отозвал доступ, или истёк срок» — хотя не случилось ни того, ни
 * другого. Виноватым выглядит отправитель.
 *
 * Чинится не отказом: внутри одного процесса ссылка работает, и ронять её
 * незачем. Меняется ровно одно — молчание. Признак `durable` считается ДО
 * записи и не имеет значения по умолчанию.
 */

const h = vi.hoisted(() => ({ dbReady: true, inserted: [] as string[] }));

vi.mock("../src/lib/ensureQCoreTables", () => ({
  ensureQCoreTables: async () => {},
  isDbReady: () => h.dbReady,
  getDbError: () => (h.dbReady ? null : "database unavailable"),
}));

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      if (s.trimStart().toUpperCase().startsWith("INSERT") && s.includes("QCoreSessionInvite")) {
        h.inserted.push(String(params?.[3] ?? ""));
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
}));

// Подменяем ТОЛЬКО поиск сессии: без базы она живёт в памяти процесса, а
// создаётся не через отдельную ручку. Предмет проверки — признак долговечности
// ссылки — остаётся настоящим.
vi.mock("../src/services/qcoreai/store", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    getSession: async () => ({ id: "s1", userId: "owner", title: "Разбор", mode: "council" }),
  };
});

vi.mock("../src/lib/authJwt", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, verifyBearerOptional: () => ({ sub: "owner" }) };
});

import { qcoreaiRouter } from "../src/routes/qcoreai";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qcoreaiRouter);
  return a;
}

const create = () => request(app()).post("/x/sessions/s1/collab").send({});

describe("ссылка совместного просмотра честна о своей долговечности", () => {
  test("база на месте: ссылка сохранена и объявлена долговечной", async () => {
    h.dbReady = true;
    const before = h.inserted.length;
    const res = await create();

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.durable, "сохранённая ссылка обязана называться долговечной").toBe(true);
    expect(res.body.note, "при живой базе оговорки быть не должно").toBeUndefined();
    // Прирост, а не длина: иначе утверждение зелено от записи соседнего теста.
    expect(h.inserted.length - before, "запись в базу не ушла").toBe(1);
  });

  test("базы нет: ссылку выдаём, но честно называем временной", async () => {
    h.dbReady = false;
    const before = h.inserted.length;
    const res = await create();

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.url, "ссылку перестали выдавать — это лишняя потеря").toBeTruthy();
    expect(res.body.durable, "молчаливый запасной путь: ответ неотличим от сохранения").toBe(false);
    expect(String(res.body.note || ""), "оговорка пустая — человек ничего не узнает").toMatch(
      /перезапуск/i,
    );
    // Контроль: без базы в базу ничего уходить не должно, иначе первый тест
    // мог быть зелёным по чужой причине.
    expect(h.inserted.length - before, "без базы всё равно записали").toBe(0);
  });

  test("оговорка появляется РОВНО в запасном случае, а не всегда", async () => {
    // Без этой пары «всегда предупреждаем» выглядело бы как исправный код и
    // приучало бы владельца не читать предупреждение.
    h.dbReady = false;
    const fragile = await create();
    h.dbReady = true;
    const solid = await create();

    expect(fragile.body.durable).toBe(false);
    expect(solid.body.durable).toBe(true);
    expect(Boolean(fragile.body.note), "в запасном случае оговорки нет").toBe(true);
    expect(Boolean(solid.body.note), "оговорка показывается и при живой базе").toBe(false);
  });
});
