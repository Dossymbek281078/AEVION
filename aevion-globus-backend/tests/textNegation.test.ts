import { describe, test, expect } from "vitest";
import { mentionsUnnegated, mentionsOnlyNegated } from "../src/lib/textNegation";

// mentionsUnnegated now gates two scoring paths in QVenture — the patent /
// revenue signals in signals.ts and the traction cues in engine.ts — after both
// were found crediting denials ("We have no patents" set mentionsPatent = true,
// "No revenue, no users" scored +18 for revenue cited). A regression here would
// silently skew every future score, so the trap cases matter more than the
// happy path: partial negation, negation after the keyword, and sentence
// boundaries are where a lookbehind of this kind actually breaks.

// Mirrors the production alternation in signals.ts, plural included — the plural
// was missing there, so "we hold three patents" matched nothing and a plan with
// real IP got no moat credit at all.
const PATENT = /\b(patents?|patented|proprietary technolog(?:y|ies))\b/i;
const REVENUE = /\b(revenue|paying customers|arr|mrr)\b/i;

describe("mentionsUnnegated — plain claims", () => {
  test.each([
    ["our patent was granted in 2025", PATENT],
    ["we hold three patents in the core process", PATENT],
    ["proprietary technology developed in-house", PATENT],
    ["revenue is growing steadily", REVENUE],
    ["1,200 paying customers across the EU", REVENUE],
  ])("credits %j", (text, re) => {
    expect(mentionsUnnegated(text, re)).toBe(true);
  });
});

describe("mentionsUnnegated — denials must not count", () => {
  test.each([
    ["we have no patents and no proprietary technology", PATENT],
    ["without patents, we compete on execution", PATENT],
    ["the company has zero revenue", REVENUE],
    ["pre-launch with no revenue at all", REVENUE],
    ["not yet generating revenue", REVENUE],
    ["we don't have paying customers", REVENUE],
    ["no revenue, no users, no traction", REVENUE],
  ])("rejects %j", (text, re) => {
    expect(mentionsUnnegated(text, re)).toBe(false);
  });
});

describe("mentionsUnnegated — trap cases", () => {
  // The reason every match is checked rather than only the first: a plan that
  // opens with a caveat and then discloses the figure is making a real claim.
  test("a later unnegated mention wins over an earlier denial", () => {
    expect(mentionsUnnegated("no revenue in year one, but revenue reached $40k MRR", REVENUE)).toBe(true);
  });

  test("a denial in the previous sentence does not suppress a claim in this one", () => {
    expect(mentionsUnnegated("We have no patents. Our revenue is $2M.", REVENUE)).toBe(true);
  });

  // Documented blind spot, asserted so it stays visible rather than assumed
  // absent: the check looks backwards only, so a denial trailing the keyword
  // still credits. Catching it needs parsing, not a lookbehind.
  test("negation placed after the keyword is NOT caught (known limit)", () => {
    expect(mentionsUnnegated("patents: none", PATENT)).toBe(true);
  });

  test("semicolon bounds the lookbehind like a full stop", () => {
    expect(mentionsUnnegated("no patents; revenue is $5M", REVENUE)).toBe(true);
  });

  test("distant negation does not reach across the lookbehind window", () => {
    const far = "no patents were ever filed by the founding team in the first three years of operating; revenue is strong";
    expect(mentionsUnnegated(far, REVENUE)).toBe(true);
  });

  test("case is ignored", () => {
    expect(mentionsUnnegated("NO PATENTS HERE", PATENT)).toBe(false);
    expect(mentionsUnnegated("Our PATENT was granted", PATENT)).toBe(true);
  });

  test("empty and absent input are false, not throws", () => {
    expect(mentionsUnnegated("", PATENT)).toBe(false);
    expect(mentionsUnnegated("a plan with no mention of the term", PATENT)).toBe(false);
  });

  test("a global-flagged pattern is not consumed between calls", () => {
    const g = /\brevenue\b/gi;
    expect(mentionsUnnegated("revenue is growing", g)).toBe(true);
    expect(mentionsUnnegated("revenue is growing", g)).toBe(true);
  });
});

describe("mentionsOnlyNegated", () => {
  test("true when every occurrence is denied", () => {
    expect(mentionsOnlyNegated("no revenue and no paying customers", REVENUE)).toBe(true);
  });

  test("false when at least one occurrence stands", () => {
    expect(mentionsOnlyNegated("no revenue yet, but revenue starts in Q3", REVENUE)).toBe(false);
  });

  test("false when the term never appears — absence is not denial", () => {
    expect(mentionsOnlyNegated("a hardware company", REVENUE)).toBe(false);
  });
});

// ── Русский: платформа русскоязычная, а проверка была слепа на её входе ──────
//
// До 27.07 список отрицателей и союзов был только английским, а границы слов
// задавались через  — который в JS определён по ASCII и на кириллице не
// срабатывает вовсе. То есть «выручки нет» и «без патентов» читались как
// утверждения — ровно тот дефект, ради которого модуль и написан.
describe("отрицание по-русски", () => {
  const HOLD = /удержани\w*/iu;
  const GROWTH = /рост\w*/iu;

  test("утверждение остаётся утверждением", () => {
    expect(mentionsUnnegated("Удержание достаточное, можно включать оплату.", HOLD)).toBe(true);
  });

  test("«не» перед словом снимает утверждение", () => {
    expect(mentionsUnnegated("Продукт не обеспечивает удержание, запускать рано.", HOLD)).toBe(false);
  });

  test("«без» снимает утверждение", () => {
    expect(mentionsUnnegated("Рост без удержания долго не живёт.", HOLD)).toBe(false);
  });

  // Английский так почти не строит, поэтому lookbehind этого класса не видел:
  // отрицатель стоит ПОСЛЕ слова.
  test("постпозитивное «нет» снимает утверждение", () => {
    expect(mentionsUnnegated("Удержания нет, оплата ускорит отток.", HOLD)).toBe(false);
  });

  test("русский контраст возвращает утверждение", () => {
    expect(mentionsUnnegated("Удержания не было, но удержание выросло до 40%.", HOLD)).toBe(true);
  });

  // Обратная сторона: отрицание, относящееся к ДРУГОМУ члену, не должно
  // отнимать соседнее слово. Без этого правило «искать нет после слова»
  // обнуляло бы половину утверждений.
  test("чужое отрицание за запятой не отнимает удержание", () => {
    expect(mentionsUnnegated("Удержание есть, а роста нет.", HOLD)).toBe(true);
  });

  test("и при этом рост в той же фразе отрицается", () => {
    expect(mentionsUnnegated("Удержание есть, а роста нет.", GROWTH)).toBe(false);
  });

  test("отрицание в конце длинной фразы не дотягивается до начала", () => {
    expect(mentionsUnnegated("Удержание стабильное уже третий квартал, выручки пока нет.", HOLD)).toBe(true);
  });
});
