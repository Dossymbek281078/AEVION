import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Пять поверхностей в /api/health рапортовали `ok: true` жёсткой КОНСТАНТОЙ,
 * а шестая рядом проверяла по-настоящему. При этом в том же ответе стоит
 * честное `persistence: "memory"` — ручка знала, что записи живут в памяти
 * процесса и теряются при перезапуске, и всё равно говорила «ok».
 *
 * Кто прочитает `ok`, до `persistence` не дойдёт: два наших ответа об одном
 * спорили, и верили короткому.
 */

const mockBackend = vi.fn(() => "memory" as "kv" | "memory");

vi.mock("../payments/v1/_persist", () => ({
  kvBackend: () => mockBackend(),
  kvDegradedSince: () => null,
}));

vi.mock("../payments/v1/_lib", () => ({
  store: {
    links: new Map([["a", 1]]),
    checkouts: new Map(),
    subscriptions: new Map(),
    webhooks: new Map(),
    settlements: new Map([["s", 1]]),
    idempotency: new Map(),
  },
}));

async function surfaces() {
  vi.resetModules();
  const mod = await import("../health/route");
  const res = (mod.GET as () => Response)();
  const body = await res.json();
  return body.surfaces as Array<{ name: string; ok: boolean; note?: string }>;
}

describe("состояние платёжной части не говорит «ok» о том, что теряется", () => {
  beforeEach(() => mockBackend.mockReturnValue("memory"));
  afterEach(() => vi.resetModules());

  it("хранилище в памяти — поверхности НЕ ok и причина названа", async () => {
    const list = await surfaces();
    const persisted = list.filter((s) => s.name !== "idempotency_cache");
    expect(persisted.length, "поверхности не найдены — тест смотрит не туда").toBeGreaterThan(3);
    for (const s of persisted) {
      expect(s.ok, `${s.name} рапортует ok, хотя записи теряются при перезапуске`).toBe(false);
      expect(String(s.note || ""), `${s.name}: причина не названа`).toContain("теряются");
    }
  });

  it("контроль: настоящее хранилище — ok, и лишней тревоги нет", async () => {
    mockBackend.mockReturnValue("kv");
    const list = await surfaces();
    const persisted = list.filter((s) => s.name !== "idempotency_cache");
    for (const s of persisted) {
      expect(s.ok, `${s.name} выключен при исправном хранилище — это глушилка`).toBe(true);
      expect(s.note, `${s.name}: лишняя причина при исправном хранилище`).toBeUndefined();
    }
  });
});
