import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Покупка модуля (бюро) пишет AppSubscription, а resolveUserPlan её не читает —
 * купивший оставался на бесплатной норме. Норма обязана смотреть и на модуль.
 */
let счёт = 4;
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (String(sql).includes("CREATE TABLE")) return { rows: [] };
      return { rows: [{ count: счёт }] };
    },
  }),
}));

let почта: string | null = "buyer@test.aev";
vi.mock("../src/lib/planGate", () => ({
  resolveUserPlan: () => ({ tier: "free", rawTier: "free", chosenModules: [], email: почта }),
}));

let состояние: "active" | "none" | "throw" = "none";
const спрошено: string[] = [];
vi.mock("../src/lib/appEntitlements", () => ({
  appSubscriptionState: async (_email: string, moduleId: string) => {
    спрошено.push(moduleId);
    if (состояние === "throw") throw new Error("база недоступна");
    return moduleId === "aevion-ip-bureau" ? состояние : "none";
  },
}));

const запрос = () => ({ headers: {}, socket: { remoteAddress: "10.0.0.1" } }) as never;

beforeEach(async () => {
  счёт = 4; почта = "buyer@test.aev"; состояние = "none"; спрошено.length = 0;
  process.env.PAID_ACTIONS = "qright_register,bureau_verify";
  const m = await import("../src/lib/freeActionQuota");
  m.сброситьГотовностьТаблицы();
});
afterEach(() => { delete process.env.PAID_ACTIONS; });

describe("норма учитывает купленный модуль", () => {
  it("купивший бюро на 4-м действии не заблокирован: «платящий»", async () => {
    состояние = "active";
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    for (const действие of ["qright_register", "bureau_verify"]) {
      const r = await учестьДействие(запрос(), действие);
      expect(r.заблокировано).toBe(false);
      expect(r.причина).toBe("платящий");
    }
  });

  it("без подписки при использовано=4 заблокирован: «норма исчерпана»", async () => {
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    const r = await учестьДействие(запрос(), "qright_register");
    expect(r.заблокировано).toBe(true);
    expect(r.причина).toBe("норма исчерпана");
  });

  it("гость без почты не ходит в подписки и остаётся на норме", async () => {
    почта = null;
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    const r = await учестьДействие(запрос(), "bureau_verify");
    expect(r.заблокировано).toBe(true);
    expect(спрошено).toEqual([]);
  });

  it("ошибка чтения подписки = как без подписки (не падает)", async () => {
    состояние = "throw";
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    const r = await учестьДействие(запрос(), "qright_register");
    expect(r.заблокировано).toBe(true);
    expect(r.причина).toBe("норма исчерпана");
  });
});
