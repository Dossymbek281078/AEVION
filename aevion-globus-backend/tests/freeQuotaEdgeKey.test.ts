import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Гость сайта считается по адресу, который передал прокси сайта, — и только
 * при верном секрете AEVION_EDGE_KEY. Замер прода 13.10.2026: через
 * /api-backend бэкенд видел всех гостей под адресом Vercel, норма делилась.
 */

const actors: string[] = [];
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params?: unknown[]) => {
      if (/INSERT/i.test(sql)) {
        actors.push(String(params?.[0]));
        return { rows: [{ count: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
}));
vi.mock("../src/lib/planGate", () => ({
  resolveUserPlan: () => ({ tier: "free", rawTier: "free", chosenModules: [], email: null }),
}));

const { учестьДействие, адресОтПроксиСайта } = await import("../src/lib/freeActionQuota");

const СЕКРЕТ = "k".repeat(32);
const запрос = (h: Record<string, string>) =>
  ({ headers: h, socket: { remoteAddress: "100.64.0.9" } }) as never;

const старые = { key: process.env.AEVION_EDGE_KEY, paid: process.env.PAID_ACTIONS };
beforeEach(() => {
  actors.length = 0;
  process.env.AEVION_EDGE_KEY = СЕКРЕТ;
  process.env.PAID_ACTIONS = "healthai_check";
});
afterEach(() => {
  if (старые.key === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = старые.key;
  if (старые.paid === undefined) delete process.env.PAID_ACTIONS; else process.env.PAID_ACTIONS = старые.paid;
});

describe("гость сайта считается по адресу от прокси", () => {
  test("два гостя за одним адресом Vercel — разные счётчики", async () => {
    const vercel = "3.71.177.30";
    await учестьДействие(запрос({ "x-forwarded-for": vercel, "x-aevion-client-ip": "178.91.1.1", "x-aevion-edge-key": СЕКРЕТ }), "healthai_check");
    await учестьДействие(запрос({ "x-forwarded-for": vercel, "x-aevion-client-ip": "95.56.2.2", "x-aevion-edge-key": СЕКРЕТ }), "healthai_check");
    expect(actors).toEqual(["ip:178.91.1.1", "ip:95.56.2.2"]);
  });

  test("КОНТРОЛЬ: неверный или пустой секрет — заголовку не верим", async () => {
    await учестьДействие(запрос({ "x-forwarded-for": "3.71.177.30", "x-aevion-client-ip": "178.91.1.1", "x-aevion-edge-key": "x".repeat(32) }), "healthai_check");
    await учестьДействие(запрос({ "x-forwarded-for": "3.71.177.30", "x-aevion-client-ip": "178.91.1.1" }), "healthai_check");
    expect(actors).toEqual(["ip:3.71.177.30", "ip:3.71.177.30"]);
  });

  test("КОНТРОЛЬ: без секрета на сервере механизм спит", () => {
    delete process.env.AEVION_EDGE_KEY;
    expect(адресОтПроксиСайта({ headers: { "x-aevion-client-ip": "1.2.3.4", "x-aevion-edge-key": "" } } as never)).toBeNull();
  });

  test("мусор вместо адреса не принимается", () => {
    expect(адресОтПроксиСайта({ headers: { "x-aevion-client-ip": "<script>", "x-aevion-edge-key": СЕКРЕТ } } as never)).toBeNull();
    expect(адресОтПроксиСайта({ headers: { "x-aevion-client-ip": "2a02:6b8::1", "x-aevion-edge-key": СЕКРЕТ } } as never)).toBe("2a02:6b8::1");
  });
});

describe("счётчик адреса гостя называет причину отказа", () => {
  test("принят / ключ не совпал / ключа нет считаются раздельно", async () => {
    const { сводкаАдресаГостя } = await import("../src/lib/freeActionQuota");
    const до = сводкаАдресаГостя();
    адресОтПроксиСайта({ headers: { "x-aevion-client-ip": "1.2.3.4", "x-aevion-edge-key": СЕКРЕТ } } as never);
    адресОтПроксиСайта({ headers: { "x-aevion-client-ip": "1.2.3.4", "x-aevion-edge-key": "y".repeat(32) } } as never);
    адресОтПроксиСайта({ headers: { "x-aevion-client-ip": "1.2.3.4" } } as never);
    const после = сводкаАдресаГостя();
    expect(после.edgeKeyConfigured).toBe(true);
    expect(после.accepted - до.accepted).toBe(1);
    expect(после.keyMismatch - до.keyMismatch).toBe(1);
    expect(после.noKey - до.noKey).toBe(1);
  });
});
