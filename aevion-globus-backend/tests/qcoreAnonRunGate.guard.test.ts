// Аноним без входа не запускает мультиагента бесплатно без счёта.
//
// ЗАМЕР 1.11.2026 (прод, ?c=probe-apps): гость на /qcoreai/multi запустил настоящий совет
// (claude-opus-4-8, claude-fable-5, Haiku 4.5) без всякой нормы — сторожил только лимит
// «20 запусков в минуту с адреса». Теперь анонимный POST /multi-agent, /smart, /batch тратит
// ту же суточную норму гостя, что и консилиум на главной Мультичата.
//
// Проверяется ТА ЖЕ мидлвара, что смонтирована в routes/qcoreai.ts, и сам монтаж (чтение источника).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));

import { анонимныйЗапускМультиагента } from "../src/lib/qcoreAnonRunGate";
import { сброситьСчётГостей, остатокГостя } from "../src/lib/multichatGuestPass";

function запрос(ip = "203.0.113.9") {
  return { method: "POST", path: "/multi-agent", ip, headers: {}, body: {}, get: () => undefined } as never;
}

function ответ(статус = 200) {
  const e = new EventEmitter() as EventEmitter & { statusCode: number; body?: unknown; status: (n: number) => unknown; json: (b: unknown) => unknown };
  e.statusCode = статус;
  e.status = (n: number) => { e.statusCode = n; return e; };
  e.json = (b: unknown) => { e.body = b; return e; };
  return e;
}

/** Один заход анонима: пустила ли мидлвара, и чем ответила, если нет. */
async function заход(req: never, статусПослеОтвета = 200) {
  const res = ответ();
  let пропущен = false;
  await new Promise<void>((готово) => {
    анонимныйЗапускМультиагента(req, res as never, () => { пропущен = true; готово(); });
    if (res.statusCode === 402) готово();
    setTimeout(готово, 30);
  });
  if (пропущен) {
    res.statusCode = статусПослеОтвета;
    res.emit("finish");
    await new Promise((r) => setTimeout(r, 10));
  }
  return { пропущен, res };
}

beforeEach(() => { сброситьСчётГостей(); delete process.env.MULTICHAT_GUEST_FREE_PER_DAY; });

describe("анонимный мультиагент идёт по счёту", () => {
  it("два запуска пускает, третий — 402 с адресом входа", async () => {
    const req = запрос();
    expect((await заход(req)).пропущен).toBe(true);
    expect((await заход(req)).пропущен).toBe(true);
    const третий = await заход(req);
    expect(третий.пропущен).toBe(false);
    expect(третий.res.statusCode).toBe(402);
    const b = третий.res.body as { error: string; loginUrl: string; remaining: number };
    expect(b.error).toBe("guest_quota_exhausted");
    expect(b.loginUrl).toContain("/auth?next=");
    expect(b.remaining).toBe(0);
  });

  it("запуск с ошибкой норму не съедает", async () => {
    const req = запрос("203.0.113.10");
    await заход(req, 400);
    await заход(req, 500);
    expect((await остатокГостя(req)).осталось).toBe(2);
  });

  it("норма общая с консилиумом главной: считается по тому же гостю", async () => {
    const req = запрос("203.0.113.11");
    await заход(req);
    expect((await остатокГостя(req)).использовано).toBe(1);
  });

  it("вошедший (настоящий токен) идёт мимо счёта гостя, подделанный токен — всё ещё гость", async () => {
    const jwt = await import("jsonwebtoken");
    const { getJwtSecret } = await import("../src/lib/authJwt");
    const настоящий = jwt.sign({ sub: "user_77", email: "u@example.com" }, getJwtSecret(), { algorithm: "HS256" });
    const подделка = jwt.sign({ sub: "user_77", email: "u@example.com" }, "чужой-секрет", { algorithm: "HS256" });
    const сТокеном = (ip: string, токен: string) =>
      ({ method: "POST", path: "/multi-agent", ip, headers: { authorization: `Bearer ${токен}` }, body: {}, get: () => undefined }) as never;

    // Вошедший: сколько ни ходи — 402 нет, норма гостя не тратится.
    for (let i = 0; i < 4; i++) expect((await заход(сТокеном("203.0.113.12", настоящий))).пропущен).toBe(true);
    expect((await остатокГостя(запрос("203.0.113.12"))).использовано).toBe(0);

    // Подделка не даёт безлимита: после двух запусков — 402.
    expect((await заход(сТокеном("203.0.113.13", подделка))).пропущен).toBe(true);
    expect((await заход(сТокеном("203.0.113.13", подделка))).пропущен).toBe(true);
    expect((await заход(сТокеном("203.0.113.13", подделка))).res.statusCode).toBe(402);
  });
});

describe("браузер /qcoreai/multi: только x-devhub-guest, адрес узла Vercel меняется", () => {
  // Замер 2.11.2026 (прод, чистый браузер): три запуска подряд — 200, 200, 200; адрес гостя от
  // сайта не дошёл, а адрес соединения у каждого запроса свой.
  const изБраузера = (ip: string, гость: string) =>
    ({
      method: "POST", path: "/multi-agent", ip, headers: { "x-devhub-guest": гость }, body: {},
      get: (h: string) => (h.toLowerCase() === "x-devhub-guest" ? гость : undefined),
    }) as never;

  it("третий запуск того же браузера с нового адреса — 402", async () => {
    expect((await заход(изБраузера("198.51.100.1", "g-браузер-1"))).пропущен).toBe(true);
    expect((await заход(изБраузера("198.51.100.2", "g-браузер-1"))).пропущен).toBe(true);
    const третий = await заход(изБраузера("198.51.100.3", "g-браузер-1"));
    expect(третий.пропущен).toBe(false);
    expect(третий.res.statusCode).toBe(402);
  });

  it("другой браузер со своим id — своя норма", async () => {
    await заход(изБраузера("198.51.100.4", "g-браузер-2"));
    await заход(изБраузера("198.51.100.5", "g-браузер-2"));
    expect((await заход(изБраузера("198.51.100.6", "g-браузер-3"))).пропущен).toBe(true);
  });
});

describe("монтаж: ворота стоят на всех трёх ручках, зовущих модели", () => {
  const src = readFileSync(join(__dirname, "../src/routes/qcoreai.ts"), "utf8");
  for (const путь of ["/multi-agent", "/smart", "/batch"]) {
    it(`POST ${путь} проходит через анонимныйЗапускМультиагента`, () => {
      const строка = src.split("\n").find((l) => l.includes(`qcoreaiRouter.post("${путь}"`)) ?? "";
      expect(строка).toContain("анонимныйЗапускМультиагента");
    });
  }
});
