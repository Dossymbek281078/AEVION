import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { VARIANTS } from "../variants";

/**
 * Публичная страница CyberChess обещает «12 вариантов» (title/description в
 * layout.tsx — это то, что видит человек в поиске и при шейре). Число «12»
 * жило РУКОПИСНОЙ строкой в метаданных, ничем не связанной с реальным списком
 * VARIANTS. Добавили/убрали вариант — заявка молча разошлась бы с продуктом
 * (класс «витрина обещает больше продукта»).
 *
 * Здесь связь закреплена: сколько нестандартных вариантов реально есть, столько
 * и должна называть страница. `standard` (обычные шахматы) в счёт «вариантов»
 * не входит — это базовый режим, а не вариант.
 *
 * Если тест покраснел: либо в VARIANTS добавили/убрали вариант — обнови число
 * «N вариантов» в layout.tsx (обе строки, twitter+description), либо число в
 * метаданных поправили на неверное.
 */
describe("заявка «N вариантов» на публичной странице не врёт", () => {
  const layout = readFileSync(join(process.cwd(), "src/app/cyberchess/layout.tsx"), "utf8");

  it("нестандартных вариантов ровно столько, сколько обещает страница", () => {
    const realVariants = VARIANTS.filter((v) => v.id !== "standard").length;
    // контроль охвата: список вообще прочитан и непуст
    expect(VARIANTS.length).toBeGreaterThan(1);
    // сколько раз встречается «<N> вариантов» в метаданных
    const claimed = [...layout.matchAll(/(\d+)\s+вариант/gi)].map((m) => Number(m[1]));
    expect(claimed.length, "в layout.tsx нет заявки «N вариантов» — куда делась?").toBeGreaterThan(0);
    for (const n of claimed) {
      expect(n, `страница обещает ${n} вариантов, а нестандартных в VARIANTS ${realVariants}`).toBe(realVariants);
    }
  });

  it("standard действительно в списке — иначе вычитание единицы неверно", () => {
    // Если базовый режим переименуют/уберут, формула realVariants сломается
    // молча — этот контроль ловит смену допущения.
    expect(VARIANTS.some((v) => v.id === "standard")).toBe(true);
  });
});
