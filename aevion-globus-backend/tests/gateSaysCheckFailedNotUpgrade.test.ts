import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Сбой проверки доступа подаётся как СБОЙ, а не как приговор «купите тариф».
 *
 * 🔴 НАЙДЕНО 02.09.2026. Гейт спрашивал базу об отдельной подписке на модуль
 * и получал `boolean`. На упавшем чтении приходило `false` — направление
 * верное (дверь обязана закрываться на сбое), но вызывающий не мог отличить
 * «проверено, не куплено» от «проверить не удалось» и отвечал ОДИНАКОВО:
 *
 *     402 upgrade_required — «Модуль доступен на тарифах: …»
 *
 * Два последствия, и второе тише первого:
 *
 *   1. Человек, который УЖЕ заплатил, при обычном дрожании базы получает
 *      предложение купить снова. Он не знает, что это сбой, — для него это
 *      наш ответ про его права.
 *   2. Каждый такой отказ шёл в счётчик спроса: в коде прямо написано
 *      «every 402 is someone who WANTED a paid module». То есть сбой
 *      инфраструктуры попадал в цифру, по которой решают, что продавать.
 *
 * Дверь по-прежнему закрыта — меняется только честность ответа и то, что
 * сбой не засчитывается в спрос.
 */

const denies: Array<[string, string]> = [];
let состояние: "active" | "none" | "unknown" = "unknown";

vi.mock("../src/lib/appEntitlements", () => ({
  appSubscriptionState: async () => состояние,
}));

vi.mock("../src/lib/paywallDenyLog", () => ({
  recordDeny: (module: string, plan: string) => { denies.push([module, plan]); },
  funnelSummary: async () => ({}),
}));

// eslint-disable-next-line import/first
import { requireModule } from "../src/lib/planGate";

async function прогнать(module: string) {
  let nexted = false;
  let status = 0;
  let body: any = null;
  const res: any = {
    status(c: number) { status = c; return this; },
    json(b: any) { body = b; return this; },
  };
  await requireModule(module)(
    { method: "GET", path: "/chat", headers: {} } as any,
    res,
    () => { nexted = true; },
  );
  return { nexted, status, body };
}

describe("гейт различает «не куплено» и «не смог проверить»", () => {
  const saved = {
    mods: process.env.PAYWALL_MODULES,
    off: process.env.PAYWALL_DISABLED,
  };
  beforeEach(() => {
    denies.length = 0;
    // Модуль намеренно НЕ qcoreai: он в списке «никогда не закрывать»,
    // и тест на нём проверял бы открытую дверь при любом коде.
    process.env.PAYWALL_MODULES = "healthai";
    // Стена спит не только без списка модулей: отдельный рубильник
    // выключает её целиком, и без него тест проверял бы открытую дверь.
    delete process.env.PAYWALL_DISABLED;
  });
  afterEach(() => {
    if (saved.mods === undefined) delete process.env.PAYWALL_MODULES;
    else process.env.PAYWALL_MODULES = saved.mods;
    if (saved.off === undefined) delete process.env.PAYWALL_DISABLED;
    else process.env.PAYWALL_DISABLED = saved.off;
  });

  it("контроль: при «не куплено» ответ прежний — 402 и предложение тарифа", async () => {
    // Без этого контроля проверка ниже могла бы проходить оттого, что гейт
    // сломался целиком и отвечает 503 на всё подряд.
    состояние = "none";
    const r = await прогнать("healthai");
    expect(r.nexted, "гость прошёл сквозь платную стену").toBe(false);
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("upgrade_required");
    expect(denies.length, "настоящий отказ обязан попасть в спрос").toBe(1);
  });

  it("при «не смог проверить» — 503 и честный текст, а не «купите тариф»", async () => {
    состояние = "unknown";
    const r = await прогнать("healthai");

    expect(r.nexted, "дверь открылась на сбое — так нельзя").toBe(false);
    expect(r.status, "сбой нашей базы подан как ответ про права человека").toBe(503);
    expect(r.body.error).toBe("entitlement_check_failed");
    expect(
      JSON.stringify(r.body),
      "в ответе про СБОЙ человеку предлагают купить тариф",
    ).not.toContain("upgrade_required");
  });

  it("сбой НЕ засчитывается в спрос", async () => {
    состояние = "unknown";
    await прогнать("healthai");
    expect(
      denies,
      "дрожание базы уехало в счётчик спроса — по этой цифре решают, что продавать",
    ).toEqual([]);
  });
});
