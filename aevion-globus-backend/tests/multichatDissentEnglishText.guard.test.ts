/**
 * Карта разногласий на /en не должна говорить по-русски (замер 30.10.2026, прод 9f66e34cc, ?c=probe-multichat):
 * в английском отчёте консилиума стояло «Сверить число с источником…» и «Расхождение, включая 2 числовых».
 * Тексты строит сервер (services/multichat/dissent.ts), язык ему передаёт страница полем lang.
 * Русский остаётся каноном по умолчанию: по нему считается хеш чека.
 */
import { describe, expect, test } from "vitest";
import { buildDissentMap, dissentLang } from "../src/services/multichat/dissent";

// Ответы по-английски, чтобы кириллица в карте могла прийти только из шаблонов самого сервера.
const SPLIT = [
  { agentId: "analyst", ok: true, reply: "The project will cost 12000 dollars and take 6 weeks. Main risk: dependency on an external API." },
  { agentId: "writer", ok: true, reply: "Estimate: about 12000 dollars and 6 weeks of work. Main risk: dependency on an external API." },
  { agentId: "critic", ok: true, reply: "I think the estimate is too low: realistically 30000 dollars and at least 12 weeks. Main risk: dependency on an external API." },
] as never;
const FAILED = [
  { agentId: "analyst", ok: true, reply: "Launch the paid plan now, there is nothing to lose." },
  { agentId: "skeptic", ok: false, error: "timeout" },
] as never;

const кириллица = (s: string) => /[А-Яа-яЁё]/.test(s);
const весьТекст = (m: ReturnType<typeof buildDissentMap>) => [m.note, ...m.checks.map((c) => c.text)].join("\n");

describe("язык карты разногласий", () => {
  test("lang=en: ни в note, ни в проверках нет кириллицы (расхождение с числами)", () => {
    const m = buildDissentMap(SPLIT, "en");
    expect(m.numericConflicts.length, "прибор ничего не нашёл — проверки ниже были бы пустыми").toBeGreaterThan(0);
    expect(m.note).toMatch(/Disagreement.*numeric/);
    expect(m.checks.some((c) => /Check the number against the source/.test(c.text))).toBe(true);
    expect(кириллица(весьТекст(m)), `русский текст в en-карте:\n${весьТекст(m)}`).toBe(false);
  });

  test("lang=en: сбой агента и недостаток ответов — тоже по-английски", () => {
    const m = buildDissentMap(FAILED, "en");
    expect(m.checks.some((c) => /did not answer/.test(c.text))).toBe(true);
    expect(m.note).toMatch(/nothing to compare/);
    expect(кириллица(весьТекст(m)), весьТекст(m)).toBe(false);
  });

  test("по умолчанию и на неизвестном языке — прежний русский текст, то есть канон чека не сдвинулся", () => {
    const без = buildDissentMap(SPLIT);
    expect(без.note).toMatch(/^Расхождение/);
    expect(без.checks.some((c) => /^Сверить число с источником/.test(c.text))).toBe(true);
    expect(buildDissentMap(SPLIT, "ru")).toEqual(без);
  });

  test("числа, агенты и состав карты одинаковы на обоих языках — меняется только текст", () => {
    const ru = buildDissentMap(SPLIT, "ru");
    const en = buildDissentMap(SPLIT, "en");
    expect({ ...en, note: "", checks: [] }).toEqual({ ...ru, note: "", checks: [] });
    expect(en.checks.map((c) => [c.kind, c.weight])).toEqual(ru.checks.map((c) => [c.kind, c.weight]));
  });

  test("dissentLang: en, en-US, EN → en; всё остальное (ru, kk, мусор, не строка) → ru", () => {
    for (const v of ["en", "en-US", " EN "]) expect(dissentLang(v), v).toBe("en");
    for (const v of ["ru", "kk", "", "xx", undefined, null, 5, {}]) expect(dissentLang(v), String(v)).toBe("ru");
  });
});
