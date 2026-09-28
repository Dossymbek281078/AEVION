// Оплата $40 обязана СНИМАТЬ стену мультичата — проверка поведением.
//
// ЗАЧЕМ. Мы продаём мультичат отдельной подпиской, а доступ решает модульный
// гейт. Между ними стоит перевод имени: в кассу уходит слаг `multichat`, гейт
// же спрашивает по идентификатору `multichat-engine`. Класс «заплатил и не
// опознан» у нас уже случался, и он самый дорогой: деньги взяли, продукт не
// открыли.
//
// Здесь проверяется САМ гейт (requireModule), а не помощник: подменяется
// только ответ хранилища подписок.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { состояние } = vi.hoisted(() => ({ состояние: { value: "active" as string } }));

vi.mock("../src/lib/appEntitlements", () => ({
  appSubscriptionState: async () => состояние.value,
}));

const { requireModule } = await import("../src/lib/planGate");

const СОХРАНЁН = process.env.PAYWALL_MODULES;
beforeEach(() => { process.env.PAYWALL_MODULES = "multichat-engine"; состояние.value = "active"; });
afterEach(() => {
  if (СОХРАНЁН === undefined) delete process.env.PAYWALL_MODULES;
  else process.env.PAYWALL_MODULES = СОХРАНЁН;
});

async function прогнать(): Promise<{ пустили: boolean; код: number; тело: unknown }> {
  let пустили = false;
  let код = 0;
  let тело: unknown = null;
  const res = {
    status(c: number) { код = c; return this; },
    json(b: unknown) { тело = b; return this; },
  } as never;
  const req = {
    method: "POST",
    path: "/conversations/c1/dispatch",
    headers: { authorization: "Bearer x.y.z" },
    auth: { sub: "user_1", email: "buyer@example.com", plan: "free" },
    get: () => undefined,
  } as never;
  await requireModule("multichat-engine")(req, res, () => { пустили = true; });
  return { пустили, код, тело };
}

describe("стена мультичата и оплата", () => {
  it("активная подписка на мультичат ПРОПУСКАЕТ", async () => {
    const r = await прогнать();
    expect(r.пустили, "заплативший упёрся в стену — деньги взяли, продукт не открыли").toBe(true);
    expect(r.код).toBe(0);
  });

  it("контроль: без подписки стена стоит и отвечает 402", async () => {
    состояние.value = "none";
    const r = await прогнать();
    expect(r.пустили).toBe(false);
    expect(r.код).toBe(402);
  });

  it("неизвестное состояние подписки не выдаётся за оплату", async () => {
    состояние.value = "unknown";
    const r = await прогнать();
    expect(r.пустили, "«не знаю» пропустили как оплату").toBe(false);
  });
});
