import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

/**
 * Сторож: один и тот же адрес пускает в аккаунт независимо от регистра —
 * иначе заплативший не доберётся до оплаченного.
 *
 * ЧТО НАШЛОСЬ (замер 12.10.2026, окно user-d7). Столбец объявлен
 * `"email" TEXT NOT NULL UNIQUE` (ensureUsersTable.ts), не citext, а вход
 * искал `WHERE "email"=$1` сырым адресом — в Postgres это сравнение
 * регистрозависимое. Прод-замер ручки входа незнакомым адресом: 401
 * `{"error":"invalid credentials"}` (контроль: выдуманный путь той же ручки
 * — 404, значит отвечала настоящая). То есть человек, заведший аккаунт как
 * `John@Mail.com`, на `john@mail.com` получал тот же сухой отказ. Права по
 * оплате при этом регистр переживают: поиск подписки нормализует ОБЕ стороны
 * (provisioning.ts) — не переживал ВХОД в аккаунт, где эти права лежат.
 *
 * ПОЛИТИКА (задана оркестратором, чтобы код не решал за основателя):
 * точное совпадение остаётся ПЕРВЫМ — поведение существующих аккаунтов не
 * меняется; промах — поиск по нижнему регистру и принимаем ТОЛЬКО ровно одну
 * строку; две и больше — прежний отказ и запись в журнал без адреса целиком.
 * Миграции нет.
 *
 * ГРАНИЦА. База здесь подменена: сторож проверяет, какие запросы уходят и что
 * ручка отвечает, но не поведение настоящего Postgres. Живого аккаунта на
 * проде я не создавал — создание аккаунтов не моя рука.
 */

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

process.env.AUTH_JWT_SECRET = "test-secret-dlya-storozha-vhoda-32-znaka-i-bolshe";

// eslint-disable-next-line import/first
import { authRouter } from "../src/routes/auth";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
};

const ПАРОЛЬ = "pravilnyy-parol-123";
const АДРЕС_В_БАЗЕ = "John@Mail.com";

type Строка = {
  id: string; email: string; name: string; role: string;
  passwordHash: string; deletedAt: null; tokenVersion: number;
};

async function строка(email: string, id = "u1"): Promise<Строка> {
  return {
    id, email, name: "Покупатель", role: "USER",
    passwordHash: await bcrypt.hash(ПАРОЛЬ, 10), deletedAt: null, tokenVersion: 0,
  };
}

/** База, в которой лежат ровно эти строки пользователей. */
function базаС(строки: Строка[]) {
  query.mockReset();
  query.mockImplementation(async (sql: string, params?: unknown[]) => {
    const текст = String(sql);
    if (/LOWER\("email"\)=LOWER\(\$1\)/.test(текст)) {
      const цель = String(params?.[0] ?? "").toLowerCase();
      return { rows: строки.filter((s) => s.email.toLowerCase() === цель) };
    }
    if (/SELECT 1 FROM "AEVIONUser" WHERE LOWER\("email"\)=\$1/.test(текст)) {
      const цель = String(params?.[0] ?? "").toLowerCase();
      return { rows: строки.filter((s) => s.email.toLowerCase() === цель).map(() => ({ "?column?": 1 })) };
    }
    if (/WHERE "email"=\$1/.test(текст)) {
      const цель = String(params?.[0] ?? "");
      return { rows: строки.filter((s) => s.email === цель) };
    }
    return { rowCount: 1, rows: [] };
  });
}

const вход = (email: string, password = ПАРОЛЬ) =>
  request(app()).post("/login").send({ email, password });

beforeEach(() => vi.clearAllMocks());

