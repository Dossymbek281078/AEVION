import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createApiKey,
  validateApiKey,
  listApiKeys,
  deleteApiKey,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("V43 — API keys (in-memory fallback)", () => {

  test("createApiKey returns key with prefix 'qck_'", async () => {
    const userId = uid();
    const result = await createApiKey(userId, "My test key");
    expect(result).toBeTruthy();
    expect(typeof result.key).toBe("string");
    expect(result.key.startsWith("qck_")).toBe(true);
    expect(result.keyPrefix).toBe(result.key.slice(0, 12));
    expect(result.name).toBe("My test key");
    expect(typeof result.id).toBe("string");
    expect(typeof result.createdAt).toBe("string");
  });

  test("validateApiKey returns null for wrong key", async () => {
    const result = await validateApiKey("qck_wrongkey0000000000000000000000000000000000000000000000000000000");
    expect(result).toBeNull();
  });

  test("validateApiKey returns userId for valid key", async () => {
    const userId = uid();
    const { key } = await createApiKey(userId, "Valid key test");
    const validated = await validateApiKey(key);
    expect(validated).not.toBeNull();
    expect(validated?.userId).toBe(userId);
    expect(typeof validated?.keyId).toBe("string");
  });

  test("listApiKeys excludes keyHash", async () => {
    const userId = uid();
    await createApiKey(userId, "List test key");
    const items = await listApiKeys(userId);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const key = items.find((k) => k.name === "List test key");
    expect(key).toBeTruthy();
    // keyHash must NOT be present in public listing
    expect((key as any).keyHash).toBeUndefined();
    expect(typeof key!.keyPrefix).toBe("string");
  });

  test("deleteApiKey removes key", async () => {
    const userId = uid();
    const { id } = await createApiKey(userId, "Delete me");
    const beforeDelete = await listApiKeys(userId);
    expect(beforeDelete.find((k) => k.id === id)).toBeTruthy();

    const ok = await deleteApiKey(id, userId);
    expect(ok).toBe(true);

    const afterDelete = await listApiKeys(userId);
    expect(afterDelete.find((k) => k.id === id)).toBeUndefined();
  });
});
