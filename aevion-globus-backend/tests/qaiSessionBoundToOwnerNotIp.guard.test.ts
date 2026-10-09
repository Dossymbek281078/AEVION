/**
 * Переписка QAI принадлежит ВОШЕДШЕМУ или подписанной сервером метке гостя,
 * а НЕ сетевому адресу.
 *
 * ПОВОД (09.10.2026). Внешний исследователь написал, что «ИИ-чаты
 * пользователей доступны без входа». Проверка чтением кода подтвердила это для
 * модуля QAI: принадлежность сессии определялась значением, которое приходит в
 * запросе от клиента (заголовок `x-forwarded-for`), а `GET /sessions` вообще
 * отдавал список переписок всем, у кого тот же внешний адрес, — то есть всем
 * сотрудникам одного офиса, посетителям одной кофейни и абонентам одного
 * оператора за NAT. Мультичат тем же заходом оказался чист: он спрашивает
 * `req.auth.sub` и выбирает по владельцу.
 *
 * Сторож делает ЗАПРОСЫ К РУЧКАМ (§0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС) и проверяет ТЕЛО
 * ответа, а не вызывает внутреннюю функцию со выдуманными данными.
 *
 * КАК ОН УСТРОЕН, чтобы остался чувствительным: оба гостя ходят с ОДНИМ И ТЕМ
 * ЖЕ `x-forwarded-for` и разными cookie. Поэтому возврат привязки к адресу
 * (`session.ip !== ip`) немедленно красит его: второй гость начнёт получать
 * 200 там, где обязан получать 404. Проверено мутацией, см. хвост файла.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const СЕКРЕТ = "test-secret-qai-owner";
process.env.AUTH_JWT_SECRET = СЕКРЕТ;

// Один адрес на всех — именно в этом смысл проверки.
const ОБЩИЙ_АДРЕС = "203.0.113.77";

// База недоступна → модуль честно переходит на хранилище в памяти.
// По умолчанию база недоступна → модуль честно переходит на хранилище в
// памяти. Один тест ниже включает её, чтобы проверить СТАРЫЕ записи, у которых
// владельца нет вовсе: их не создать через ручки, они приходят только из базы.
let базаЖива = false;
let строкиСессий: Record<string, unknown>[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      if (!базаЖива) throw new Error("база в этом тесте недоступна намеренно");
      if (/SELECT/i.test(sql)) return { rows: строкиСессий, rowCount: строкиСессий.length };
      return { rows: [], rowCount: 0 };
    }),
  }),
}));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => () => {},
}));

// Темп не ограничиваем: проверяем доступ, а не частоту.
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Провайдера не зовём по сети: ответ подставной, он здесь не предмет проверки.
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [{ id: "stub", name: "Stub", configured: true, models: ["stub-1"], tier: "free" }],
  resolveProvider: () => "stub",
  callProvider: async () => ({ reply: "подставной ответ", model: "stub-1" }),
}));

async function поднять() {
  const { qaiRouter } = await import("../src/routes/qai");
  const app = express();
  app.use(express.json());
  app.use("/api/qai", qaiRouter);
  return app;
}

/** Достаёт метку гостя из ответа — ровно так, как её хранил бы браузер. */
function кукаИзОтвета(заголовки: Record<string, unknown>): string {
  const raw = заголовки["set-cookie"];
  const список = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const нужная = список.find((s) => s.startsWith("qai_guest="));
  if (!нужная) throw new Error("сервер не выдал метку гостя — проверять нечего");
  return нужная.split(";")[0];
}

