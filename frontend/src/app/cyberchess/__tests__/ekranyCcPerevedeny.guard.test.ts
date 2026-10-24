import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { TRAINING_TEXT } from "../training/trainingText";
import { CPI_TEXT } from "../cpi/cpiText";
import { ECONOMY_TEXT } from "../economy/economyText";

/**
 * Экраны CyberChess под /cyberchess/* на /en были русскими (замер 24.10.2026 браузером:
 * 221 чужая строка на 12 страницах). У каждой страницы свой словарь (ключ — строка из кода);
 * данные страницы (списки тренажёров, факторов, примеров) переводятся при выводе.
 * Сторож: каждый tt(L, "…") и каждое значение перечисленных полей данных имеет en и kk;
 * английский текст без кириллицы. Новая надпись без перевода — красный.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;
const ЭКРАНЫ: Array<{ путь: string; словарь: Record<string, Tr>; поля: string[] }> = [
  { путь: "training/page.tsx", словарь: TRAINING_TEXT, поля: ["name", "desc", "label", "drillName", "reps"] },
  { путь: "cpi/page.tsx", словарь: CPI_TEXT, поля: ["desc", "title", "note", "basis"] },
  { путь: "economy/page.tsx", словарь: ECONOMY_TEXT, поля: ["title", "desc", "style", "bio", "label"] },
];
const ИСКЛЮЧЕНИЯ = new Set(["AEVION", "Chess training"]);

describe.each(ЭКРАНЫ)("экран $путь", ({ путь, словарь, поля }) => {
  const код = readFileSync(join(__dirname, "..", путь), "utf8");

  it("каждый вызов и каждое значение данных — с en и kk", () => {
    const вызовы = [...код.matchAll(/tt\(L, "([^"]+)"\)/g)].map((m) => m[1]);
    const данные = [...код.matchAll(new RegExp(`\\b(?:${поля.join("|")}): "([^"]+)"`, "g"))]
      .map((m) => m[1]).filter((v) => !ИСКЛЮЧЕНИЯ.has(v));
    // знаменатель: прибор, не нашедший вызовов, был бы «чист» вслепую
    expect(вызовы.length, "вызовов tt").toBeGreaterThan(15);
    expect(данные.length, "значений данных").toBeGreaterThan(5);
    const все = [...new Set([...вызовы, ...данные])];
    for (const loc of ["en", "kk"] as const) {
      expect(все.filter((k) => !словарь[k]?.[loc]), `без ${loc}`).toEqual([]);
    }
  });

  it("английский текст без кириллицы", () => {
    expect(Object.entries(словарь).filter(([, v]) => /[А-Яа-яЁё]/.test(v.en ?? "")).map(([k]) => k)).toEqual([]);
  });
});