describe("вход одним адресом в любом регистре", () => {
  test("КОНТРОЛЬ: точное совпадение пускает, как и раньше", async () => {
    базаС([await строка(АДРЕС_В_БАЗЕ)]);
    const r = await вход(АДРЕС_В_БАЗЕ);
    expect(r.status, `точный вход сломан: ${JSON.stringify(r.body)}`).toBe(200);
    expect(r.body.token, "токен не выдан").toBeTruthy();
  });

  test("КОНТРОЛЬ: неверный пароль по-прежнему отказ", async () => {
    базаС([await строка(АДРЕС_В_БАЗЕ)]);
    const r = await вход(АДРЕС_В_БАЗЕ, "ne-tot-parol");
    expect(r.status, "запасной поиск ослабил проверку пароля").toBe(401);
  });

  test("тот же адрес В ДРУГОМ РЕГИСТРЕ пускает в тот же аккаунт", async () => {
    базаС([await строка(АДРЕС_В_БАЗЕ)]);
    const r = await вход("john@mail.com");
    expect(r.status, `заплативший не вошёл своим же адресом: ${JSON.stringify(r.body)}`).toBe(200);
    expect(r.body.user?.id, "пустили в ЧУЖОЙ аккаунт").toBe("u1");
  });

  test("ДВА аккаунта на один адрес — прежний отказ, и в журнале нет адреса целиком", async () => {
    базаС([await строка("John@Mail.com", "u1"), await строка("john@mail.com", "u2")]);
    const сказано: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      сказано.push(a.map(String).join(" "));
    });
    const r = await вход("JOHN@MAIL.COM");
    spy.mockRestore();
    expect(r.status, "при двух аккаунтах код решил за основателя, какой настоящий").toBe(401);
    expect(r.body.error, "ответ перестал быть прежним").toBe("invalid credentials");
    const запись = сказано.find((s) => s.includes("email-case-duplicate"));
    expect(запись, "случай не попал в журнал — мы о нём никогда не узнаем").toBeTruthy();
    expect(запись, "в журнал ушёл адрес целиком").not.toContain("john@mail.com");
    expect(запись, "домен в журнале не назван — находить случай нечем").toContain("@mail.com");
  });

  test("удалённый аккаунт не пускает и через запасной поиск", async () => {
    const s = await строка(АДРЕС_В_БАЗЕ);
    базаС([{ ...s, deletedAt: new Date().toISOString() as unknown as null }]);
    const r = await вход("john@mail.com");
    expect(r.status, "запасной поиск обошёл проверку удалённого аккаунта").toBe(401);
  });
});

describe("регистрация приводит адрес к нижнему регистру", () => {
  test("в базу уходит нижний регистр, и в ответе тот же адрес", async () => {
    базаС([]);
    const r = await request(app())
      .post("/register")
      .send({ email: "Novyy@Mail.com", password: ПАРОЛЬ, name: "Новый" });
    expect(r.status, `регистрация сломана: ${JSON.stringify(r.body)}`).toBe(201);
    const вставка = query.mock.calls.find((c) => /INSERT INTO "AEVIONUser"/.test(String(c[0])));
    expect(вставка, "вставки пользователя не было").toBeTruthy();
    expect(
      (вставка![1] as unknown[])[1],
      "адрес записан как введён — завтра человек не войдёт другим написанием",
    ).toBe("novyy@mail.com");
    expect(r.body.user?.email, "в ответе один адрес, а в базе другой").toBe("novyy@mail.com");
  });

  test("адрес уже есть в ДРУГОМ регистре — отказ, а не второй аккаунт", async () => {
    базаС([await строка("Novyy@Mail.com")]);
    const r = await request(app())
      .post("/register")
      .send({ email: "novyy@mail.com", password: ПАРОЛЬ, name: "Новый" });
    expect(r.status, "завели ВТОРОЙ аккаунт на тот же адрес").toBe(409);
    expect(r.body.error).toBe("email already exists");
    const вставка = query.mock.calls.find((c) => /INSERT INTO "AEVIONUser"/.test(String(c[0])));
    expect(вставка, "при отказе всё равно вставили пользователя").toBeFalsy();
  });
});
