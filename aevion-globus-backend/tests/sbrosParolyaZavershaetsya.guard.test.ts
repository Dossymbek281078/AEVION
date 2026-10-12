import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

/**
 * 🔴 ЗАВЕРШЕНИЕ СБРОСА ПАРОЛЯ — ЕДИНСТВЕННЫЙ ВЫХОД ИЗ ТУПИКА, И ОН БЫЛ БЕЗ
 * ЕДИНОЙ ПРОВЕРКИ.
 *
 * Замер 12.10.2026: по всему каталогу tests строка `password/reset/complete`
 * не встречалась НИ РАЗУ. В тот же день со страницы входа появилась ссылка
 * «Забыли пароль?», то есть поток на эту ручку перестал быть нулевым. Ручка,
 * которая МЕНЯЕТ ПАРОЛЬ по присланному из письма токену, — самая дорогая для
 * ошибки: пропусти сличение, и пароль чужого аккаунта меняет кто угодно.
 *
 * Сторож делает настоящие запросы к настоящему роутеру. Сличение токена
 * (bcrypt) и хеширование пароля исполняет РОДНОЙ код; базу подменяет заглушка,
 * которая отвечает на те же запросы, что и прод. Честная граница названа ниже
 * у проверки отбора кандидатов: условия «не использован» и «не истёк» живут в
 * SQL, и без живой базы проверить их поведением нельзя — там утверждение о
 * тексте запроса, и это слабее остального.
 */
const запросы: Array<{ sql: string; params: unknown[] }> = [];
let пользовательЕсть = true;
let кандидаты: Array<{ id: string; tokenHash: string }> = [];

const query = vi.fn(async (sql: string, params: unknown[] = []) => {
  запросы.push({ sql, params });
  if (sql.includes('FROM "AEVIONUser"')) {
    return пользовательЕсть ? { rowCount: 1, rows: [{ id: "u-1", name: "Человек" }] } : { rowCount: 0, rows: [] };
  }
  if (sql.includes('FROM "PasswordResetToken"')) return { rowCount: кандидаты.length, rows: кандидаты };
  return { rowCount: 0, rows: [] };
});

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...(a as [string, unknown[]])) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/build/email", () => ({
  canSendEmail: () => true,
  sendVerificationEmail: vi.fn(async () => true),
  sendPasswordResetEmail: vi.fn(async () => true),
}));
// Ограничитель темпа глушим намеренно: supertest ходит с одного адреса, а
// предмет этого файла — смена пароля, не лимиты.
vi.mock("../src/lib/rateLimit", () => ({ rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));

// eslint-disable-next-line import/first
import { authRouter } from "../src/routes/auth";

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/auth", authRouter);
  return a;
}

const ТОКЕН = "nastoyashchiy-token-iz-pisma";

beforeEach(async () => {
  запросы.length = 0;
  пользовательЕсть = true;
  кандидаты = [{ id: "tok-1", tokenHash: await bcrypt.hash(ТОКЕН, 10) }];
});

/** Запросы, которые МЕНЯЮТ данные, — по ним судим о последствиях. */
function изменения() {
  return запросы.filter((з) => /^\s*UPDATE|INSERT/i.test(з.sql.trim()));
}

