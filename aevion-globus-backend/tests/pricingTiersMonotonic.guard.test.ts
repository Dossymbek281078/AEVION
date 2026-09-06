import { describe, test, expect } from "vitest";
import { TIERS } from "../src/data/pricing";

// Класс «платный тариф даёт меньше бесплатного» 05-06.09.2026 нашёлся в
// DevHub (tts: free 100000 > pro 30000 — покупка СНИЖАЛА лимит) и там закрыт
// сторожем. Центральная таблица TIERS питает квоты QCoreAI у ВСЕХ тарифов —
// а сторожа монотонности на ней не было: опечатка в нуле прошла бы молча.
//
// premiumTokensPerMonth у free — null ОСОЗНАННО (общий крошечный потолок уже
// ограничивает худший случай, комментарий в pricing.ts); поэтому сравниваем
// ЭФФЕКТИВНЫЕ потолки: min(premium ?? ∞, llm ?? ∞).
describe("TIERS: следующий тариф не даёт меньше предыдущего", () => {
  const ORDER = ["free", "lite", "medium", "full", "pro", "enterprise"];
  const INF = Number.POSITIVE_INFINITY;
  const rows = ORDER.map((id) => {
    const t = TIERS.find((x: { id: string }) => x.id === id);
    expect(t, `тариф ${id} пропал из TIERS — сторож смотрит не туда`).toBeTruthy();
    return t!;
  });

  test("прибор исправен: лимиты разобраны числами", () => {
    expect(rows[0].limits.llmTokensPerMonth).toBe(100_000);
    expect(rows[rows.length - 1].limits.llmTokensPerMonth).toBeNull();
  });

  test("llmTokensPerMonth не убывает от тарифа к тарифу", () => {
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1].limits.llmTokensPerMonth ?? INF;
      const cur = rows[i].limits.llmTokensPerMonth ?? INF;
      expect(cur, `${rows[i].id} даёт токенов меньше, чем ${rows[i - 1].id}`).toBeGreaterThanOrEqual(prev);
    }
  });

  test("эффективный премиум-потолок не убывает", () => {
    const eff = (t: (typeof rows)[number]) =>
      Math.min(t.limits.premiumTokensPerMonth ?? INF, t.limits.llmTokensPerMonth ?? INF);
    for (let i = 1; i < rows.length; i++) {
      expect(eff(rows[i]), `${rows[i].id}: премиум-потолок ниже, чем у ${rows[i - 1].id}`).toBeGreaterThanOrEqual(eff(rows[i - 1]));
    }
  });
});
