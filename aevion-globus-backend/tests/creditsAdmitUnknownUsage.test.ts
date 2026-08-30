import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * «Израсходовано 0» и «прочитать не удалось» — разные ответы.
 *
 * Замер 29.08.2026. Расход по месячному лимиту читается одной функцией, а
 * читают её ТРОЕ: проверка предела, запись расхода и витрина через
 * `GET /api/devhub/studio/credits`. При отказе базы все трое получали ноль.
 * Для витрины это худшая форма: человек видит «0 из 50» и понимает, что квота
 * нетронута, — то есть мы утверждаем факт, которого не измеряли.
 *
 * Проверяется ПОВЕДЕНИЕМ, а не исходником: подделываем базу, которая падает
 * именно на чтении расхода, и читаем ответ ручки. Сторож по тексту файла тут
 * был бы слабее — он не заметил бы, если признак перестанет доезжать до
 * ответа.
 *
 * Направление отказа НЕ проверяется и намеренно не меняется: закрывать ли
 * необратимое действие при непрочитанном расходе — продуктовое решение.
 * Здесь закрепляется только честность ответа.
 */

const { mockQuery, state } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  state: { usageFails: false, writeFails: false },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: () => [], callProvider: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __debitCreditForTest } from "../src/routes/devhub";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

beforeEach(() => {
  __resetDevHubStore?.();
  state.usageFails = false;
  state.writeFails = false;
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (text: string) => {
    if (/FROM "DevHubUsage"/i.test(text)) {
      if (state.usageFails) throw new Error("connection terminated unexpectedly");
      return { rows: [{ used: 7 }], rowCount: 1 };
    }
    if (/INSERT INTO "DevHubUsage"/i.test(text) && state.writeFails) {
      throw new Error("write failed");
    }
    if (/FROM "DevHubTier"/i.test(text)) return { rows: [{ tier: "free" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
});

function tokenFor(sub: string) {
  return jwt.sign({ sub, email: `${sub}@e.com`, role: "user" },
    process.env.AUTH_JWT_SECRET || "dev-auth-secret", { algorithm: "HS256" });
}

async function credits(sub?: string) {
  const req0 = request(makeApp()).get("/api/devhub/studio/credits");
  const r = sub ? await req0.set("Authorization", `Bearer ${tokenFor(sub)}`) : await req0;
  expect(r.status, `ручка не ответила 200: ${r.text.slice(0, 200)}`).toBe(200);
  return r.body as { usage: Record<string, { used: number; limit: number; usedKnown?: false }> };
}

describe("расход, который не удалось прочитать, не выдаётся за ноль", () => {
  test("контроль: при исправной базе число НАСТОЯЩЕЕ и признак снят", async () => {
    // Без этого «признак всегда true» прошло бы как успех.
    const body = await credits();
    expect(body.usage.video.used, "не доехало число из базы").toBe(7);
    // Признак ставится ТОЛЬКО когда поднят — на исправной базе поля нет
    // вовсе, и это осознанно (см. комментарий в getAllMonthUsage).
    expect(body.usage.video.usedKnown, "признак поднят на исправной базе").toBeUndefined();
  });

  test("при отказе чтения ответ ПРИЗНАЁТСЯ, что число ненадёжно", async () => {
    state.usageFails = true;
    const body = await credits();
    expect(
      body.usage.video.usedKnown === false,
      "витрина покажет «0 из 50» как факт: человек решит, что квота нетронута",
    ).toBe(true);
  });

  test("значение при отказе прежнее — направление не менялось", async () => {
    // Сторож стережёт честность ответа, а не отказ в обслуживании. Если кто-то
    // поменяет направление, пусть это будет осознанным решением: эта проверка
    // покраснеет и потребует его назвать.
    state.usageFails = true;
    const body = await credits();
    expect(body.usage.video.used, "поведение изменилось — это отдельное решение").toBe(0);
  });

  test("отложенное в память списание видно при ЖИВОЙ базе", async () => {
    // debitCredit паркует трату в память, когда её собственная запись не
    // удалась. Раньше эта карта читалась ТОЛЬКО при заведомо мёртвой базе —
    // то есть при живой списание уходило в никуда, и платный вызов доставался
    // бесплатно. Проверяем сложение, а не наличие: число обязано вырасти.
    const before = await credits("u-1");
    expect(before.usage.video.used, "контроль: база отдаёт своё число").toBe(7);

    state.writeFails = true;
    await __debitCreditForTest("u-1", "video", 3);
    state.writeFails = false;

    const after = await credits("u-1");
    expect(
      after.usage.video.used,
      "отложенное списание не прибавилось: при живой базе оно теряется",
    ).toBe(before.usage.video.used + 3);
  });

  test("признак есть у КАЖДОЙ возможности, а не у первой", async () => {
    // Разница в наборе ключей между ветками ответа — тот самый класс, который
    // не виден ни в коде, ни в одном ответе по отдельности.
    state.usageFails = true;
    const body = await credits();
    for (const cap of ["video", "image", "tts", "music", "deploy"]) {
      expect(
        Object.prototype.hasOwnProperty.call(body.usage[cap] ?? {}, "usedKnown"),
        `у возможности ${cap} признака нет — ветка забыта`,
      ).toBe(true);
    }
  });
});
