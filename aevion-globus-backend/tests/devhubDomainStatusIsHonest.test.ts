import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: vi.fn(() => []), callProvider: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetAevionBuildZoneCache } from "../src/routes/devhub";

/**
 * «Live» у возможности domain означало «ключи заданы», а не «домен работает».
 *
 * Пока зона aevion.build не делегирована, КАЖДЫЙ выданный адрес *.aevion.build
 * не разрешается — то есть возможность объявлялась рабочей, будучи мёртвой.
 * Наша же проба cloudflare_zone в том же файле знала правду: два наших ответа
 * об одном спорили, и ежедневный смоук на это краснел.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

function zoneReplies(status: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: { status } }),
  })) as unknown as typeof fetch;
}

const KEYS = {
  CLOUDFLARE_API_TOKEN: "t",
  CLOUDFLARE_ZONE_ID: "z",
  CLOUDFLARE_ACCOUNT_ID: "a",
};

describe("возможность domain не объявляется рабочей, пока зона не делегирована", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of Object.keys(KEYS)) saved[k] = process.env[k];
    Object.assign(process.env, KEYS);
    __resetAevionBuildZoneCache();
  });
  afterEach(() => {
    for (const k of Object.keys(KEYS)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
  });

  async function domainCap() {
    const res = await request(app()).get("/api/devhub/studio/capabilities");
    expect(res.status, "ручка не ответила — тест смотрит не туда").toBe(200);
    const list = (res.body?.capabilities ?? res.body) as Array<Record<string, unknown>>;
    const d = (Array.isArray(list) ? list : []).find((c) => c.id === "domain");
    expect(d, "возможность domain не найдена в ответе").toBeTruthy();
    return d as Record<string, unknown>;
  }

  test("зона НЕ делегирована (pending) — не «live», и человеку названа причина", async () => {
    vi.stubGlobal("fetch", zoneReplies("pending"));
    const d = await domainCap();
    expect(d.status, "домен объявлен рабочим при неделегированной зоне").not.toBe("live");
    expect(
      String(d.lastError || ""),
      "человеку не сказано, ПОЧЕМУ возможность выключена",
    ).toContain("не делегирован");
  });

  test("контроль: зона активна — возможность действительно «live»", async () => {
    vi.stubGlobal("fetch", zoneReplies("active"));
    const d = await domainCap();
    expect(d.status, "рабочая зона выключила возможность — это глушилка, а не проверка").toBe("live");
  });

  test("проба не ответила — возможность не «live», но и ложной причины нет", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("сеть"); }) as unknown as typeof fetch);
    const d = await domainCap();
    expect(d.status).not.toBe("live");
  });
});
