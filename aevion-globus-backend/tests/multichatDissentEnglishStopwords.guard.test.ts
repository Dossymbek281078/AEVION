/**
 * Детектор прямого противоречия на английских ответах не берёт служебные слова за слово решения.
 *
 * ПОВОД (живой английский консилиум на проде 30.10.2026, сайт 4f71ad70f, бэк 04f65bbb7, /en,
 * ?c=probe-multichat): в «What to check» стояло «Agents directly contradict each other on «what»:
 * Practitioner asserts, Skeptic denies» и то же по «have». Стоп-список (dissent.ts STOP) с самого начала
 * знал русские служебные слова, а из английских — полтора десятка; «that's not what…», «do not have…»
 * отдавали детектору «what» и «have». Для продукта, который продаёт карту разногласий, шумная строка
 * в «что проверить» — это недоверие ко всей карте.
 *
 * КОНТРОЛЬ 30.10.2026: на 35e6609ff первый случай красный («what», «have» среди противоречий).
 */
import { describe, expect, test } from "vitest";
import { contradictions, negatedWords, buildDissentMap } from "../src/services/multichat/dissent";

const СЛУЖЕБНЫЕ = ["what", "have", "has", "had", "do", "does", "did", "there", "here", "which", "when", "how", "you", "your", "them", "their", "should", "would", "could", "can", "will", "must", "been", "were", "was"];

const ПРОД = [
  { agentId: "analyst", ok: true, reply: "Hire a sales rep once you have 10 paying customers and a repeatable sales process. Until then the founders sell." },
  { agentId: "skeptic", ok: true, reply: "That's not what a sales rep fixes. You do not have product-market fit yet, so there is no process to hand over." },
  { agentId: "practic", ok: true, reply: "Do not hire anyone yet. Founders should keep selling until the first paying customer, then hire." },
] as never;

describe("прямое противоречие на английском — без служебных слов", () => {
  test("ответы с прода: ни «what», ни «have» и т. п. не становятся словом противоречия; «hire» — становится", () => {
    const слова = contradictions(ПРОД).map((c) => c.word);
    for (const w of СЛУЖЕБНЫЕ) expect(слова, `служебное слово «${w}» в противоречиях: ${слова.join(", ")}`).not.toContain(w);
    expect(слова, "«sales» из «not what a sales rep fixes» — шум придаточного").not.toContain("sales");
    expect(слова).toContain("hire");
  });

  test("negatedWords проходит сквозь служебные слова к слову решения", () => {
    // «not what …» отрицает придаточное, не ближайшее существительное: ни «what», ни «sales».
    expect(negatedWords("That's not what a sales rep fixes")).toEqual(new Set());
    expect(negatedWords("You do not have product-market fit")).not.toContain("have");
    expect(negatedWords("You do not have product-market fit")).toContain("product-market");
    expect(negatedWords("No, you should not launch the tier")).toEqual(new Set(["launch"]));
  });

  test("настоящее противоречие на английском по-прежнему видно: launch / do not launch", () => {
    const m = buildDissentMap([
      { agentId: "a", ok: true, reply: "Launch the paid tier now, there is nothing to lose." },
      { agentId: "b", ok: true, reply: "Do not launch a paid tier before the first sale." },
    ] as never, "en");
    expect(m.contradictions.map((c) => c.word)).toContain("launch");
    expect(m.note).toMatch(/direct negation on «launch»/);
  });

  test("русский детектор не сдвинулся: «не стоит запускать» против «стоит запускать» → «стоит»", () => {
    const m = buildDissentMap([
      { agentId: "a", ok: true, reply: "Стоит запускать платный тариф сейчас." },
      { agentId: "b", ok: true, reply: "Не стоит запускать платный тариф до первой продажи." },
    ] as never);
    expect(m.contradictions.map((c) => c.word)).toContain("стоит");
    expect(m.note).toMatch(/прямое отрицание по «стоит»/);
  });
});
