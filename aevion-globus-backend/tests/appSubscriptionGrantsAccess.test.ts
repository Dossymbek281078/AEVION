import { describe, test, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";

/**
 * «Купил модуль — пустили в модуль».
 *
 * Замер 13.08.2026: девять модулей продаются отдельными подписками, вебхук
 * пишет покупку в `AppSubscription`, и на этом всё — `planGate` брал права
 * только из тарифа и JWT. При включении платного доступа купивший модуль
 * упёрся бы в отказ наравне с гостем: заплатил и не пустили.
 *
 * Тест гоняет НАСТОЯЩИЙ requireModule с включённым пейволлом; подменены только
 * база и файл подписок.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-appsub-"));
process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl"); // тарифа нет ни у кого
process.env.AUTH_JWT_SECRET = "test-secret-at-least-32-chars-long-aevion-000";
process.env.PAYWALL_MODULES = "qventure"; // закрываем ровно один продаваемый модуль
process.env.NODE_ENV = "test";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { requireModule } from "../src/lib/planGate";
// eslint-disable-next-line import/first
import { resetAppEntitlementsCache } from "../src/lib/appEntitlements";

function reqOf(email: string | null) {
  const headers: Record<string, string> = {};
  if (email) {
    headers.authorization = `Bearer ${jwt.sign({ sub: "u1", email }, process.env.AUTH_JWT_SECRET as string, { algorithm: "HS256" })}`;
  }
  return { headers, method: "GET", path: "/analyze", query: {} } as never;
}

function resOf() {
  return {
    statusCode: 0,
    body: null as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
    setHeader() { return this; },
  };
}

/** Прогоняет гейт и говорит, пустили ли. */
async function passes(email: string | null): Promise<{ allowed: boolean; status: number }> {
  const gate = requireModule("qventure");
  const res = resOf();
  let allowed = false;
  await gate(reqOf(email), res as never, (() => { allowed = true; }) as never);
  return { allowed, status: res.statusCode };
}

/**
 * Сколько раз спросили именно про купленные модули. Считать ВСЕ обращения к базе
 * нельзя: на пути отказа пишется журнал отказов (`paywallDenyLog`), он тоже
 * ходит в базу — я на этом и споткнулся, утверждение «база не дёргается» было
 * неверным про сам тест, а не про код.
 */
function appSubscriptionQueries(): number {
  return mockQuery.mock.calls.filter((c) => String(c[0]).includes("AppSubscription")).length;
}

function rowsFor(...slugs: string[]) {
  return { rows: slugs.map((s) => ({ appSlug: s })), rowCount: slugs.length };
}

beforeEach(() => {
  mockQuery.mockReset();
  resetAppEntitlementsCache();
});

describe("отдельная подписка на модуль открывает этот модуль", () => {
  test("купивший QVenture проходит, хотя тарифа у него нет", async () => {
    mockQuery.mockResolvedValue(rowsFor("qventure"));

    const { allowed } = await passes("buyer@test.aev");

    expect(allowed).toBe(true);
  });

  test("не купивший получает отказ 402", async () => {
    mockQuery.mockResolvedValue(rowsFor());

    const { allowed, status } = await passes("nobody@test.aev");

    expect(allowed).toBe(false);
    expect(status).toBe(402);
  });

  test("подписка на ДРУГОЙ модуль сюда не пускает", async () => {
    mockQuery.mockResolvedValue(rowsFor("cyberchess", "qpaynet"));

    const { allowed } = await passes("buyer@test.aev");

    expect(allowed).toBe(false);
  });

  test("гость без почты не пускается и базу не дёргает", async () => {
    const { allowed } = await passes(null);

    expect(allowed).toBe(false);
    expect(appSubscriptionQueries()).toBe(0);
  });

  test("сбой базы закрывает доступ, а не открывает", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));

    const { allowed, status } = await passes("buyer@test.aev");

    expect(allowed).toBe(false);
    // 503, а не 402. Главное — доступ закрыт — не изменилось и проверяется
    // строкой выше. Изменилась ПРИЧИНА, и она должна быть честной: 402
    // говорит уже заплатившему «нужно заплатить», и клиент по такому ответу
    // уводит его в кассу второй раз. 503 говорит «мы сейчас не смогли
    // проверить» — то, что и произошло. Отказ базы это наша авария, а не
    // заявление о его платеже.
    expect(status).toBe(503);
  });

  test("повторный запрос берётся из кэша — база не опрашивается дважды", async () => {
    mockQuery.mockResolvedValue(rowsFor("qventure"));

    await passes("buyer@test.aev");
    await passes("buyer@test.aev");

    expect(appSubscriptionQueries()).toBe(1);
  });

  test("у модуля, который не продаётся отдельно, база не спрашивается вовсе", async () => {
    process.env.PAYWALL_MODULES = "qfusionai"; // закрыт, но отдельной подпиской не продаётся
    mockQuery.mockResolvedValue(rowsFor("qventure"));

    const gate = requireModule("qfusionai");
    const res = resOf();
    let allowed = false;
    await gate(reqOf("buyer@test.aev"), res as never, (() => { allowed = true; }) as never);

    expect(allowed).toBe(false);
    expect(appSubscriptionQueries()).toBe(0);
    process.env.PAYWALL_MODULES = "qventure";
  });
});
