import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { stableStringify } from "../src/lib/stableStringify";

// Planet certification payout webhook — first tests, 2026-08-10.
//
// This endpoint moves money (AEC credit) and had no coverage. Two defects it
// shipped with, both of the "returns 2xx while doing the wrong thing" kind:
//
//   1. Idempotency lived only in an in-process Set. A restart emptied it, and
//      a restart is exactly when a sender retries — so the same certification
//      was credited twice. The certificates themselves are persisted, so the
//      evidence to detect the replay was already on disk, just unused.
//   2. When the credit call failed, the certificate was recorded anyway and
//      the response was 201 with a `creditError` field. Senders read the
//      status, not the body: delivery looked successful, no retry happened,
//      and the reward was silently lost.

const SECRET = "test-planet-webhook-secret";

const { mockCredit } = vi.hoisted(() => ({ mockCredit: vi.fn() }));

vi.mock("../src/routes/qtrade", () => ({
  internalCreditAccount: mockCredit,
}));

const { certs } = vi.hoisted(() => ({ certs: [] as any[] }));

vi.mock("../src/routes/ecosystem", () => ({
  ensureEcosystemLoaded: vi.fn().mockResolvedValue(undefined),
  planetCerts: certs,
  scheduleEcosystemPersist: vi.fn(),
}));

function sign(body: unknown, timestamp: string): string {
  // The receiver signs stableStringify(body) — sorted keys, same convention
  // QSign uses — so the test has to sign the same bytes.
  const raw = `${timestamp}.${stableStringify(body)}`;
  return crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
}

async function makeApp() {
  const { planetPayoutsRouter } = await import("../src/routes/planetPayouts");
  const app = express();
  app.use(express.json());
  app.use("/api/planet", planetPayoutsRouter);
  return app;
}

function post(app: express.Express, body: Record<string, unknown>) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return request(app)
    .post("/api/planet/payouts/certify-webhook")
    .set("x-aevion-timestamp", timestamp)
    .set("x-aevion-signature", sign(body, timestamp))
    .send(body);
}

const event = (over: Record<string, unknown> = {}) => ({
  eventId: "evt-1",
  email: "creator@example.com",
  artifactVersionId: "ver-1",
  amount: 25,
  ...over,
});

beforeEach(() => {
  process.env.PLANET_WEBHOOK_SECRET = SECRET;
  certs.length = 0;
  mockCredit.mockReset();
  mockCredit.mockResolvedValue({ ok: true, accountId: "acc_1", operationId: "op_1", balance: 25 });
});

afterEach(() => {
  delete process.env.PLANET_WEBHOOK_SECRET;
  vi.resetModules();
});

describe("a certification is credited once", () => {
  test("first delivery credits and records", async () => {
    const app = await makeApp();
    const res = await post(app, event());
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(res.body.transferId).toBe("op_1");
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(certs).toHaveLength(1);
  });

  test("a repeat of the same eventId does not credit again", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event());
    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(certs).toHaveLength(1);
  });

  test("a retry AFTER a restart is still recognised as a replay", async () => {
    // The defect this pins. The certificate survives a restart; the in-memory
    // Set does not. Re-importing the module is that restart.
    const first = await makeApp();
    await post(first, event());
    expect(mockCredit).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const afterRestart = await makeApp();
    const res = await post(afterRestart, event());

    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
    // Was: credited a second time, doubling the reward.
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(certs).toHaveLength(1);
  });

  test("a different eventId for the same artifact version is still one payout", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-2" }));
    expect(res.body.replayed).toBe(true);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });

  test("email case does not create a second payout", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-3", email: "Creator@Example.com" }));
    expect(res.body.replayed).toBe(true);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });

  test("a genuinely different artifact version is paid separately", async () => {
    const app = await makeApp();
    await post(app, event());
    const res = await post(app, event({ eventId: "evt-4", artifactVersionId: "ver-2" }));
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(mockCredit).toHaveBeenCalledTimes(2);
    expect(certs).toHaveLength(2);
  });
});

describe("a failed credit is not reported as a successful certification", () => {
  test("responds 502 and records nothing, so the sender retries", async () => {
    mockCredit.mockResolvedValue({ ok: false, error: "ledger unavailable" });
    const app = await makeApp();
    const res = await post(app, event());

    // Was: 201 with a creditError field the sender never reads — delivery
    // looked fine, no retry, reward lost.
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("credit_failed");
    expect(certs).toHaveLength(0);
  });

  test("the retry after a failure succeeds and pays exactly once", async () => {
    mockCredit.mockResolvedValueOnce({ ok: false, error: "ledger unavailable" });
    const app = await makeApp();
    await post(app, event());

    const res = await post(app, event());
    expect(res.status).toBe(201);
    expect(res.body.transferId).toBe("op_1");
    expect(certs).toHaveLength(1);
  });
});

describe("input and signature are checked before anything moves", () => {
  test("a bad signature is rejected without crediting", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/planet/payouts/certify-webhook")
      .set("x-aevion-timestamp", String(Math.floor(Date.now() / 1000)))
      .set("x-aevion-signature", "deadbeef")
      .send(event());
    expect(res.status).toBe(401);
    expect(mockCredit).not.toHaveBeenCalled();
  });

  test("a non-positive amount is refused", async () => {
    const app = await makeApp();
    for (const amount of [0, -5, "abc", null]) {
      const res = await post(app, event({ amount }));
      expect(res.status).toBe(400);
    }
    expect(mockCredit).not.toHaveBeenCalled();
  });

  test("missing fields are refused", async () => {
    const app = await makeApp();
    const res = await post(app, { eventId: "e", email: "a@b.c" });
    expect(res.status).toBe(400);
    expect(mockCredit).not.toHaveBeenCalled();
  });
});