describe("завершение сброса пароля", () => {
  test("🔴 верный токен меняет пароль, гасит токен и отзывает ВСЕ сессии", async () => {
    const r = await request(приложение())
      .post("/api/auth/password/reset/complete")
      .send({ email: "chelovek@example.com", token: ТОКЕН, newPassword: "novyj-parol-9" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toEqual({ reset: true });

    const изм = изменения();
    const пароль = изм.find((з) => з.sql.includes('"passwordHash"'));
    expect(пароль, "пароль не обновлён").toBeTruthy();
    // Хранится ХЕШ, а не сам пароль — иначе утечка базы отдаёт пароли.
    const сохранено = String(пароль!.params[0]);
    expect(сохранено, "в базу уехал открытый пароль").not.toBe("novyj-parol-9");
    expect(await bcrypt.compare("novyj-parol-9", сохранено), "сохранён хеш не того пароля").toBe(true);

    expect(изм.find((з) => з.sql.includes('"usedAt"')), "токен не погашен — им можно воспользоваться снова").toBeTruthy();
    const сессии = изм.find((з) => з.sql.includes('"AuthSession"'));
    expect(сессии, "сессии не отозваны: вошедший злоумышленник остаётся внутри").toBeTruthy();
    expect(String(сессии!.sql), "отозваны не все сессии").toContain('"revokedAt" IS NULL');
  });

  test("🔴 ЧУЖОЙ токен пароль не меняет", async () => {
    const r = await request(приложение())
      .post("/api/auth/password/reset/complete")
      .send({ email: "chelovek@example.com", token: "podobrannyj-token", newPassword: "novyj-parol-9" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid token");
    // Главное свойство: НИЧЕГО не изменилось. Ответ 400 при изменённом пароле
    // был бы худшим из исходов и выглядел бы правильным.
    expect(изменения().filter((з) => з.sql.includes('"passwordHash"')), "пароль изменён по чужому токену").toEqual([]);
  });

  test("токенов нет вовсе — отказ, а не падение", async () => {
    кандидаты = [];
    const r = await request(приложение())
      .post("/api/auth/password/reset/complete")
      .send({ email: "chelovek@example.com", token: ТОКЕН, newPassword: "novyj-parol-9" });
    expect(r.status).toBe(400);
    expect(изменения().filter((з) => з.sql.includes('"passwordHash"'))).toEqual([]);
  });

  test("неизвестный адрес отвечает так же, как неверный токен", async () => {
    // Иначе ручка выдаёт, кто у нас зарегистрирован.
    пользовательЕсть = false;
    const r = await request(приложение())
      .post("/api/auth/password/reset/complete")
      .send({ email: "net-takogo@example.com", token: ТОКЕН, newPassword: "novyj-parol-9" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid token");
  });

  test("короткий пароль не принимается — знаменатель 4 из 4", async () => {
    const плохие: Array<[string, unknown]> = [
      ["пусто", ""],
      ["пять знаков", "12345"],
      ["не строка", 123456],
      ["нет поля", undefined],
    ];
    for (const [почему, пароль] of плохие) {
      const r = await request(приложение())
        .post("/api/auth/password/reset/complete")
        .send({ email: "chelovek@example.com", token: ТОКЕН, newPassword: пароль });
      expect(r.status, "принят негодный пароль: " + почему).toBe(400);
    }
    expect(плохие.length, "знаменатель: негодных паролей проверено").toBe(4);
    expect(изменения().filter((з) => з.sql.includes('"passwordHash"')), "пароль менялся на негодном вводе").toEqual([]);
  });

  test("отбор кандидатов отсекает использованные и истёкшие", async () => {
    // ⚠️ ЧЕСТНАЯ ГРАНИЦА: эти два условия живут в SQL, и без живой базы
    // проверить их ПОВЕДЕНИЕМ нельзя — заглушка вернёт что угодно. Поэтому
    // здесь утверждение о тексте запроса; оно слабее остальных в этом файле и
    // не заменяет проверки на настоящей базе.
    await request(приложение())
      .post("/api/auth/password/reset/complete")
      .send({ email: "chelovek@example.com", token: ТОКЕН, newPassword: "novyj-parol-9" });
    const отбор = запросы.find((з) => з.sql.includes('FROM "PasswordResetToken"'));
    expect(отбор, "запроса за токенами не было").toBeTruthy();
    expect(отбор!.sql, "использованные токены не отсечены").toContain('"usedAt" IS NULL');
    expect(отбор!.sql, "истёкшие токены не отсечены").toContain('"expiresAt" > NOW()');
  });
});
