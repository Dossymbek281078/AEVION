import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Синтезированная статистика дебютов подписана синтезированной.
 *
 * `mockBookStats` выдаёт «12 000 партий» и проценты белых/ничьих/чёрных, выведенные
 * из суммы кодов символов хода. Подставляется она молча — `replies || mockBookStats(...)` —
 * и рисуется теми же полосами и той же подписью «N игр», что настоящая статистика
 * мастеров. При любом сбое загрузки игрок выбирал дебют по выдуманным числам и не имел
 * способа это заметить.
 *
 * Здесь тяжелее, чем с таблицей лидеров: там выдумка была украшением, а тут это данные,
 * по которым принимают решение. Поэтому подпись говорит прямо — «выбирать дебют по ним
 * нельзя», а не «демо».
 */

const SITES = [
  join(__dirname, "..", "repertoire", "page.tsx"),
  join(__dirname, "..", "OpeningRepertoire.tsx"),
];

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("подстановка статистики дебютов подписана", () => {
  it("оба места, где она подставляется, помечают это флагом", () => {
    for (const f of SITES) {
      const src = stripComments(readFileSync(f, "utf8"));
      expect(src, f).toMatch(/mockBookStats\(/);
      // подстановка и признак подстановки должны стоять вместе
      expect(src, f).toMatch(/const estimated = !replies;/);
    }
  });

  it("оба места показывают предупреждение, а не только считают флаг", () => {
    for (const f of SITES) {
      const raw = readFileSync(f, "utf8");
      expect(raw, f).toMatch(/estimated &&/);
      expect(raw, f).toMatch(/Статистика мастеров не загрузилась/);
    }
  });

  it("предупреждение не смягчено до «приблизительных» чисел", () => {
    /* «Приблизительные» — это тоже неправда: числа не приближают ничего, они
       выведены из кодов символов хода. Формулировка должна запрещать решение. */
    for (const f of SITES) {
      const raw = readFileSync(f, "utf8");
      expect(raw, f).toMatch(/не взяты из\s*\n?\s*реальных партий/);
    }
  });
});
