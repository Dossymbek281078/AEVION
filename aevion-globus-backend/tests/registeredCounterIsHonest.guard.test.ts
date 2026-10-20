// Счётчик зарегистрированных обязан быть ЧЕСТНЫМ прибором.
//
// ЗАЧЕМ. 28.09.2026 поставлена цель 100 000 пользователей к концу года, а
// измерить её было нечем. Прибор, который врёт, хуже отсутствующего: по нему
// принимают решения. Свойства, каждое выведено из нашего же дефекта:
//   • отказ базы НЕ выдаётся за ноль;
//   • наши пробы считаются ОТДЕЛЬНО (воронка однажды на 91 % состояла из
//     собственной автоматики и выглядела ростом);
//   • 20.10.2026: «люди за 7 дней» = 2, оба — наши демо (@aevion.app,
//     @aevion-probe.invalid): признак не знал наших доменов, example.test,
//     префикса qa- и регистрации из Node/Headless;
//   • наружу не уходит ни адрес, ни имя — ручка публичная.
//
// Запрос исполняет НАСТОЯЩИЙ Postgres (PGlite в памяти), а не заглушка: прежний
// сторож проверял форму SQL и пропустил бы любой признак, которого в SQL нет.
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const { состояние } = vi.hoisted(() => ({
  состояние: { db: null as any, бросать: false },
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params?: unknown[]) => {
      if (состояние.бросать) throw new Error("сеть до базы недоступна");
      return состояние.db.query(sql, params);
    },
  }),
}));

const { счётЗарегистрированных, регистрацияРоботом } = await import("../src/routes/publicStats");

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

/** [id, email, name, сколько дней назад, удалён, UA регистрации] */
const УЧЁТКИ: Array<[string, string, string, number, boolean, string | null]> = [
  ["live-now", "aliya.k@gmail.com", "Алия", 0, false, CHROME],
  ["live-old", "bolat@mail.ru", "Болат", 30, false, null],
  ["live-chrome", "dana@yandex.kz", "Дана", 3, false, CHROME],
  ["demo-app", "demo-bureau@aevion.app", "Демо бюро", 1, false, CHROME],
  ["demo-invalid", "demo@aevion-probe.invalid", "Демо", 2, false, CHROME],
  ["ex-test", "buyer@example.test", "Покупатель", 0, false, CHROME],
  ["qa", "qa-run7@gmail.com", "QA", 0, false, CHROME],
  ["node-ua", "someone@gmail.com", "Кто-то", 0, false, "node"],
  ["headless", "other@gmail.com", "Другой", 0, false, "Mozilla/5.0 HeadlessChrome/141.0"],
  ["smoke", "smoke-1@gmail.com", "smoke", 0, false, CHROME],
  ["anon", "x1@gmail.com", "anonymous-42", 0, false, CHROME],
  ["deleted", "gone@gmail.com", "Ушёл", 0, true, CHROME],
];

beforeAll(async () => {
  состояние.db = new PGlite();
  await состояние.db.exec(`
    CREATE TABLE "AEVIONUser" ("id" TEXT PRIMARY KEY, "email" TEXT, "name" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL, "deletedAt" TIMESTAMPTZ);
    CREATE TABLE "AuthAuditLog" ("id" TEXT PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL,
      "ip" TEXT, "userAgent" TEXT, "metadata" JSONB, "at" TIMESTAMPTZ NOT NULL DEFAULT NOW());
  `);
  for (const [id, email, name, дней, удалён, ua] of УЧЁТКИ) {
    await состояние.db.query(
      `INSERT INTO "AEVIONUser" VALUES ($1,$2,$3, NOW() - ($4 || ' days')::interval - INTERVAL '1 minute', $5)`,
      [id, email, name, String(дней), удалён ? new Date() : null],
    );
    if (ua !== null) {
      await состояние.db.query(
        `INSERT INTO "AuthAuditLog" ("id","userId","action","userAgent") VALUES ($1,$2,'register',$3)`,
        [`a-${id}`, id, ua],
      );
    }
    // вход позже с другого браузера не меняет того, КТО регистрировал
    await состояние.db.query(
      `INSERT INTO "AuthAuditLog" ("id","userId","action","userAgent") VALUES ($1,$2,'login',$3)`,
      [`l-${id}`, id, "node"],
    );
  }
});

beforeEach(() => {
  состояние.бросать = false;
});

describe("счётчик зарегистрированных (настоящий Postgres)", () => {
  it("люди — только живые адреса: 3 всего, 1 за сутки, 2 за неделю", async () => {
    const с = await счётЗарегистрированных();
    expect(с.измерено).toBe(true);
    expect(с.люди).toEqual({ всего: 3, заСегодня: 1, за7дней: 2 });
  });

  it("оба демо-аккаунта (@aevion.app, @aevion-probe.invalid) — пробы, не люди", async () => {
    const с = await счётЗарегистрированных();
    // знаменатель: 12 учёток, 1 удалена, 3 живых → проб 8
    expect(с.пробы.всего).toBe(8);
    expect((с.люди.всего ?? 0) + (с.пробы.всего ?? 0)).toBe(УЧЁТКИ.filter((u) => !u[4]).length);
  });

  it("признак строки браузера: node/undici/Headless/наша проба — робот; Chrome и пусто — нет", () => {
    expect(регистрацияРоботом("node")).toBe(true);
    expect(регистрацияРоботом("undici")).toBe(true);
    expect(регистрацияРоботом("Mozilla/5.0 HeadlessChrome/141.0")).toBe(true);
    expect(регистрацияРоботом("AEVION-probe/1")).toBe(true);
    expect(регистрацияРоботом(CHROME)).toBe(false);
    expect(регистрацияРоботом(null)).toBe(false);
  });

  it("база не ответила — это НЕ ноль", async () => {
    состояние.бросать = true;
    const с = await счётЗарегистрированных();
    expect(с.измерено).toBe(false);
    expect(с.люди.всего, "отказ базы выдан за «никто не зарегистрировался»").toBeNull();
    expect(с.люди.заСегодня).toBeNull();
    expect(с.пробы.всего).toBeNull();
    expect(с.почему).toBeTruthy();
  });

  it("наружу не уходит ни адрес, ни имя", async () => {
    const с = await счётЗарегистрированных();
    const текст = JSON.stringify(с);
    expect(текст).not.toMatch(/@/);
    expect(текст).not.toMatch(/email|passwordHash|"name"|userAgent/i);
  });
});
