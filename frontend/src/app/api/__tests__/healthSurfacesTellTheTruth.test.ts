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

async function ответ() {
  vi.resetModules();
  const mod = await import("../health/route");
  const res = (mod.GET as () => Response)();
  return (await res.json()) as {
    status: string;
    paymentsMode: string;
    surfaces: Array<{ name: string; ok: boolean; note?: string; mode?: string }>;
  };
}

async function surfaces() {
  return (await ответ()).surfaces;
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

/**
 * Вторая половина того же вопроса, и её легко сломать, починив первую.
 *
 * 05.10.2026 демонстрационные поверхности перестали ронять общий `status` —
 * решение верное: за /payments/* не стоит эквайрер, и «degraded» снаружи
 * читается как «у нас сломаны платежи», то есть как потеря денег. Но сделано
 * это было одним движением с `ok: true`, и честность отдельной поверхности
 * уехала вместе с ложной тревогой.
 *
 * Требования РАЗНЫЕ, и ниже заперты оба: поверхность говорит о себе правду,
 * а общий статус от демонстрации не зависит. Без этой проверки починка
 * честности снова включила бы ложную тревогу — качели вместо решения.
 */
describe("демонстрационная часть не поднимает ложную тревогу", () => {
  beforeEach(() => mockBackend.mockReturnValue("memory"));
  afterEach(() => vi.resetModules());

  it("поверхности не ok, но общий статус остаётся ok", async () => {
    const b = await ответ();
    const демо = b.surfaces.filter((s) => s.mode === "demo");
    expect(демо.length, "демонстрационные поверхности не найдены — тест смотрит не туда").toBeGreaterThan(3);
    expect(демо.every((s) => s.ok === false), "поверхность всё ещё врёт про себя").toBe(true);
    expect(b.status, "демонстрация уронила общий статус — это ложная тревога о платежах").toBe("ok");
    expect(b.paymentsMode, "режим не назван, и читателю придётся догадываться").toBe("demo");
  });

  it("контроль: НАСТОЯЩАЯ поломка статус роняет", async () => {
    // Иначе «status всегда ok» было бы заглушкой, а не решением.
    const { store } = (await import("../payments/v1/_lib")) as unknown as {
      store: { idempotency: Map<string, number> };
    };
    for (let i = 0; i < 5001; i += 1) store.idempotency.set(`k${i}`, 1);
    try {
      const b = await ответ();
      expect(b.status, "переполненный кэш идемпотентности не уронил статус").toBe("degraded");
    } finally {
      store.idempotency.clear();
    }
  });
});
