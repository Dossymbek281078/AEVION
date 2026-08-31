import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { themeRu } from "../daily/themes";

/**
 * Тема задачи — то, что подсказывает человеку, ЧТО искать в позиции.
 * Показывалась она по-английски: «Тема: Pawn grab» на русской странице.
 *
 * Механизм перевода в модуле был и работал; не хватало ОХВАТА. Замер по
 * банку бэкенда 31.08.2026: 23 темы, из них 8 без перевода — то есть у трети
 * задач дня тема оставалась английской.
 *
 * Сторож считает охват ОТ БАНКА, а не от списка внутри теста: банк вырастет —
 * тест покраснеет сам. Список внутри теста устарел бы молча.
 */

const BANK = join(process.cwd(), "..", "aevion-globus-backend", "src");
const KAV = String.fromCharCode(39), DK = String.fromCharCode(34);

function fajly(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") fajly(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function temyBanka(): string[] {
  const t = new Set<string>();
  for (const f of fajly(BANK)) {
    const s = readFileSync(f, "utf8");
    let i = 0;
    while ((i = s.indexOf("theme: ", i)) >= 0) {
      const p = i + 7, q = s[p];
      if (q === KAV || q === DK) { const e = s.indexOf(q, p + 1); if (e > 0) t.add(s.slice(p + 1, e)); }
      i = p + 1;
    }
  }
  return [...t].sort();
}

describe("каждая тема из банка задач переведена", () => {
  const temy = temyBanka();

  it("банк вообще прочитан", () => {
    // Контроль прибора: пустой список дал бы зелёный «всё переведено» на
    // любом коде — самый успокаивающий и самый бесполезный ответ.
    expect(temy.length).toBeGreaterThan(15);
    expect(temy).toContain("Fork");
  });

  it("непереведённых нет", () => {
    const net = temy.filter((t) => themeRu(t) === t);
    expect(net).toEqual([]);
  });

  it("незнакомую тему показываем как есть, а не прочерком", () => {
    // Осознанное решение автора словаря: незнакомая метка честнее пустоты.
    expect(themeRu("Nesushchestvuyushchaya tema")).toBe("Nesushchestvuyushchaya tema");
  });

  it("перевод — русский, а не копия английского", () => {
    // Иначе «переводом» можно было бы объявить ту же строку и получить зелёный.
    const KIR = /[А-Яа-яЁё]/;
    for (const t of temy) expect(KIR.test(themeRu(t))).toBe(true);
  });
});
