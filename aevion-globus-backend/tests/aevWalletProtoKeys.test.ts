import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// AEV wallets — hostile device ids, 2026-08-11.
//
// A campaign on 27.07 hardened object lookups against prototype keys across
// pricing, skill badges, qmelanin, qskyway, smeta-trainer, the Gumroad
// webhook and the LemonSqueezy variants. Seven branches. None of them touch
// routes/aev.ts, where wallets live — and that is the one holding balances.
//
// The gap: sanitizeDeviceId accepts /^[a-zA-Z0-9._-]{6,128}$/, and
// "__proto__", "constructor", "prototype" and "hasOwnProperty" all match it.
// The store is a plain object read from JSON, so:
//
//   wallets["__proto__"]            → Object.prototype, not undefined
//   if (!w) return 404              → never fires; a wallet "exists"
//   existing.userId                 → undefined, so the ownership check
//                                     that blocks takeover is skipped
//   wallets["__proto__"] = merged   → mutates the object's prototype
//
// None of it is exotic input: it is a device id in a URL.

const { mockRead, mockWrite } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
}));

vi.mock("../src/lib/jsonFileStore", () => ({
  readJsonFile: mockRead,
  writeJsonFile: mockWrite,
}));

async function makeApp() {
  const { aevRouter } = await import("../src/routes/aev");
  const app = express();
  app.use(express.json());
  app.use("/api/aev", aevRouter);
  return app;
}

/** One real wallet, so the store is not empty. */
const REAL = {
  "device-abc-123": {
    deviceId: "device-abc-123",
    userId: "user-1",
    balance: 10,
    lifetimeMined: 10,
    modes: {},
  },
};

beforeEach(() => {
  delete process.env.NODE_ENV;
  mockRead.mockReset();
  mockWrite.mockReset();
  // Fresh plain object each call, exactly as JSON.parse would produce.
  mockRead.mockImplementation(async (file: string, fallback: unknown) =>
    file.includes("wallet") ? JSON.parse(JSON.stringify(REAL)) : fallback,
  );
  mockWrite.mockResolvedValue(undefined);
});

const HOSTILE = ["__proto__", "constructor", "prototype", "hasOwnProperty"];

describe("prototype keys are not accepted as device ids", () => {
  test.each(HOSTILE)("GET /wallet/%s does not report a wallet", async (id) => {
    const app = await makeApp();
    const res = await request(app).get(`/api/aev/wallet/${id}`);
    // Was: 200 with `wallet: {}` for "__proto__" — the 404 guard reads
    // Object.prototype as an existing wallet.
    expect(res.status).not.toBe(200);
  });

  test.each(HOSTILE)("POST /wallet/%s/sync is refused", async (id) => {
    const app = await makeApp();
    const res = await request(app)
      .post(`/api/aev/wallet/${id}/sync`)
      .send({ balance: 999999, lifetimeMined: 999999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_device_id");
    // Nothing may be persisted for such an id.
    expect(mockWrite).not.toHaveBeenCalled();
  });
});

describe("ordinary device ids still work", () => {
  test("an existing wallet is returned", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/aev/wallet/device-abc-123");
    expect(res.status).toBe(200);
    expect(res.body.wallet.balance).toBe(10);
  });

  test("an unknown but well-formed id is a clean 404", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/aev/wallet/device-zzz-999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  test("ids with dots, dashes and underscores are still allowed", async () => {
    // The guard must reject prototype keys, not tighten the format — these
    // are legitimate device ids in the wild.
    const app = await makeApp();
    for (const id of ["dev.ice-123", "a_b-c.d1", "ABCdef123456"]) {
      const res = await request(app).get(`/api/aev/wallet/${id}`);
      expect(res.status).toBe(404); // well-formed, simply unknown
    }
  });

  test("malformed ids are still rejected as before", async () => {
    const app = await makeApp();
    for (const id of ["short", "has%20space"]) {
      const res = await request(app).get(`/api/aev/wallet/${id}`);
      expect(res.status).toBe(400);
    }
  });
});

describe("the internal mint path is guarded too", () => {
  // Bureau calls internalMintForDevice() with a deviceId taken straight from
  // the request body (routes/bureau.ts:815 — only checks it is a non-empty
  // string). So the guard cannot live only in the HTTP handlers: the export
  // has to refuse reserved names itself, or a reward mint would create
  // `wallets["__proto__"]` and rewrite the store's prototype.
  test.each(HOSTILE)("internalMintForDevice refuses %s", async (id) => {
    const { internalMintForDevice } = await import("../src/routes/aev");
    const r = await internalMintForDevice({
      deviceId: id,
      amount: 5,
      sourceKind: "test",
      sourceModule: "test",
      sourceAction: "test",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_device_id");
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test("a normal device id still mints", async () => {
    const { internalMintForDevice } = await import("../src/routes/aev");
    const r = await internalMintForDevice({
      deviceId: "device-abc-123",
      amount: 5,
      sourceKind: "test",
      sourceModule: "test",
      sourceAction: "test",
    });
    expect(r.ok).toBe(true);
  });
});
