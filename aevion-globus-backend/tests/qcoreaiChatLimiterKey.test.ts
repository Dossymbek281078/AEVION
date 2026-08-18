import { describe, test, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// Единица счёта у chatLimiter — 13.08.2026.
//
// Лимитер /api/qcoreai/chat считал строго по адресу. На самом частом пути это
// давало ОДИН счётчик на всю платформу: MultiChat зовёт эту ручку внутренним
// fetch на 127.0.0.1 (multichat.ts, `internalBase`), поэтому все пользователи
// приходили под одним адресом `::ffff:127.0.0.1`.
//
// Замер на живом сервере до починки: user-A делает 29 вызовов (его собственный
// предел — 12 фан-аутов в минуту — при этом не тронут), после чего user-B, не
// сделавший НИ ОДНОГО запроса, получает 429 на первом же. Совет из 8 агентов
// расходует 8 из 30 — четвёртый совет в минуту на всей платформе отказывал.
// До человека это доходило как «агент не ответил»: для MultiChat неудачный
// внутренний вызов и лимит выглядят одинаково.
//
// Почему не поймали раньше: прежний тест этого файла писал про лимитер
// «not unit-testable without spinning up Express» — и не проверял его вовсе.
// Express для мидлвары нужен в объёме четырёх строк, что и делает `mount()`.
//
// Тесты ниже красные на коде до этого коммита (keyFn там отсутствовал).

const SECRET = "test-secret-for-chat-limiter-key-0000000";

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = SECRET;
});

/**
 * Экземпляр лимитера ОДИН на весь файл — динамический import кэшируется, и
 * пересоздать его вызовом mount() нельзя (первая версия этого файла обещала
 * «свежий экземпляр на каждый случай»; тест на негодный токен из-за этого
 * покраснел: бюджет адреса уже потратил тест анонима).
 *
 * Поэтому изоляцию даёт КЛЮЧ, а не модуль: случаи со счётом по адресу берут
 * каждый свой X-Forwarded-For (trust proxy включён, clientIp читает именно его),
 * а случаи со счётом по аккаунту — каждый свой sub.
 *
 * Импорт динамический, чтобы секрет из beforeAll стоял в env к моменту разбора
 * токена.
 */
async function mount() {
  const { chatLimiter } = await import("../src/routes/qcoreai");
  const app = express();
  app.set("trust proxy", 1);
  app.post("/chat", chatLimiter, (_req, res) => res.json({ ok: true }));
  return app;
}

function tokenFor(sub: string): string {
  return jwt.sign({ sub, email: `${sub}@test.local`, role: "user" }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

/**
 * Замораживаем часы на время случаев, которые тратят весь бюджет.
 *
 * Первая версия этого файла ставила на то, что 30 последовательных запросов
 * через supertest уложатся в минуту. В одиночном прогоне укладывались, в полном
 * (114 файлов параллельно) — упало один раз из четырёх: окно успевало истечь
 * между первым и тридцатым запросом, счётчик сбрасывался, и «перебор» проходил.
 * Падало при этом не там, где причина, — выглядело как дефект изоляции.
 *
 * Ставка на скорость машины убирается заморозкой, а не увеличением лимита:
 * лимит здесь боевой, ради него тест и написан.
 */
function freezeClock() {
  const t = 1_762_000_000_000; // произвольная фиксированная метка
  vi.spyOn(Date, "now").mockReturnValue(t);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chatLimiter — единица счёта", () => {
  test("два аккаунта с одного адреса не делят бюджет", async () => {
    freezeClock();
    const app = await mount();
    const a = tokenFor("acct-a");
    const b = tokenFor("acct-b");

    // acct-a выбирает свой бюджет целиком. Адрес у обоих один и тот же —
    // supertest всегда приходит с loopback, ровно как внутренний fetch
    // MultiChat.
    for (let i = 0; i < 30; i++) {
      const r = await request(app).post("/chat").set("Authorization", `Bearer ${a}`);
      expect(r.status).toBe(200);
    }
    // Свой предел за собой остаётся — иначе починка превратилась бы в дыру.
    const over = await request(app).post("/chat").set("Authorization", `Bearer ${a}`);
    expect(over.status).toBe(429);

    // acct-b не сделал ни одного вызова. До починки здесь было 429.
    const first = await request(app).post("/chat").set("Authorization", `Bearer ${b}`);
    expect(first.status).toBe(200);
    expect(first.headers["x-ratelimit-remaining"]).toBe("29");
  });

  test("аноним по-прежнему ограничен, и считается по адресу", async () => {
    freezeClock();
    const app = await mount();
    const anon = () => request(app).post("/chat").set("X-Forwarded-For", "203.0.113.2");
    for (let i = 0; i < 30; i++) {
      expect((await anon()).status).toBe(200);
    }
    expect((await anon()).status).toBe(429);
  });

  test("негодный токен считается анонимом, а не отдельным ключом на токен", async () => {
    // Иначе счёт обходится генерацией мусорных токенов: каждый новый мусор —
    // новый ключ и новые 30 запросов.
    freezeClock();
    const app = await mount();
    // Свой адрес: у негодного токена ключ тот же, что у анонима, и бюджет
    // 203.0.113.2 уже потратил предыдущий случай.
    const junk = (n: string) =>
      request(app)
        .post("/chat")
        .set("X-Forwarded-For", "203.0.113.3")
        .set("Authorization", `Bearer garbage-${n}`);
    for (let i = 0; i < 30; i++) {
      expect((await junk(String(i))).status).toBe(200);
    }
    expect((await junk("last")).status).toBe(429);
  });

  test("сломанный keyFn не срабатывает на штатном пути", async () => {
    // Лимитер предупреждает в лог, когда keyFn не дал ключа, и откатывается на
    // адрес. Аноним — штатный путь, а не сбой: keyFn обязан вернуть ip-ключ
    // сам, иначе предупреждение станет постоянным шумом и его перестанут
    // читать.
    const said: string[] = [];
    const real = console.error;
    console.error = (...a: unknown[]) => void said.push(a.join(" "));
    try {
      const app = await mount();
      await request(app).post("/chat").set("X-Forwarded-For", "203.0.113.4");
      await request(app)
        .post("/chat")
        .set("X-Forwarded-For", "203.0.113.4")
        .set("Authorization", `Bearer ${tokenFor("acct-c")}`);
      expect(said.filter((s) => s.includes("не дал ключа"))).toHaveLength(0);
    } finally {
      console.error = real;
    }
  });
});
