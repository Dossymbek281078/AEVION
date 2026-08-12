import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { stableStringify } from "../src/lib/stableStringify";

// QRight royalty webhook — first tests, 2026-08-12.
//
// This endpoint moves money (AEC credit) and had no coverage. It shipped with
// the same two defects the Planet certification payout had, both of the
// "answers 2xx while doing the wrong thing" kind:
//
//   1. Idempotency lived only in an in-process Set. A restart emptied it, and
//      a restart is exactly when a sender retries — so the same royalty was
//      credited twice. The royalty events themselves are persisted, so the
//      evidence to spot the replay was already there, just unused.
//   2. When the credit call failed, the royalty was recorded anyway with
//      transferId null and the response was 201 with a `creditError` field.
//      Senders read the status, not the body: delivery looked fine, no retry
//      happened, and /earnings showed a payout that never landed.

const SECRET = "test-qright-webhook-secret";

const { mockCredit } = vi.hoisted(() => ({ mockCredit: vi.fn() }));

vi.mock("../src/routes/qtrade", () => ({
  internalCreditAccount: mockCredit,
}));

const { events } = vi.hoisted(() => ({ events: [] as any[] }));

vi.mock("../src/routes/ecosystem", () => ({
  ensureEcosystemLoaded: vi.fn().mockResolvedValue(undefined),
  royaltyEvents: events,
  scheduleEcosystemPersist: vi.fn(),
}));

// Only /royalties/summary touches Postgres; the webhook never does. Mocked so
// importing the router does not reach for a database that isn't there.
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => {
    throw new Error("no database in tests");
  },
}));

function sign(body: unknown, timestamp: string): string {
  // The receiver signs stableStringify(body) — sorted keys, the same
  // convention QSign uses — so the test has to sign the same bytes.
  const raw = `${timestamp}.${stableStringify(body)}`;
  return crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
}

async function makeApp() {
  const { qrightRoyaltiesRouter } = await import("../src/routes/qrightRoyalties");
  const app = express();
  app.use(express.json());
  app.use("/api/qright", qrightRoyaltiesRouter);
  return app;
}

function post(app: express.Express, body: Record<string, unknown>) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return request(app)
    .post("/api/qright/royalties/verify-webhook")
    .set("x-aevion-timestamp", timestamp)
    .set("x-aevion-signature", sign(body, timestamp))
    .send(body);
}

const event = (over: Record<string, unknown> = {}) => ({
  eventId: "evt-1",
  email: "author@example.com",
  productKey: "obj-1",
  period: "2026-07",
  amount: 40,
  ...over,
});

beforeEach(() => {
  process.env.QRIGHT_WEBHOOK_SECRET = SECRET;
  events.length = 0;
  mockCredit.mockReset();
  mockCredit.mockResolvedValue({ ok: true, accountId: "acc_1", operationId: "op_1", balance: 40 });
});

afterEach(() => {
  delete process.env.QRIGHT_WEBHOOK_SECRET;
  vi.resetModules();
});

describe("a royalty is credited once", () => {
  test("first delivery credits and records", async () => {
    const app = await makeApp();
    const res = await post(app, event());
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(res.body.transferId).toBe("op_1");
    expect(res.body.accountId).toBe("acc_1");
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
  });

  test("a repeat of the same eventId does not credit again", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event());
    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
  });

  test("a retry AFTER a restart is still recognised as a replay", async () => {
    // The defect this pins. The royalty event survives a restart; the
    // in-memory Set does not. Re-importing the module is that restart.
    const first = await makeApp();
    await post(first, event());
    expect(mockCredit).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const afterRestart = await makeApp();
    const res = await post(afterRestart, event());

    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
    // Was: credited a second time, paying the same period twice.
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
  });

  test("a different eventId for the same product and period is still one payout", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-2" }));
    expect(res.body.replayed).toBe(true);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });

  test("email case does not create a second payout", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-3", email: "Author@Example.com" }));
    expect(res.body.replayed).toBe(true);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });

  test("a genuinely different period is paid separately", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-4", period: "2026-08" }));
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(mockCredit).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(2);
  });

  test("a different product in the same period is paid separately", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-5", productKey: "obj-2" }));
    expect(res.status).toBe(201);
    expect(mockCredit).toHaveBeenCalledTimes(2);
  });
});

describe("a royalty that was not paid is not recorded as paid", () => {
  test("a failed credit answers 502 and writes nothing", async () => {
    mockCredit.mockResolvedValue({ ok: false, error: "account frozen" });
    const app = await makeApp();
    const res = await post(app, event());

    // Was: 201 with creditError, and a royalty row with transferId null that
    // /earnings happily reported as income.
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("credit_failed");
    expect(res.body.reason).toBe("account frozen");
    expect(events).toHaveLength(0);
  });

  test("after a failure the sender's retry runs the whole thing again", async () => {
    // The point of failing loudly: the event must not be remembered as seen,
    // or the retry would come back "replayed" and the money never move.
    mockCredit.mockResolvedValueOnce({ ok: false, error: "temporary" });
    const app = await makeApp();
    const failed = await post(app, event());
    expect(failed.status).toBe(502);

    mockCredit.mockResolvedValue({ ok: true, accountId: "acc_1", operationId: "op_2", balance: 40 });
    const retried = await post(app, event());

    expect(retried.status).toBe(201);
    expect(retried.body.replayed).toBe(false);
    expect(retried.body.transferId).toBe("op_2");
    expect(events).toHaveLength(1);
  });

  test("no successful response carries a creditError field any more", async () => {
    const app = await makeApp();
    const res = await post(app, event());
    expect(res.body).not.toHaveProperty("creditError");
  });
});

describe("the guard is not vacuous", () => {
  test("a bad signature is rejected before any credit", async () => {
    const app = await makeApp();
    const body = event();
    const res = await request(app)
      .post("/api/qright/royalties/verify-webhook")
      .set("x-aevion-timestamp", String(Math.floor(Date.now() / 1000)))
      .set("x-aevion-signature", "deadbeef")
      .send(body);
    expect(res.status).toBe(401);
    expect(mockCredit).not.toHaveBeenCalled();
  });

  test("a non-positive amount is rejected before any credit", async () => {
    const app = await makeApp();
    const res = await post(app, event({ amount: 0 }));
    expect(res.status).toBe(400);
    expect(mockCredit).not.toHaveBeenCalled();
  });

  test("missing fields are rejected before any credit", async () => {
    const app = await makeApp();
    const res = await post(app, { eventId: "evt-9", email: "a@b.c" });
    expect(res.status).toBe(400);
    expect(mockCredit).not.toHaveBeenCalled();
  });
});
