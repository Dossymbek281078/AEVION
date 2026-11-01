// Анонимный чат /qcoreai/chat и /chat-stream: 10 сообщений в сутки, одна дешёвая модель.
//
// ЗАМЕР 1.11.2026 по коду: аноним без входа шёл по умолчанию на claude-opus-4-8 и мог назвать любую
// модель; нормы не было (только 30/мин с адреса и 120/мин на платформу). Решение Оркестратора:
// 10 в сутки на счёт гостя, одна модель класса haiku, другая — 4xx, а не тихая замена.
//
// Проверяется ТА ЖЕ мидлвара, что смонтирована в routes/qcoreai.ts, и сам монтаж (чтение источника).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));

const ПОСТАВЩИКИ = vi.hoisted(() => ({
  список: [] as unknown[],
}));
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => ПОСТАВЩИКИ.список,
}));

import { анонимныйЧат, анонимнаяМодель, анонимныйЧатВСутки } from "../src/lib/qcoreAnonChatGate";
import { сброситьСчётГостей, остатокГостя } from "../src/lib/multichatGuestPass";

type П = {
  id: string; name: string; models: string[]; defaultModel: string; envKey: string;
  configured: boolean; free: boolean; tier: "premium" | "budget" | "free";
};
const claude = (configured = true): П => ({
  id: "anthropic", name: "Claude", models: ["claude-opus-4-8", "claude-fable-5", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  defaultModel: "claude-opus-4-8", envKey: "K", configured, free: false, tier: "premium",
});
const gemini = (): П => ({
  id: "gemini", name: "Gemini", models: ["gemini-2.5-flash"], defaultModel: "gemini-2.5-flash",
  envKey: "K", configured: true, free: false, tier: "budget",
});
const openai = (): П => ({
  id: "openai", name: "GPT", models: ["gpt-4o", "gpt-4o-mini"], defaultModel: "gpt-4o",
  envKey: "K", configured: true, free: false, tier: "premium",
});

function запрос(тело: Record<string, unknown> = {}, ip = "198.51.100.5", заголовки: Record<string, string> = {}) {
  return {
    method: "POST", path: "/chat", ip, headers: { ...заголовки }, body: { ...тело },
    get: (h: string) => (h.toLowerCase() === "authorization" ? заголовки.authorization : undefined),
  } as never;
}

function ответ() {
  const e = new EventEmitter() as EventEmitter & {
    statusCode: number; body?: unknown; status: (n: number) => unknown; json: (b: unknown) => unknown;
  };
  e.statusCode = 200;
  e.status = (n: number) => { e.statusCode = n; return e; };
  e.json = (b: unknown) => { e.body = b; return e; };
  return e;
}

/** Один заход: пропущен ли, чем ответили, что стало с телом запроса. */
async function заход(req: never, статусПослеОтвета = 200) {
  const res = ответ();
  let пропущен = false;
  await new Promise<void>((готово) => {
    анонимныйЧат(req, res as never, () => { пропущен = true; готово(); });
    setTimeout(готово, 30);
  });
  if (пропущен) {
    res.statusCode = статусПослеОтвета;
    res.emit("finish");
    await new Promise((r) => setTimeout(r, 10));
  }
  return { пропущен, res, тело: (req as { body: Record<string, unknown> }).body };
}

const НОРМА_ЧАТА = { область: "chat", лимит: 10 };

beforeEach(() => {
  сброситьСчётГостей();
  delete process.env.ANON_CHAT_PER_DAY;
  delete process.env.ANON_CHAT_PER_IP_DAY;
  ПОСТАВЩИКИ.список = [claude(), gemini(), openai()];
});

describe("какая модель у анонима", () => {
  it("класс haiku у рабочего поставщика, не умолчание opus", () => {
    expect(анонимнаяМодель(ПОСТАВЩИКИ.список as never)).toEqual({ providerId: "anthropic", model: "claude-haiku-4-5-20251001" });
  });
  it("нет рабочего Claude — дешёвый поставщик, а не премиум", () => {
    ПОСТАВЩИКИ.список = [claude(false), openai(), gemini()];
    expect(анонимнаяМодель(ПОСТАВЩИКИ.список as never)).toEqual({ providerId: "gemini", model: "gemini-2.5-flash" });
  });
  it("только премиум без haiku — null (аноним получит 503, а не opus)", () => {
    ПОСТАВЩИКИ.список = [openai()];
    expect(анонимнаяМодель(ПОСТАВЩИКИ.список as never)).toBeNull();
  });
});

describe("норма: 10 в сутки, 11-е — 402", () => {
  it("прибор видит предмет: по умолчанию 10", () => {
    expect(анонимныйЧатВСутки()).toBe(10);
  });

  it("10 сообщений проходят, 11-е — 402 guest_quota_exhausted со ссылкой на вход", async () => {
    const req = () => запрос({ messages: [{ role: "user", content: "привет" }] });
    for (let i = 0; i < 10; i++) expect((await заход(req())).пропущен, `сообщение ${i + 1}`).toBe(true);
    const одиннадцатое = await заход(req());
    expect(одиннадцатое.пропущен).toBe(false);
    expect(одиннадцатое.res.statusCode).toBe(402);
    const b = одиннадцатое.res.body as { error: string; loginUrl: string; remaining: number };
    expect(b.error).toBe("guest_quota_exhausted");
    expect(b.loginUrl).toContain("/auth?next=");
    expect(b.remaining).toBe(0);
  });

  it("запрос с ошибкой норму не тратит", async () => {
    await заход(запрос({ messages: [] }, "198.51.100.6"), 400);
    await заход(запрос({ messages: [] }, "198.51.100.6"), 502);
    expect((await остатокГостя(запрос({}, "198.51.100.6"), НОРМА_ЧАТА)).использовано).toBe(0);
  });

  it("чат и консилиум считаются порознь: чат не съедает 2 запуска мультиагента", async () => {
    for (let i = 0; i < 3; i++) await заход(запрос({}, "198.51.100.7"));
    expect((await остатокГостя(запрос({}, "198.51.100.7"))).использовано).toBe(0);
    expect((await остатокГостя(запрос({}, "198.51.100.7"), НОРМА_ЧАТА)).использовано).toBe(3);
  });
});

describe("модель: одна, другая — 4xx, а не тихая замена", () => {
  it("opus от анонима — 400 model_requires_sign_in, запрос не пропущен и норма цела", async () => {
    const исход = await заход(запрос({ provider: "anthropic", model: "claude-opus-4-8" }, "198.51.100.8"));
    expect(исход.пропущен).toBe(false);
    expect(исход.res.statusCode).toBe(400);
    const b = исход.res.body as { error: string; allowedModel: string; loginUrl: string };
    expect(b.error).toBe("model_requires_sign_in");
    expect(b.allowedModel).toBe("claude-haiku-4-5-20251001");
    expect(b.loginUrl).toContain("/auth");
    expect((await остатокГостя(запрос({}, "198.51.100.8"), НОРМА_ЧАТА)).использовано).toBe(0);
  });

  it("чужой поставщик — тоже 400 (GPT вместо Claude)", async () => {
    const исход = await заход(запрос({ provider: "openai" }, "198.51.100.9"));
    expect(исход.res.statusCode).toBe(400);
  });

  it("запросил ровно свою модель — пропущен", async () => {
    const исход = await заход(запрос({ provider: "anthropic", model: "claude-haiku-4-5-20251001" }, "198.51.100.10"));
    expect(исход.пропущен).toBe(true);
  });

  it("не выбирал ничего — пропущен, и в теле стоит haiku, а не умолчание ручки (opus)", async () => {
    const исход = await заход(запрос({ messages: [{ role: "user", content: "привет" }] }, "198.51.100.11"));
    expect(исход.пропущен).toBe(true);
    expect(исход.тело.provider).toBe("anthropic");
    expect(исход.тело.model).toBe("claude-haiku-4-5-20251001");
  });

  it("нет дешёвой модели при настроенном премиуме — 503, не opus", async () => {
    ПОСТАВЩИКИ.список = [openai()];
    const исход = await заход(запрос({}, "198.51.100.12"));
    expect(исход.res.statusCode).toBe(503);
  });

  it("нет рабочих поставщиков вовсе (stub без расхода) — пускает как раньше", async () => {
    ПОСТАВЩИКИ.список = [claude(false)];
    expect((await заход(запрос({}, "198.51.100.13"))).пропущен).toBe(true);
  });
});

describe("вошедший идёт как раньше", () => {
  it("настоящий токен: любая модель; подделка — гость", async () => {
    const jwt = await import("jsonwebtoken");
    const { getJwtSecret } = await import("../src/lib/authJwt");
    const настоящий = jwt.sign({ sub: "user_88", email: "u@example.com" }, getJwtSecret(), { algorithm: "HS256" });
    const подделка = jwt.sign({ sub: "user_88", email: "u@example.com" }, "чужой-секрет", { algorithm: "HS256" });
    const вошедший = await заход(запрос({ model: "claude-opus-4-8" }, "198.51.100.14", { authorization: `Bearer ${настоящий}` }));
    expect(вошедший.пропущен).toBe(true);
    expect(вошедший.тело.model).toBe("claude-opus-4-8");
    const гость = await заход(запрос({ model: "claude-opus-4-8" }, "198.51.100.15", { authorization: `Bearer ${подделка}` }));
    expect(гость.res.statusCode).toBe(400);
  });
});

describe("монтаж: ворота стоят на обеих ручках чата", () => {
  const src = readFileSync(join(__dirname, "../src/routes/qcoreai.ts"), "utf8");
  for (const путь of ["/chat", "/chat-stream"]) {
    it(`POST ${путь} проходит через анонимныйЧат`, () => {
      const строка = src.split("\n").find((l) => l.includes(`qcoreaiRouter.post("${путь}"`)) ?? "";
      expect(строка).toContain("анонимныйЧат");
    });
  }
});
