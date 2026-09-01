import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Размер банка задач заявлялся в двух местах и расходился в СТО раз:
 * картинка запуска обещала «500 000+ задач», карточка приветствия новичка
 * — «5000+ задач». Настоящее число берётся из API (bankTotal, 502 584),
 * и рядом уже был образец: живое число с запасным «500 000+».
 *
 * Числа достижений («реши 10 задач») сюда не относятся — они про цель
 * игрока, а не про размер банка, поэтому порог в тысячу.
 */
const KOREN = join(__dirname, "..");
const POROG = 1000;
// Верхняя граница длины намеренно щедрая: первая версия ловила до девяти
// знаков и потому пропускала «10 000 000 задач» — то самое завышение,
// которым автор витрины проверял защиту и не получил ни одного красного.
const RAZRESHENO_CHISLO = 500000; // единственное согласованное зашитое значение

// Витрина живёт вне модуля, но заявляет о нём же. Число задач с продающей
// карточки убрали 28.08 именно потому, что его ничто не охраняло: автор
// проверил мутацией — подменил на «десять миллионов», и ни один сторож не
// покраснел. Защита должна появиться РАНЬШЕ числа, иначе его вернут снова
// без неё.
const VITRINA = join(KOREN, "..", "..", "lib", "products.ts");

function fajly(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "__tests__") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fajly(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

describe("заявление о размере банка задач не расходится с собой", () => {
  const spisok = fajly(KOREN);

  it("обход нашёл файлы модуля", () => {
    expect(spisok.length).toBeGreaterThan(50);
  });

  it("зашитых заявлений о банке, кроме согласованного, нет", () => {
    const chuzhie: string[] = [];
    for (const p of [...spisok, VITRINA]) {
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((l, i) => {
          if (l.trim().startsWith("//") || l.trim().startsWith("*")) return;
          for (const m of l.matchAll(/([\d  ]{4,16})\+?\s*задач/g)) {
            const syroe = m[1].trim();
            const chislo = Number(syroe.replace(/[  ]/g, ""));
            if (!Number.isFinite(chislo) || chislo < POROG) continue;
            // сравниваем по ЦИФРАМ: в исходнике пробел бывает обычным и
            // неразрывным, и написание не должно решать, верно ли число
            if (chislo === RAZRESHENO_CHISLO) continue;
            chuzhie.push(`${p}:${i + 1} — «${syroe} задач»`);
          }
        });
    }
    expect(chuzhie).toEqual([]);
  });
});
