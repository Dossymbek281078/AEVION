import { describe, test, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";

// «Выйти со всех устройств» — механизм, которого не существовало.
//
// До 21.08.2026: колонка tokenVersion заведена миграцией, поле `tv` описано
// абзацем в типе токена, ручка опубликована в спецификации API — и ни одна
// строка кода счётчик не читала и не увеличивала. Проба на проде: ручка 404,
// отзыв сессий смотрят 2 проверки входа из 97. То есть отозвать выданный
// токен было НЕЛЬЗЯ ничем.
//
// Здесь проверяется не «ручка отвечает 200», а сам смысл: выданный токен
// ПЕРЕСТАЁТ подходить после нажатия кнопки.

process.env.AUTH_JWT_SECRET = "test-secret-that-is-long-enough-for-checks-32+";

let rows: any[] = [];
let dbThrows = false;
const queries: string[] = [];
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      queries.push(sql);
      if (dbThrows) throw new Error("connection refused");
      if (/UPDATE "AEVIONUser"/.test(sql)) return { rows: [{ tokenVersion: 7 }], rowCount: 1 };
      return { rows, rowCount: rows.length };
    },
  }),
}));

const tv = await import("../src/lib/tokenVersion");
const { verifyBearerOptional } = await import("../src/lib/authJwt");

const sign = (sub: string, v?: number) =>
  jwt.sign(v === undefined ? { sub, email: "a@b.c", role: "user" } : { sub, email: "a@b.c", role: "user", tv: v },
    process.env.AUTH_JWT_SECRET as string, { expiresIn: "1h" });

const req = (token: string) => ({ headers: { authorization: "Bearer " + token } }) as any;

describe("отзыв токена — механизм, а не обещание", () => {
  beforeEach(() => { tv.__resetTokenVersionsForTests(); queries.length = 0; rows = []; dbThrows = false; });

  test("карта не загружена -> проверка НЕ применяется (и это видно снаружи)", () => {
    expect(tv.isEnforcing()).toBe(false);
    expect(tv.tokenVersionAccepted("u1", 0)).toBe(true);
    expect(tv.tokenVersionStatus().enforcing).toBe(false);
  });

  test("версия совпала -> токен проходит", async () => {
    rows = [{ id: "u1", tv: 3 }];
    await tv.loadTokenVersions();
    expect(tv.isEnforcing()).toBe(true);
    expect(verifyBearerOptional(req(sign("u1", 3)))).not.toBeNull();
  });

  test("⭐ ПОСЛЕ кнопки выданный токен перестаёт подходить", async () => {
    rows = [{ id: "u1", tv: 0 }];
    await tv.loadTokenVersions();
    const token = sign("u1", 0);
    expect(verifyBearerOptional(req(token))).not.toBeNull();   // до нажатия — работает

    await tv.bumpTokenVersion("u1");                            // нажали кнопку

    // Тот же самый токен, подпись по-прежнему верна — и он больше не годится.
    expect(verifyBearerOptional(req(token))).toBeNull();
  });

  test("счётчик обновляется в памяти СРАЗУ, а не к следующей загрузке", async () => {
    rows = [{ id: "u1", tv: 0 }];
    await tv.loadTokenVersions();
    const next = await tv.bumpTokenVersion("u1");
    expect(next).toBe(7);
    expect(tv.currentTokenVersion("u1")).toBe(7);
    // Иначе кнопка срабатывала бы «потом», а человек считал бы, что защитился.
  });

  test("старый токен без поля tv считается нулевым", async () => {
    rows = [{ id: "u1", tv: 0 }];
    await tv.loadTokenVersions();
    expect(verifyBearerOptional(req(sign("u1")))).not.toBeNull();
    await tv.bumpTokenVersion("u1");
    expect(verifyBearerOptional(req(sign("u1")))).toBeNull();
  });

  test("пользователя нет в полной карте -> токен отвергается", async () => {
    rows = [{ id: "u1", tv: 0 }];
    await tv.loadTokenVersions();
    // Карта грузится ЦЕЛИКОМ, поэтому отсутствие — факт, а не «не знаю».
    expect(verifyBearerOptional(req(sign("u-нет-такого", 0)))).toBeNull();
  });

  test("база недоступна -> проверка не применяется, но отказ ВИДЕН", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    dbThrows = true;
    const ok = await tv.loadTokenVersions();

    expect(ok).toBe(false);
    expect(tv.isEnforcing()).toBe(false);          // направление: не запирать всех
    expect(err).toHaveBeenCalled();                // но и не молчать (§14)
    const st = tv.tokenVersionStatus();
    expect(st.enforcing).toBe(false);
    expect(st.lastError).toMatch(/connection refused/);   // причина НАЗВАНА
    err.mockRestore();
  });

  test("сбой при загрузке не стирает уже работающую карту", async () => {
    rows = [{ id: "u1", tv: 4 }];
    await tv.loadTokenVersions();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    dbThrows = true;
    await tv.loadTokenVersions();
    err.mockRestore();
    // Иначе одна неудачная перезагрузка молча снимала бы защиту со всех.
    expect(tv.isEnforcing()).toBe(true);
    expect(tv.currentTokenVersion("u1")).toBe(4);
  });
});
