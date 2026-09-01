import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Обещания про СОПЕРНИКА расходились с кодом: тариф обещал «до 2800 ELO»,
 * а такого уровня нет вообще (есть 2400 и 3500), магазин звал 2400 «самым
 * сильным». Оба текста ЗАНИЖАЛИ то, что покупатель уже получает: без
 * покупки уровни до 2000, с подпиской до 3500 — полная сила движка.
 *
 * Числа про уровень ИГРОКА («до 1500 ELO хватает считать на 2 хода» в
 * уроках) сюда не относятся — это не наши соперники, и правило их не
 * трогает. Поэтому сверяются только строки, где речь об оппоненте.
 */
const MODUL = join(__dirname, "..");
const stranica = readFileSync(join(MODUL, "page.tsx"), "utf8");
const tarify = readFileSync(join(MODUL, "..", "bank", "page.tsx"), "utf8");

// список уровней — источник правды
const urovni = [...stranica.matchAll(/\{name:"[^"]+",ru:"[^"]+",elo:(\d+)/g)].map((m) =>
  Number(m[1]),
);

const PRO_SOPERNIKA = /(Соперник|Master AI|Игра против|оппонент)[^\n"]{0,60}?(\d{3,4})\s*\+?\s*ELO/g;

describe("обещания про соперника сверены со списком уровней", () => {
  it("список уровней прочитан — иначе сверять не с чем", () => {
    expect(urovni.length).toBeGreaterThanOrEqual(7);
    expect(urovni).toContain(2000);
    expect(urovni).toContain(3500);
  });

  it("диапазон уровней без слова ELO — тоже обещание", () => {
    // «От 800 до 2400» в подсказке новичка сторож не ловил: он требовал
    // слова ELO. А обещание от этого обещанием быть не перестаёт — именно
    // так неверный потолок пережил правку тарифа и магазина.
    const chuzhie: string[] = [];
    for (const [imya, tekst] of [
      ["модуль", stranica],
      ["тарифы", tarify],
    ] as const) {
      for (const m of tekst.matchAll(/[Оо]т (\d{3,4}) до (\d{3,4})/g)) {
        // обещанный ДИАПАЗОН должен доходить до краёв: «от 800 до 2400»
        // состоит из настоящих уровней, но обрезает и снизу (400), и
        // сверху (3500) — то есть занижает продукт, оставаясь «правдой»
        const [niz, verh] = [Number(m[1]), Number(m[2])];
        const min = Math.min(...urovni);
        const max = Math.max(...urovni);
        if (niz !== min || verh !== max) {
          chuzhie.push(`${imya}: «${m[0]}» при уровнях ${min}..${max}`);
        }
      }
    }
    expect(chuzhie).toEqual([]);
  });

  it("каждое обещанное ELO существует как уровень", () => {
    const chuzhie: string[] = [];
    for (const [imya, tekst] of [
      ["модуль", stranica],
      ["тарифы", tarify],
    ] as const) {
      for (const m of tekst.matchAll(PRO_SOPERNIKA)) {
        const ch = Number(m[2]);
        if (!urovni.includes(ch)) chuzhie.push(`${imya}: «${m[0].slice(0, 50)}»`);
      }
    }
    expect(chuzhie).toEqual([]);
  });

  it("обход видит обе поверхности — иначе правило охраняет половину", () => {
    expect(stranica).toMatch(/Соперник[^\n"]{0,60}ELO/);
    expect(tarify).toMatch(/Master AI[^\n"]{0,60}ELO/);
  });
});
