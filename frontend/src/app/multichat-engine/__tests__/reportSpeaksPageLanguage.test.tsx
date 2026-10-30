// Скачиваемый Markdown-отчёт консилиума на /en — на английском.
// Замер 30.10.2026 (прод, ?c=probe-multichat): файл aevion-consilium-*.md с английской страницы
// открывался с «# Консилиум AEVION», «## Итог: агенты разошлись», «## Чек», «вызовов 3, ответили 3».
// Без lang отчёт остаётся русским, как прежде; числа и хеш — те же в обоих языках.
import { describe, test, expect } from "vitest";
import { buildReport } from "../CouncilConsole";

const results = [
  { agentId: "analyst", role: "Аналитик — только факты и цифры, без оценок", provider: "anthropic", ok: true, reply: "About 40 visitors a month." },
  { agentId: "skeptic", role: "Скептик — ищет, где рассуждение ломается", provider: "gemini", ok: true, reply: "About 300 visitors a month." },
  { agentId: "practic", role: "Практик — что делать завтра при ограниченных ресурсах", provider: "openrouter", ok: false, error: "rate_limit_exceeded: max 30 chat requests per minute" },
];

const dissent = {
  agents: 3,
  answered: 2,
  agreement: 0.42,
  outlier: { agentId: "skeptic", distance: 0.8 },
  numericConflicts: [{ context: "visitors a month", values: [{ agentId: "analyst", raw: "40", value: 40 }, { agentId: "skeptic", raw: "300", value: 300 }], spread: 260 }],
  contradictions: [{ word: "launch", affirms: ["analyst"], denies: ["skeptic"] }],
  hedges: [],
  verdict: "split" as const,
  note: "The agents disagree on the numbers.",
  checks: [{ kind: "number" as const, text: "Check the number against the source — analyst: 40 vs skeptic: 300", agents: ["analyst", "skeptic"], weight: 3 as const }],
};

const receipt = {
  receipt: { askedAt: "2026-10-30T09:00:00.000Z", cost: { calls: 3, answered: 2, failed: 1 } },
  hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  signature: null,
  signatureNote: "Signing key is not configured on this server.",
};

describe("отчёт консилиума говорит на языке страницы", () => {
  test("на en — ни одной кириллической буквы (ответы агентов в примере английские)", () => {
    const md = buildReport("Should we launch a paid tier before the first sale?", results, dissent, receipt, true, "en");
    expect(md, md).not.toMatch(/[А-Яа-яЁё]/);
    expect(md).toContain("# AEVION Council");
    expect(md).toContain("## Verdict: agents disagree");
    expect(md).toContain("### Number mismatches");
    expect(md).toContain("Analyst: 40 vs Skeptic: 300 (spread 260)");
    expect(md).toContain("- calls 3, answered 2, did not answer 1");
    expect(md).toContain(`- sha256: \`${receipt.hash}\``);
  });

  test("без lang — русский отчёт как прежде, с теми же числами и хешем", () => {
    const md = buildReport("Стоит ли запускать платный тариф до первой продажи?", results, dissent, receipt, true);
    expect(md).toContain("# Консилиум AEVION");
    expect(md).toContain("## Итог: агенты разошлись");
    expect(md).toContain("Аналитик: 40 против Скептик: 300 (разброс 260)");
    expect(md).toContain("- вызовов 3, ответили 2, не ответили 1");
    expect(md).toContain(`- sha256: \`${receipt.hash}\``);
  });

  test("структура одна: число строк и позиции чисел совпадают на ru и en", () => {
    const ru = buildReport("q", results, dissent, receipt, false);
    const en = buildReport("q", results, dissent, receipt, false, "en");
    expect(en.split("\n").length).toBe(ru.split("\n").length);
    expect(en.match(/\d+/g)).toEqual(ru.match(/\d+/g));
  });
});