describe("QAI: переписка привязана к владельцу, а не к адресу", () => {
  beforeEach(() => {
    vi.resetModules();
    базаЖива = false;
    строкиСессий = [];
    process.env.AUTH_JWT_SECRET = СЕКРЕТ;
  });

  it("гость получает httpOnly-метку, а не опознаётся по адресу", async () => {
    const app = await поднять();
    const ответ = await request(app)
      .post("/api/qai/chat")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .send({ message: "привет" });

    expect(ответ.status).toBe(200);
    expect(ответ.body.sessionId).toBeTruthy();

    const список = ответ.headers["set-cookie"] as unknown;
    const строки = Array.isArray(список) ? список : [String(список)];
    const метка = строки.find((s) => s.startsWith("qai_guest="));
    expect(метка, "метка гостя обязана выдаваться").toBeTruthy();
    expect(метка).toMatch(/HttpOnly/i);
    // В значении обязана быть подпись: «id.подпись», а не голый id.
    const значение = decodeURIComponent(String(метка).split(";")[0].split("=")[1]);
    expect(значение.split(".").length, "значение метки обязано быть подписано").toBe(2);
  });

  it("ВТОРОЙ гость с ТЕМ ЖЕ адресом не видит переписку первого", async () => {
    const app = await поднять();

    // Гость А завёл переписку.
    const а = await request(app)
      .post("/api/qai/chat")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .send({ message: "мой личный вопрос" });
    expect(а.status).toBe(200);
    const сессияА = а.body.sessionId as string;
    const кукаА = кукаИзОтвета(а.headers as Record<string, unknown>);

    // Контроль прибора: сам владелец СВОЮ переписку видит. Без этой строки
    // все 404 ниже могли бы означать «ручка сломана», а не «доступ закрыт».
    const свой = await request(app)
      .get(`/api/qai/sessions/${сессияА}`)
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Cookie", кукаА);
    expect(свой.status, "владелец обязан видеть свою переписку").toBe(200);

    const свойСписок = await request(app)
      .get("/api/qai/sessions")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Cookie", кукаА);
    expect(свойСписок.body.total, "у владельца переписка одна").toBe(1);

    // Гость Б — тот же адрес, СВОЯ метка (как другой человек за тем же NAT).
    const завязка = await request(app)
      .get("/api/qai/sessions")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС);
    const кукаБ = кукаИзОтвета(завязка.headers as Record<string, unknown>);
    expect(кукаБ, "у второго гостя метка обязана быть другой").not.toBe(кукаА);
    expect(завязка.body.total, "второй гость не видит чужих переписок в списке").toBe(0);

    // Четыре двери в ту же комнату — все обязаны отвечать 404.
    const двери = [
      ["чтение", () => request(app).get(`/api/qai/sessions/${сессияА}`)],
      ["экспорт", () => request(app).get(`/api/qai/sessions/${сессияА}/export`)],
      ["удаление", () => request(app).delete(`/api/qai/sessions/${сессияА}`)],
    ] as const;

    for (const [имя, запрос] of двери) {
      const ответ = await запрос()
        .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
        .set("Cookie", кукаБ);
      expect(ответ.status, `${имя} чужой переписки обязано давать 404`).toBe(404);
    }

    // Переименование — тоже дверь, и у неё своё тело запроса.
    const переименование = await request(app)
      .post(`/api/qai/sessions/${сессияА}/title`)
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Cookie", кукаБ)
      .send({ title: "подменённое название" });
    expect(переименование.status, "переименование чужой переписки обязано давать 404").toBe(404);

    // И главное: после всех попыток переписка А ЦЕЛА. Иначе «404» мог бы
    // приходить уже после успешного удаления.
    const послеПопыток = await request(app)
      .get(`/api/qai/sessions/${сессияА}`)
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Cookie", кукаА);
    expect(послеПопыток.status, "переписка владельца обязана остаться на месте").toBe(200);
    expect(послеПопыток.body.messageCount, "сообщения владельца обязаны остаться").toBeGreaterThan(0);
  });

  it("продолжить чужую переписку в чате нельзя — иначе история утечёт в ответ", async () => {
    const app = await поднять();

    const а = await request(app)
      .post("/api/qai/chat")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .send({ message: "секрет первого гостя" });
    const сессияА = а.body.sessionId as string;

    const завязка = await request(app)
      .get("/api/qai/sessions")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС);
    const кукаБ = кукаИзОтвета(завязка.headers as Record<string, unknown>);

    const чужойЧат = await request(app)
      .post("/api/qai/chat")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Cookie", кукаБ)
      .send({ message: "а что было раньше?", sessionId: сессияА });

    expect(чужойЧат.status, "чат по чужому sessionId обязан отказывать").toBe(404);
  });

  it("вошедший не видит переписок гостей с того же адреса", async () => {
    const app = await поднять();

    const гость = await request(app)
      .post("/api/qai/chat")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .send({ message: "вопрос гостя" });
    const сессияГостя = гость.body.sessionId as string;

    const токен = jwt.sign({ sub: "user-42", email: "u42@example.test" }, СЕКРЕТ, { algorithm: "HS256" });

    const список = await request(app)
      .get("/api/qai/sessions")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Authorization", `Bearer ${токен}`);
    expect(список.body.total, "вошедший не наследует переписки гостей").toBe(0);

    const чтение = await request(app)
      .get(`/api/qai/sessions/${сессияГостя}`)
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС)
      .set("Authorization", `Bearer ${токен}`);
    expect(чтение.status).toBe(404);
  });

  it("старые записи без владельца не становятся общими, когда владельца установить нечем", async () => {
    // Записи, созданные до этой правки, привязаны к адресу и владельца не
    // имеют (owner=''). Если владельца установить нечем (секрет не задан),
    // пустой владелец НЕ должен совпадать с пустым полем таких записей —
    // иначе чужая история снова станет общей, теперь уже тихо.
    delete process.env.AUTH_JWT_SECRET;
    базаЖива = true;
    строкиСессий = [
      {
        id: "старая-сессия-1",
        title: "переписка до правки",
        persona_id: null,
        ip: ОБЩИЙ_АДРЕС,
        owner: "",
        messages: JSON.stringify([{ role: "user", content: "старый секрет" }]),
        created_at: new Date().toISOString(),
      },
    ];

    const app = await поднять();
    const ответ = await request(app)
      .get("/api/qai/sessions")
      .set("x-forwarded-for", ОБЩИЙ_АДРЕС);

    expect(ответ.status).toBe(200);
    expect(ответ.body.total, "без владельца список обязан быть пустым").toBe(0);
    expect(JSON.stringify(ответ.body), "содержимое старой переписки не должно утечь").not.toContain("старый секрет");
  });

  it("знаменатель: ни одна ручка сессий не опознаёт человека по адресу", async () => {
    // Сторож, который перечисляет, обязан печатать знаменатель и краснеть,
    // когда он падает (§0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС).
    const fs = await import("node:fs");
    const url = await import("node:url");
    const путь = url.fileURLToPath(new URL("../src/routes/qai.ts", import.meta.url));
    const текст = fs.readFileSync(путь, "utf8");

    const поАдресу = текст.split("\n").filter((s) => /session\.ip\s*!==|listSessionsByIp\(/.test(s));
    const поВладельцу = текст.split("\n").filter((s) => /session\.owner\s*!==|listSessionsByOwner\(/.test(s));

    expect(поАдресу, `доступ по адресу: ${поАдресу.join(" | ")}`).toHaveLength(0);
    // 4 сверки (чтение, экспорт, переименование, удаление) + объявление и
    // вызов выборки по владельцу. Упало ниже — значит ручки стало меньше, и
    // это надо объяснить, а не пройти мимо зелёным.
    expect(поВладельцу.length, `проверок по владельцу найдено ${поВладельцу.length}`).toBeGreaterThanOrEqual(6);
  });
});

/**
 * МУТАЦИИ, прогнанные 09.10.2026 по одной (не подряд: vitest отдаёт кэш и
 * врёт «не поймана»), каждая на закоммиченной базе, с --no-cache:
 *
 *   1. `session.owner !== owner` -> `false` во ВСЕХ 4 ручках по id
 *      — ПОЙМАНА: 3 из 6 покраснели.
 *   2. `filter((s) => s.owner === owner)` -> `filter(() => true)` в выборке
 *      — ПОЙМАНА: 2 из 6 покраснели.
 *   3. `existing.owner === owner ? existing : null` -> `existing`
 *      (продолжение чужой переписки в чате) — ПОЙМАНА: 1 из 6.
 *   4. убрано `if (!owner) return []` (защита старых записей с owner='')
 *      — сперва ВЫЖИЛА: 6 из 6 зелёные. Пробел закрыт тестом про старые
 *      записи (база включается флагом и отдаёт запись без владельца —
 *      через ручки такую не создать). После него мутация ПОЙМАНА: 1 из 6.
 *
 * Пункт 4 — причина, по которой этот блок написан после прогона, а не до:
 * три поймана из трёх выглядели доказательством, а четвёртая показала, что
 * целая ветка защиты не охранялась вовсе.
 */
