import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Бесплатная норма действий: спит по умолчанию, платящего не трогает, при
 * сбое базы НЕ запирает человека.
 *
 * Замер 28.09.2026: из девяти продаваемых приложений закрыто одно, остальные
 * восемь работают гостю бесплатно. Значит платить не за что — и это, а не
 * нехватка товаров в кассе, объясняет ноль покупок лестницы.
 */

let счёт = 0;
let ронятьЗапрос = false;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (ронятьЗапрос) throw new Error("база недоступна");
      if (String(sql).includes("CREATE TABLE")) return { rows: [] };
      счёт += 1;
      return { rows: [{ count: счёт }] };
    },
  }),
}));

let планТариф = "free";
let планПочта: string | null = "buyer@test.aev";
vi.mock("../src/lib/planGate", () => ({
  resolveUserPlan: () => ({ tier: планТариф, rawTier: планТариф, chosenModules: [], email: планПочта }),
}));

const запрос = () => ({ headers: {}, socket: { remoteAddress: "10.0.0.1" } }) as never;

beforeEach(async () => {
  счёт = 0; ронятьЗапрос = false; планТариф = "free"; планПочта = "buyer@test.aev";
  process.env.PAID_ACTIONS = "qsign_sign";
  process.env.FREE_QSIGN_SIGN_PER_MONTH = "2";
  const m = await import("../src/lib/freeActionQuota");
  m.сброситьГотовностьТаблицы();
});
afterEach(() => { delete process.env.PAID_ACTIONS; delete process.env.FREE_QSIGN_SIGN_PER_MONTH; });

describe("бесплатная норма действий", () => {
  it("в пределах нормы пропускает, сверх — блокирует", async () => {
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    expect((await учестьДействие(запрос(), "qsign_sign")).заблокировано).toBe(false); // 1
    expect((await учестьДействие(запрос(), "qsign_sign")).заблокировано).toBe(false); // 2
    const третий = await учестьДействие(запрос(), "qsign_sign");                       // 3 — сверх
    expect(третий.заблокировано).toBe(true);
    expect(третий.норма).toBe(2);
  });

  it("СПИТ, пока действие не названо в PAID_ACTIONS", async () => {
    delete process.env.PAID_ACTIONS;
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    for (let i = 0; i < 5; i += 1) {
      expect((await учестьДействие(запрос(), "qsign_sign")).заблокировано).toBe(false);
    }
    // Контроль: спящий механизм не должен и СЧИТАТЬ — иначе он трогает базу
    // на каждом запросе просто так.
    expect(счёт).toBe(0);
  });

  it("платящего не трогает вовсе", async () => {
    планТариф = "full";
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    for (let i = 0; i < 5; i += 1) {
      const r = await учестьДействие(запрос(), "qsign_sign");
      expect(r.заблокировано).toBe(false);
      expect(r.причина).toBe("платящий");
    }
    expect(счёт, "платящий не должен стоить нам запроса к счётчику").toBe(0);
  });

  it("сбой базы НЕ запирает человека, но называет себя", async () => {
    ронятьЗапрос = true;
    const { учестьДействие } = await import("../src/lib/freeActionQuota");
    const r = await учестьДействие(запрос(), "qsign_sign");
    expect(r.заблокировано).toBe(false);
    expect(r.причина, "молчаливый пропуск недопустим: причина обязана называться").toBe("считать не удалось");
  });
});
