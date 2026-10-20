/**
 * HealthAI: русские строки словаря страницы — по-русски.
 *
 * 🔴 Замер прода 20.10.2026: «Опишите что беспокоит — получите advice», подсказка
 * «напр. headache, fatigue, тошнота», «результатов screener-ов. Rule-based — безопасные
 * defaults», «Войдите через /auth». Казахская локаль страницы тоже читает ru-строки
 * (kk → ru в _client.tsx), то есть смесь видели оба языка.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const src = readFileSync(join(__dirname, "..", "_client.tsx"), "utf8");
// Имена собственные и общепринятые сокращения — не перевод, а название.
const МОЖНО = new Set(["AEVION", "HealthAI", "Apple", "Health", "Google", "OAuth", "JSON", "PDF", "ANTHROPIC_API_KEY", "LLM", "BMI", "Pro", "PHQ", "GAD"]);

describe("HealthAI: ru-строки без английских слов", () => {
  const ru = [...src.matchAll(/\bru: "([^"]*)"/g)].map((m) => m[1]);
  it("строки найдены (сторож не ослеп)", () => {
    expect(ru.length).toBeGreaterThan(200);
  });
  it("ни одного английского слова длиннее трёх букв и ни одного адреса вида /auth", () => {
    const плохие = ru.flatMap((s) =>
      [...s.matchAll(/(?<![\p{L}/])[A-Za-z][A-Za-z_-]{3,}/gu)].map((m) => m[0]).filter((w) => !МОЖНО.has(w.replace(/-.*$/, ""))).map((w) => `${w} ← «${s}»`),
    );
    const пути = ru.filter((s) => /(^|\s)\/[a-z]/.test(s));
    expect([...плохие, ...пути]).toEqual([]);
  });
});
