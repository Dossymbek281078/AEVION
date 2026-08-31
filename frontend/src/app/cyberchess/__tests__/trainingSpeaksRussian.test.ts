import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Страница тренировок говорит с человеком по-русски и одним именем валюты.
 *
 * Замер 29.08.2026, чтением живой страницы: в одном блоке заголовок был
 * «ЕЖЕДНЕВНЫЙ CHESSY», а кнопка под ним — «Забрать +25 AEV». Человек забирает
 * награду и не понимает, что именно получил: во всём модуле валюта зовётся
 * Chessy (223 упоминания), а AEV встречается почти только как часть названия
 * компании.
 *
 * Плюс английские слова там же: «Coach определит», «Coach Review»,
 * «CPI Leaderboard», «Economy».
 */
const STRANICA = fs.readFileSync(
  path.join(__dirname, "..", "training", "page.tsx"),
  "utf-8",
);

/** Видимый человеку текст: без строк-комментариев и без служебных URL. */
const VIDIMOE = STRANICA.split("\n")
  .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
  .join("\n")
  // Вырезаем сами АДРЕСА, а не строки с ними: подпись пункта меню стоит рядом
  // со ссылкой, и фильтр по строке выбрасывал её вместе с адресом. Проверено
  // мутацией: возврат «Economy» тогда не ловился.
  .replace(/href:[ ]*"[^"]*"/g, "")
  .replace(/"[^"]*aevion[^"]*"/g, "");

describe("страница тренировок", () => {
  test("валюта названа одним именем — Chessy, а не AEV", () => {
    expect(VIDIMOE).not.toMatch(/\+\d+\s*AEV/);
    expect(VIDIMOE).toContain("Chessy");
  });

  test("на экране нет английских слов вместо русских", () => {
    for (const slovo of ["Coach Review", "CPI Leaderboard", '"Economy"']) {
      expect(VIDIMOE, `на экране осталось «${slovo}»`).not.toContain(slovo);
    }
  });
});
