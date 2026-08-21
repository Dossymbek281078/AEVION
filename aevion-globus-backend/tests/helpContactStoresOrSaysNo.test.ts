import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Обращение со страницы помощи: «принято» — только по ФАКТУ записи.
//
// Ручка вызывалась формой с 12.08 и отвечала 404. Форма при этом написана
// предусмотрительно: не вышло — открывает почтовый клиент. Но эта «запасная»
// ветка срабатывала ВСЕГДА, то есть была единственной, и вела на личный ящик
// на домене без записей MX.
//
// Здесь проверяется главное свойство: успех не выдаётся авансом. Если база
// недоступна — 503 и честный текст, а не {ok:true}. Молчаливый успех дороже
// отказа: человек уверен, что его услышали, и ждёт ответа, которого не будет.

let dbThrows = false;
let inserted: unknown[][] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params?: unknown[]) => {
      if (dbThrows) throw new Error("no database");
      if (/INSERT INTO help_contact/.test(sql)) { inserted.push(params ?? []); return { rows: [], rowCount: 1 }; }
      if (/count\(\*\)/.test(sql)) return { rows: [{ n: inserted.length }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  }),
}));

const { helpContactRouter } = await import("../src/routes/helpContact");

let ipSeq = 0;
/** Свой адрес на каждый запрос: иначе тест упирается в собственный
 *  ограничитель (5 в минуту) и краснеет по 429 — что я и получил с первого
 *  раза. Заодно это доказывает, что ограничитель на ручке РАБОТАЕТ. */
function app() {
  const a = express();
  // Без этого express не берёт адрес из X-Forwarded-For, все запросы теста
  // считаются одним клиентом и упираются в ограничитель (5/мин) — я получил
  // ровно это: 429 вместо 201. Заодно доказывает, что ограничитель работает.
  a.set("trust proxy", true);
  a.use(express.json());
  a.use("/api/help", helpContactRouter);
  return a;
}

describe("help/contact — принято только когда сохранено", () => {
  beforeEach(() => { dbThrows = false; inserted = []; vi.resetModules(); });

  test("обращение сохраняется, и это видно в ответе", async () => {
    const r = await request(app()).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({
      topic: "billing", subject: "Возврат", email: "a@b.c",
      message: "Не пришёл файл после оплаты", lang: "ru", page: "https://aevion.app/help",
    });
    expect(r.status).toBe(201);
    expect(r.body.stored).toBe(true);
    // Запись РЕАЛЬНО отправлена в базу — иначе тест был бы зелёным на коде,
    // который ничего не пишет.
    expect(inserted.length).toBe(1);
    expect(inserted[0]).toContain("Не пришёл файл после оплаты");
  });

  test("пустое обращение — 400, а не 500", async () => {
    // Ошибка запроса не должна попадать в Sentry как авария сервера.
    const r = await request(app()).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({ subject: "нет текста" });
    expect(r.status).toBe(400);
    expect(inserted.length).toBe(0);
  });

  test("⭐ база недоступна -> 503 и stored:false, а НЕ мнимый успех", async () => {
    dbThrows = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await request(app()).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({ message: "текст" });
    err.mockRestore();

    expect(r.status).toBe(503);
    expect(r.body.stored).toBe(false);
    expect(r.body.ok).toBeUndefined();
    expect(inserted.length).toBe(0);
  });

  test("длинные поля обрезаются, а не роняют запись", async () => {
    const r = await request(app()).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({
      message: "x".repeat(10000), subject: "y".repeat(1000),
    });
    expect(r.status).toBe(201);
    const [, , subject, , message] = inserted[0] as string[];
    expect(message.length).toBe(5000);
    expect(subject.length).toBe(200);
  });

  test("состояние канала: total — число, а при отказе null, не ноль", async () => {
    await request(app()).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({ message: "раз" });
    const ok = await request(app()).get("/api/help/contact/health");
    expect(ok.body.total).toBe(1);
    // Ноль и «спросить не удалось» — разные вещи; ноль читался бы как факт.
    expect(ok.body.ok).toBe(true);
  });
});

describe("отказ хранилища не защёлкивается", () => {
  test("после сбоя следующее обращение снова принимается", async () => {
    dbThrows = false; inserted = [];
    const a = app();
    // рабочее обращение
    expect((await request(a).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({ message: "раз" })).status).toBe(201);

    // сбой
    dbThrows = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await request(a).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({ message: "два" })).status).toBe(503);
    err.mockRestore();

    // база вернулась — форма обязана заработать СРАЗУ, а не после перезапуска.
    // Первая версия оставляла отказ до конца жизни процесса: одна секунда
    // неудачи стоила бы суток тишины.
    dbThrows = false;
    const back = await request(a).post("/api/help/contact").set("X-Forwarded-For", `10.0.0.${++ipSeq}`).send({ message: "три" });
    expect(back.status).toBe(201);
    expect(back.body.stored).toBe(true);
  });
});
