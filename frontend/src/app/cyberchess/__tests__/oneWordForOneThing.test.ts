import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Одно понятие — одно слово. Модуль переводил blunder как «Зевок»
 * (AiCoach) и одновременно писал «блундер» в 29 местах: калька, которую
 * новичок не понимает, рядом с русским словом, которое он понимает.
 * Ни один тест этого не видел — оба текста отрисовывались исправно.
 *
 * Казахская секция i18n.ts намеренно вне охвата: тамошний термин — не
 * наша языковая компетенция, и менять его вслепую хуже, чем оставить.
 */
const KORNI = join(__dirname, "..");

function fajly(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "__tests__") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fajly(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

const KK_NACHALO = 390; // строка, с которой в i18n.ts идёт казахский

describe("одно понятие названо одним словом", () => {
  const spisok = fajly(KORNI);

  it("обход действительно нашёл файлы модуля", () => {
    expect(spisok.length).toBeGreaterThan(50);
    expect(spisok.some((p) => p.endsWith("page.tsx"))).toBe(true);
  });

  it("кальки «бейдж» нет — модуль говорит «награды» и «трофеи»", () => {
    // то же, что с «блундером»: рядом уже есть русское слово, и два слова
    // для одного понятия заставляют человека гадать, разные ли это вещи
    const nahodki: string[] = [];
    for (const p of spisok) {
      bezKommentariev(readFileSync(p, "utf8"))
        .split(String.fromCharCode(10))
        .forEach((l, i) => {
          if (/[бБ]ейдж/.test(l)) nahodki.push(`${p}:${i + 1}`);
        });
    }
    expect(nahodki).toEqual([]);
  });

  it("кальки «блундер» нет в русских текстах — есть «зевок»", () => {
    const nahodki: string[] = [];
    for (const p of spisok) {
      const stroki = readFileSync(p, "utf8").split("\n");
      stroki.forEach((l, i) => {
        if (p.endsWith("i18n.ts") && i + 1 >= KK_NACHALO) return;
        if (/[бБ]лундер/.test(l)) nahodki.push(`${p}:${i + 1}`);
      });
    }
    expect(nahodki).toEqual([]);
  });

  it("русское слово при этом действительно используется", () => {
    const est = spisok.some((p) => /[Зз]ев(ок|ка|ков|ки)/.test(readFileSync(p, "utf8")));
    expect(est).toBe(true);
  });
});
