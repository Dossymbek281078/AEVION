import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Поведенческое доказательство починки гонки квот в веерах (06.09.2026):
// затвор премиум-квоты обязан требовать запас на ВСЮ параллельную группу.
// N одновременных проверок читают одно used до первой записи в леджер —
// значит проверка первого обязана считать за всех.

vi.mock("../src/services/qcoreai/store", () => ({
  getMonthlyTokens: vi.fn(async () => 0),
  getMonthlyPremiumTokens: vi.fn(async () => 0),
}));
vi.mock("../src/services/qcoreai/pricing", () => ({
  isPremiumModel: () => true,
}));
vi.mock("../src/lib/planGate", () => ({
  resolveUserPlan: () => ({ tier: "lite", rawTier: "lite" }),
  resolvePlanFromPayload: () => ({ tier: "lite", rawTier: "lite" }),
}));

import { premiumQuotaGateForPayload, QUOTA_CALL_ESTIMATE_TOKENS } from "../src/lib/qcoreQuota";
import { getMonthlyPremiumTokens } from "../src/services/qcoreai/store";

// lite: premiumTokensPerMonth = 200_000 (src/data/pricing.ts)
const LIMIT = 200_000;
const payload = { sub: "user-fan-test" };

beforeEach(() => {
  process.env.QCOREAI_PREMIUM_QUOTA = "1";
});
afterEach(() => {
  delete process.env.QCOREAI_PREMIUM_QUOTA;
  vi.mocked(getMonthlyPremiumTokens).mockReset();
  vi.mocked(getMonthlyPremiumTokens).mockResolvedValue(0);
});

describe("премиум-затвор с запасом на параллельную группу", () => {
  test("у самого предела: одиночный вызов проходит, группа из 8 — нет", async () => {
    // used чуть ниже предела: раньше ВСЕ восемь параллельных проверок
    // проходили здесь и предел переливался ×8.
    vi.mocked(getMonthlyPremiumTokens).mockResolvedValue(LIMIT - 100);
    const gate = premiumQuotaGateForPayload(payload);

    expect(await gate("openai", "gpt-anything"), "одиночный вызов у предела должен пройти (перелив на один ответ врождён посточному учёту)").toBeNull();

    const hit = await gate("openai", "gpt-anything", 8);
    expect(hit, "группа из 8 у предела обязана быть остановлена — иначе гонка вернулась").not.toBeNull();
    expect(hit!.usedTokens).toBe(LIMIT - 100);
  });

  test("с настоящим запасом группа проходит", async () => {
    vi.mocked(getMonthlyPremiumTokens).mockResolvedValue(LIMIT - 8 * QUOTA_CALL_ESTIMATE_TOKENS - 1);
    const gate = premiumQuotaGateForPayload(payload);
    expect(await gate("openai", "m", 8)).toBeNull();
  });

  test("за пределом отказ и одиночному — прежнее поведение цело", async () => {
    vi.mocked(getMonthlyPremiumTokens).mockResolvedValue(LIMIT);
    const gate = premiumQuotaGateForPayload(payload);
    expect(await gate("openai", "m")).not.toBeNull();
  });

  test("отказ счётчика по-прежнему открывает (fail open), даже для группы", async () => {
    vi.mocked(getMonthlyPremiumTokens).mockRejectedValue(new Error("db down"));
    const gate = premiumQuotaGateForPayload(payload);
    expect(await gate("openai", "m", 8)).toBeNull();
  });
});
