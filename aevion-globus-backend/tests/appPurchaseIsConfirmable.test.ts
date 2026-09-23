import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Покупку ОТДЕЛЬНОГО приложения экран после оплаты обязан уметь подтвердить.
 *
 * Замер 22.09.2026 по коду: мы заводим намерение оплаты со своим UUID, отдаём
 * его кассе как `custom.bureauIntentId` и кладём в адрес возврата. Страница
 * после оплаты спрашивает /checkout/status по этому номеру. Для ТАРИФА ответ
 * лежит в платформенных подписках; покупка приложения туда не пишется вовсе —
 * своя ветка вебхука, своё хранилище. Значит подтверждение у купившего
 * приложение не наступало НИКОГДА: он навсегда видел «оплата принята» вместо
 * «доступ открыт», хотя доступ был выдан.
 *
 * Здесь проверяется обе стороны связи: номер ДОХОДИТ до записи и по нему
 * НАХОДИТСЯ покупка.
 */

const запросы: Array<{ sql: string; params: unknown[] }> = [];
let строки: Array<Record<string, unknown>> = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params: unknown[]) => {
      запросы.push({ sql, params });
      return { rows: строки };
    },
  }),
}));
vi.mock("../src/lib/ensureAppSubscriptionTable", () => ({
  ensureAppSubscriptionTable: async () => {},
}));

beforeEach(() => {
  запросы.length = 0;
  строки = [];
});

describe("покупка отдельного приложения подтверждается по нашему номеру", () => {
  it("номер намерения доезжает до записи", async () => {
    const { upsertAppSubscription } = await import("../src/lib/appEntitlements");
    await upsertAppSubscription("buyer@test.aev", "cyberchess", "active", "ls_1", "intent-abc-123");

    const вставка = запросы.find((q) => q.sql.includes("INSERT INTO \"AppSubscription\""));
    expect(вставка, "запись вообще не была сделана").toBeTruthy();
    expect(вставка!.sql).toContain("bureauIntentId");
    expect(вставка!.params).toContain("intent-abc-123");
  });

  it("по номеру покупка находится", async () => {
    const { findAppSubscriptionByIntent } = await import("../src/lib/appEntitlements");
    строки = [{ appSlug: "cyberchess", status: "active" }];
    const найдено = await findAppSubscriptionByIntent("intent-abc-123");
    expect(найдено).toEqual({ appSlug: "cyberchess", status: "active" });
  });

  // Контроль в другую сторону: пустой ответ базы — это «не нашли», а не
  // выдуманная покупка. Без него первый тест был бы зелёным и у реализации,
  // которая возвращает что попало.
  it("ничего не найдено — возвращается null, а не догадка", async () => {
    const { findAppSubscriptionByIntent } = await import("../src/lib/appEntitlements");
    строки = [];
    expect(await findAppSubscriptionByIntent("intent-нет-такого")).toBeNull();
  });

  // И пустой номер не должен идти в базу вовсе: иначе `WHERE = ''` совпал бы
  // с любой записью, у которой поле не заполнено.
  it("пустой номер не ищется в базе", async () => {
    const { findAppSubscriptionByIntent } = await import("../src/lib/appEntitlements");
    expect(await findAppSubscriptionByIntent("   ")).toBeNull();
    expect(запросы.filter((q) => q.sql.includes("SELECT")).length).toBe(0);
  });
});
