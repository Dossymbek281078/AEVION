import { describe, test, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { deliverWebhook, type WebhookDeliveryConfig } from "../src/lib/webhookDelivery";

// Pool mock — captures every query so we can assert delivery-log shape.
function makePool() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return {
    queries,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    }),
  };
}

const cfg: WebhookDeliveryConfig = {
  webhookTable: "TestWebhook",
  deliveryTable: "TestWebhookDelivery",
  entityColumn: "objectId",
  userAgent: "AEVION-Test/1.0",
};

const cfgNoEntity: WebhookDeliveryConfig = {
  webhookTable: "TestWebhook",
  deliveryTable: "TestWebhookDelivery",
  entityColumn: null,
  userAgent: "AEVION-Test/1.0",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("deliverWebhook — wire contract", () => {
  test("computes HMAC-SHA256 hex over the raw body and sends it as X-AEVION-Signature", async () => {
    const captured: { headers?: Record<string, string>; body?: string } = {};
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      captured.headers = init.headers as Record<string, string>;
      captured.body = init.body as string;
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pool = makePool();
    const body = JSON.stringify({ event: "test", id: "abc" });
    const expected = crypto.createHmac("sha256", "secret-1").update(body).digest("hex");

    const result = await deliverWebhook(pool as any, cfg, {
      webhookId: "wh-1",
      url: "https://example.com/hook",
      secret: "secret-1",
      body,
      eventType: "test.event",
      entityId: "obj-1",
      isRetry: false,
    });

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(captured.body).toBe(body);
    expect(captured.headers?.["X-AEVION-Signature"]).toBe(`sha256=${expected}`);
    expect(captured.headers?.["User-Agent"]).toBe("AEVION-Test/1.0");
    expect(captured.headers?.["X-AEVION-Event"]).toBe("test.event");
    expect(captured.headers?.["Content-Type"]).toBe("application/json");
  });

  test("propagates non-2xx as ok=false with statusCode + error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const pool = makePool();
    const result = await deliverWebhook(pool as any, cfg, {
      webhookId: "wh-2",
      url: "https://example.com/hook",
      secret: "x",
      body: "{}",
      eventType: "e",
      entityId: null,
      isRetry: false,
    });
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.error).toBe("HTTP 503");
  });

  test("captures network errors without throwing (fire-and-forget contract)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));
    const pool = makePool();
    const result = await deliverWebhook(pool as any, cfg, {
      webhookId: "wh-3",
      url: "https://example.com/hook",
      secret: "x",
      body: "{}",
      eventType: "e",
      entityId: null,
      isRetry: true,
    });
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.error).toBe("ECONNREFUSED");
  });

  test("never throws even when delivery-log INSERT fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO")) throw new Error("db down");
        return { rows: [], rowCount: 0 };
      }),
    };
    // The catch is on the floating .catch() — await isn't needed for the
    // INSERT, but the function must still return cleanly.
    await expect(
      deliverWebhook(pool as any, cfg, {
        webhookId: "wh-4",
        url: "https://example.com/hook",
        secret: "x",
        body: "{}",
        eventType: "e",
        entityId: null,
        isRetry: false,
      })
    ).resolves.toMatchObject({ ok: true, statusCode: 200 });
  });
});

describe("deliverWebhook — SQL shape", () => {
  test("INSERT includes entityColumn when configured", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const pool = makePool();
    await deliverWebhook(pool as any, cfg, {
      webhookId: "wh-5",
      url: "https://example.com/hook",
      secret: "x",
      body: "{}",
      eventType: "e",
      entityId: "ent-1",
      isRetry: false,
    });
    // Wait a tick for the floating .catch() chain to enqueue.
    await new Promise((r) => setImmediate(r));
    const insert = pool.queries.find((q) => q.sql.includes("INSERT INTO"));
    expect(insert).toBeDefined();
    expect(insert!.sql).toContain('"objectId"');
    // The entity value gets pushed last when the column is configured.
    expect(insert!.params[insert!.params.length - 1]).toBe("ent-1");
  });

  test("INSERT omits entityColumn when null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const pool = makePool();
    await deliverWebhook(pool as any, cfgNoEntity, {
      webhookId: "wh-6",
      url: "https://example.com/hook",
      secret: "x",
      body: "{}",
      eventType: "e",
      entityId: "should-be-ignored",
      isRetry: false,
    });
    await new Promise((r) => setImmediate(r));
    const insert = pool.queries.find((q) => q.sql.includes("INSERT INTO"));
    expect(insert).toBeDefined();
    expect(insert!.sql).not.toContain('"objectId"');
    // 8 params for the entity-less form (id, webhookId, eventType, body, status, ok, error, isRetry).
    expect(insert!.params.length).toBe(8);
  });

  test("UPDATE writes lastDeliveredAt on success and lastFailedAt on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const okPool = makePool();
    await deliverWebhook(okPool as any, cfg, {
      webhookId: "wh-7",
      url: "https://example.com/hook",
      secret: "x",
      body: "{}",
      eventType: "e",
      entityId: null,
      isRetry: false,
    });
    await new Promise((r) => setImmediate(r));
    expect(okPool.queries.some((q) => q.sql.includes('"lastDeliveredAt"'))).toBe(true);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const failPool = makePool();
    await deliverWebhook(failPool as any, cfg, {
      webhookId: "wh-8",
      url: "https://example.com/hook",
      secret: "x",
      body: "{}",
      eventType: "e",
      entityId: null,
      isRetry: false,
    });
    await new Promise((r) => setImmediate(r));
    expect(failPool.queries.some((q) => q.sql.includes('"lastFailedAt"'))).toBe(true);
  });
});
