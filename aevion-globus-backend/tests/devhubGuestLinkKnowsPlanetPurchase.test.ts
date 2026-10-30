import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * ГОСТЬ, КУПИВШИЙ «ПЛАНЕТУ», ПОЛУЧАЕТ ССЫЛКУ ПОДКЛЮЧЕНИЯ ПОКУПКИ.
 *
 * С 19.10.2026 DevHub продаётся ТОЛЬКО планом «AEVION Планета». Вебхук этого
 * плана в DevHubEmailTier не пишет — туда пишет лишь прежний товар Studio Pro.
 * А запрос ссылки (/devhub/link) искал покупку ТОЛЬКО там: заплативший гость
 * получал нейтральное «если есть покупка, мы отправили письмо», письма не было,
 * Pro не было (замер по коду 30.10.2026). Здесь функция вызывается.
 */

const { mockQuery, mockSend, plan } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockSend: vi.fn(),
  plan: { entitled: false },
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/build/email", () => ({
  canSendEmail: () => true,
  send: mockSend,
}));
vi.mock("../src/lib/planGate", () => ({
  resolvePlanFromPayload: (p: { email?: string }) => ({ tier: plan.entitled ? "full" : "free", email: p?.email ?? null }),
  isModuleEntitled: (pl: { tier: string }, moduleId: string) => moduleId === "devhub" && pl.tier === "full",
}));

import { requestGuestLink } from "../src/lib/devhubGuestLink";

function zapisejTokena() {
  return mockQuery.mock.calls.filter((c) => typeof c[0] === "string" && c[0].includes("INSERT") && c[0].includes("DevHubGuestLinkToken")).length;
}

describe("запрос ссылки знает покупку «Планеты»", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSend.mockReset();
    mockSend.mockResolvedValue({ ok: true });
    // В DevHubEmailTier строки нет — так у любого покупателя «Планеты».
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("подписка «Планеты» по этой почте → письмо уходит", async () => {
    plan.entitled = true;
    const r = await requestGuestLink("gost-1", "buyer@example.com", "https://aevion.app");
    expect(r).toBe("sent");
    expect(zapisejTokena()).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test("контроль: ни старого тарифа, ни «Планеты» → no_purchase, письма нет", async () => {
    plan.entitled = false;
    const r = await requestGuestLink("gost-1", "nobody@example.com", "https://aevion.app");
    expect(r).toBe("no_purchase");
    expect(zapisejTokena()).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("прежний товар Studio Pro по-прежнему узнаётся", async () => {
    plan.entitled = false;
    mockQuery.mockImplementation((sql: string) =>
      Promise.resolve({ rows: sql.includes("DevHubEmailTier") ? [{ tier: "pro" }] : [] }),
    );
    const r = await requestGuestLink("gost-1", "old@example.com", "https://aevion.app");
    expect(r).toBe("sent");
  });
});
