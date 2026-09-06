import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Сторож четырёх мест, где 06.09.2026 нашлась гонка квот в параллельных
// веерах (свип: 3 настоящих из 14 кандидатов). Форма закреплена здесь,
// СЛЕДСТВИЕ — в quotaFanReserve.test.ts (поведенческий, с мутацией).

const SRC = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("веера не обходят квоты поштучными проверками", () => {
  test("multichat: предполётная проверка квоты стоит ДО веера", () => {
    const s = SRC("routes/multichat.ts");
    const dispatch = s.indexOf('"/conversations/:id/dispatch"');
    const fan = s.indexOf("Promise.all(calls)");
    const gate = s.indexOf("monthlyQuotaHeadroom(req)");
    expect(gate, "проверка квоты на веер исчезла из multichat").toBeGreaterThan(dispatch);
    expect(gate, "проверка квоты стоит ПОСЛЕ веера — гонка вернулась").toBeLessThan(fan);
    expect(s.includes("QUOTA_CALL_ESTIMATE_TOKENS"), "оценка вызова не используется — запас на веер не считается").toBe(true);
  });

  test("оркестратор: параллельные группы передают затвору свой размер", () => {
    const s = SRC("services/qcoreai/orchestrator.ts");
    expect(s.includes("input.premiumGate(agent.provider, agent.model, projectedCalls)"),
      "затвор снова зовётся без размера группы").toBe(true);
    expect((s.match(/members\.length\n?\s*\)/g) || []).length,
      "слои консилиума не передают размер группы").toBeGreaterThanOrEqual(2);
    expect(s.includes('"a", 2)') && s.includes('"pro", 2)'),
      "parallel/debate не передают размер группы").toBe(true);
    expect(s.includes("totalCost + lastLayerCost <= budget"),
      "бюджет снова проверяется только МЕЖДУ слоями — слой выносит его разом").toBe(true);
  });

  test("batch: каждый элемент пула проверяет живую квоту; run-now — квоту на входе", () => {
    const s = SRC("routes/qcoreai.ts");
    expect((s.match(/quotaSpent: async \(\) =>/g) || []).length,
      "quotaSpent пропал из пулов batch/run-now").toBe(2);
    const runNow = s.indexOf('"/schedules/:id/run-now"');
    const gate = s.indexOf("enforceFreeTokenQuota(req, res)", runNow);
    const fanStart = s.indexOf("runBatchItem", runNow);
    expect(gate, "у run-now снова нет месячной квоты на входе").toBeGreaterThan(runNow);
    expect(gate).toBeLessThan(fanStart);
  });
});
