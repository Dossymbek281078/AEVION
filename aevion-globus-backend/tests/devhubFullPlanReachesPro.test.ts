import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Подписчик Full получает DevHub Pro — решение основателя 14.09.2026.
 *
 * До этого дня тариф DevHub брался только из его собственных таблиц, и человек,
 * купивший Full ради «всех продуктов AEVION», видел в DevHub бесплатный тариф.
 * Отдельно закреплена ловушка: явный «free» в таблице DevHub (так вебхук отмечает
 * отмену отдельной подписки) не должен перекрывать действующий Full.
 */
const DIR = mkdtempSync(join(tmpdir(), "devhub-full-plan-"));
process.env.SUBSCRIPTIONS_FILE = join(DIR, "subscriptions.jsonl");
const EMAIL = "full-buyer@example.test";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }), getPoolStats: () => null }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

const app = () => express().use(express.json()).use("/api/devhub", devhubRouter);
const future = new Date(Date.now() + 30 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

function subscription(tierId: string | null, validUntil = future, modules: string[] = []) {
  const body = tierId
    ? JSON.stringify({ id: "t", ts: new Date().toISOString(), email: EMAIL, tierId, period: "monthly", seats: 1, modules, trialDays: 0, validUntil }) + "\n"
    : "";
  writeFileSync(process.env.SUBSCRIPTIONS_FILE as string, body);
}

function database(ownTier?: string) {
  mockQuery.mockImplementation(async (sql?: string) => {
    const q = typeof sql === "string" ? sql.toUpperCase() : "";
    if (q.includes('FROM "DEVHUBTIER"')) return ownTier ? { rows: [{ tier: ownTier }], rowCount: 1 } : { rows: [], rowCount: 0 };
    if (q.includes("DEVHUBEMAILTIER")) return { rows: [], rowCount: 0 };
    if (q.includes('"AEVIONUSER"') && q.includes('"DEVHUBGUESTEMAIL"')) return { rows: [{ email: EMAIL }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

async function tier(): Promise<string> {
  const r = await request(app()).get("/api/devhub/studio/credits");
  expect(r.status).toBe(200);
  return r.body.tier;
}

describe("подписка платформы открывает DevHub Pro", () => {
  beforeEach(() => mockQuery.mockReset());
  afterAll(() => rmSync(DIR, { recursive: true, force: true }));

  test("контроль прибора: без подписки — бесплатный", async () => {
    subscription(null); database();
    expect(await tier()).toBe("free");
  });

  test("действующий Full — Pro", async () => {
    subscription("full"); database();
    expect(await tier(), "подписчик Full видит бесплатный DevHub").toBe("pro");
  });

  test("истёкший Full — бесплатный", async () => {
    subscription("full", past); database();
    expect(await tier()).toBe("free");
  });

  test("Lite без выбранного DevHub — бесплатный", async () => {
    subscription("lite", future, ["qsign"]); database();
    expect(await tier()).toBe("free");
  });

  test("явный free в таблице DevHub не перекрывает действующий Full", async () => {
    subscription("full"); database("free");
    expect(await tier(), "отмена отдельной подписки DevHub отняла доступ по Full").toBe("pro");
  });
});
