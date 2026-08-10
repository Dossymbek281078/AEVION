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
  it("признак живёт в самих данных, а не в «пришёл ли ответ»", () => {
    /* `fetchRealBookStats` подставляет выдумку ВНУТРИ себя — когда нет UCI и когда
       Lichess не ответил. Значит непустой ответ ещё не значит «настоящее», и проверка
       `!replies` молчала бы ровно в тех случаях, ради которых заведена. Я так и написал
       с первого раза; поймал, только когда пошёл смотреть, что там за fallback внутри. */
    const data = stripComments(
      readFileSync(join(__dirname, "..", "openingRepertoireData.ts"), "utf8"),
    );
    expect(data).toMatch(/estimated\?: boolean/);
    expect(data).toMatch(/estimated: true/);
    for (const f of SITES) {
      const src = stripComments(readFileSync(f, "utf8"));
      expect(src, f).toMatch(/mockBookStats\(/);
      expect(src, f).toMatch(/const estimated = stats\.some\(\(s\) => s\.estimated\);/);
      expect(src, f).not.toMatch(/const estimated = !replies/);
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

describe("подстановка не залёживается в кэше", () => {
  it("для синтезированных данных срок жизни короткий, а не общий", () => {
    const data = stripComments(
      readFileSync(join(__dirname, "..", "openingRepertoireData.ts"), "utf8"),
    );
    /* Подстановка кладётся в ТОТ ЖЕ кэш, что и данные Lichess. По общему сроку она
       жила бы сутки, а при настройке «неделя» — неделю: одна неудачная загрузка
       закрепляла выдуманные проценты за веткой, и следующие заходы отдавали их из
       кэша, даже не пробуя сеть. Минутный сбой превращался в неделю неверных чисел. */
    expect(data).toMatch(/ESTIMATED_TTL_MS/);
    expect(data).toMatch(/function cacheTtlFor/);
    /* Проверяем ТОЛЬКО кэш статистики. Рядом живут ecoCache и gmGamesCache — они
       читаются по общему сроку, и это правильно: подстановки там нет. Первая версия
       проверки запрещала `ttlMs()` во всём файле и краснела на верном коде. */
    const fn = data.slice(
      data.indexOf("export async function fetchRealBookStats"),
      data.indexOf("export async function detectECO"),
    );
    expect(fn.length).toBeGreaterThan(200);
    expect(fn).toMatch(/now - hit\.ts < cacheTtlFor\(hit\.data\)/);
    expect(fn).not.toMatch(/now - hit\.ts < ttlMs\(\)/);
  });

  it("короткий срок действительно короче общего минимума", () => {
    const data = readFileSync(join(__dirname, "..", "openingRepertoireData.ts"), "utf8");
    const m = /ESTIMATED_TTL_MS = ([^;]+);/.exec(data);
    expect(m).not.toBeNull();
    const estimated = Function(`"use strict";return (${m![1]})`)() as number;
    // самый короткий общий пресет — час; подстановка должна жить заметно меньше
    expect(estimated).toBeLessThan(60 * 60 * 1000);
    expect(estimated).toBeGreaterThan(0);
  });
});
