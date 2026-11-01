// Общий суточный потолок анонимов с недоверенным адресом (решение Оркестратора 1.11.2026).
//
// ЗАМЕР 1.11.2026 на проде: через aevion.app/api-backend 36 запросов с разными x-aevion-device — все 200;
// у /api/qcoreai/* нет прокси сайта, бэк видит адрес узла Vercel (guestIpFromSite accepted 0, noKey 1039).
// Потолок на адрес не держал. Ограничиваем расход: 300 в сутки на всю платформу.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));

import { анонимныйПотолокПлатформы, потолокПлатформыВСутки } from "../src/lib/qcoreAnonPlatformCap";
import { сброситьСчётГостей } from "../src/lib/multichatGuestPass";

const СЕКРЕТ = "edge-secret-0123456789abcdef";

function запрос(заголовки: Record<string, string> = {}) {
  const h = Object.fromEntries(Object.entries(заголовки).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method: "POST", path: "/chat", ip: "203.0.113.9", headers: h, body: {},
    get: (n: string) => h[n.toLowerCase()],
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

async function заход(req: never) {
  const res = ответ();
  let пропущен = false;
  await new Promise<void>((готово) => {
    анонимныйПотолокПлатформы(req, res as never, () => { пропущен = true; готово(); });
    setTimeout(готово, 30);
  });
  if (пропущен) {
    res.emit("finish");
    await new Promise((r) => setTimeout(r, 2));
  }
  return { пропущен, res };
}

beforeEach(() => {
  сброситьСчётГостей();
  delete process.env.ANON_PLATFORM_PER_DAY;
  process.env.AEVION_EDGE_KEY = СЕКРЕТ;
});
afterEach(() => {
  delete process.env.AEVION_EDGE_KEY;
});

describe("потолок платформы для анонимов с недоверенным адресом", () => {
  it("прибор видит предмет: по умолчанию 300", () => {
    expect(потолокПлатформыВСутки()).toBe(300);
  });

  it("301-й анонимный запрос без доверенного адреса — 402 guest_quota_exhausted со ссылкой на вход", async () => {
    process.env.ANON_PLATFORM_PER_DAY = "300";
    for (let i = 0; i < 300; i++) {
      const x = await заход(запрос({ "x-aevion-device": `dev-${i}` }));
      expect(x.пропущен, `запрос ${i + 1}`).toBe(true);
    }
    const последний = await заход(запрос({ "x-aevion-device": "dev-300" }));
    expect(последний.пропущен).toBe(false);
    expect(последний.res.statusCode).toBe(402);
    const b = последний.res.body as { error: string; loginUrl: string; scope: string; remaining: number };
    expect(b.error).toBe("guest_quota_exhausted");
    expect(b.scope).toBe("platform");
    expect(b.loginUrl).toContain("/auth?next=");
    expect(b.remaining).toBe(0);
  });

  it("после потолка: вошедший — мимо (200), гость с доверенным адресом — мимо", async () => {
    process.env.ANON_PLATFORM_PER_DAY = "2";
    for (let i = 0; i < 2; i++) await заход(запрос());
    expect((await заход(запрос())).res.statusCode).toBe(402);

    const jwt = await import("jsonwebtoken");
    const { getJwtSecret } = await import("../src/lib/authJwt");
    const токен = jwt.sign({ sub: "user_77", email: "u@example.com" }, getJwtSecret(), { algorithm: "HS256" });
    expect((await заход(запрос({ authorization: `Bearer ${токен}` }))).пропущен).toBe(true);

    const доверенный = запрос({ "x-aevion-edge-key": СЕКРЕТ, "x-aevion-client-ip": "198.51.100.77" });
    expect((await заход(доверенный)).пропущен).toBe(true);
  });

  it("подделанный токен и чужой секрет не дают обойти потолок", async () => {
    process.env.ANON_PLATFORM_PER_DAY = "1";
    await заход(запрос());
    const jwt = await import("jsonwebtoken");
    const подделка = jwt.sign({ sub: "user_77" }, "чужой-секрет", { algorithm: "HS256" });
    expect((await заход(запрос({ authorization: `Bearer ${подделка}` }))).res.statusCode).toBe(402);
    expect((await заход(запрос({ "x-aevion-edge-key": "чужой-секрет-чужой-секрет", "x-aevion-client-ip": "198.51.100.1" }))).res.statusCode).toBe(402);
  });

  it("ответ с ошибкой (4xx/5xx) потолок не тратит", async () => {
    process.env.ANON_PLATFORM_PER_DAY = "1";
    const res = ответ();
    await new Promise<void>((готово) => {
      анонимныйПотолокПлатформы(запрос(), res as never, () => готово());
    });
    res.statusCode = 502;
    res.emit("finish");
    await new Promise((r) => setTimeout(r, 5));
    expect((await заход(запрос())).пропущен).toBe(true);
  });

  it("проверка адреса не трогает счётчики /health (удвоения нет)", async () => {
    const { сводкаАдресаГостя } = await import("../src/lib/siteProxyAddress");
    const до = сводкаАдресаГостя().noKey;
    await заход(запрос());
    expect(сводкаАдресаГостя().noKey).toBe(до);
  });
});

describe("монтаж: потолок первым звеном на всех пяти ручках", () => {
  const src = readFileSync(join(__dirname, "../src/routes/qcoreai.ts"), "utf8");
  for (const путь of ["/chat", "/chat-stream", "/multi-agent", "/smart", "/batch"]) {
    it(`POST ${путь}: анонимныйПотолокПлатформы идёт сразу после пути`, () => {
      const строка = src.split("\n").find((l) => l.includes(`qcoreaiRouter.post("${путь}"`)) ?? "";
      expect(строка).toContain(`qcoreaiRouter.post("${путь}", анонимныйПотолокПлатформы,`);
    });
  }
});
