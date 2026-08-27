import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Английские страницы не должны обещать того, чего нет, и не должны носить
 * вторую копию цены.
 *
 * ЗАЧЕМ ИМЕННО ЗДЕСЬ. Класс уже случался и стоил дорого: два английских
 * ролика говорили голосом «Free book» и «3 chapters free», а по ссылке книга
 * была платной и глав не существовало вовсе. Ролик переснять нельзя — текст
 * выжжен в пикселях, — поэтому единственное место, где расхождение ловится
 * дёшево, это страница.
 *
 * Что проверяется:
 *   1. То, что названо бесплатным, ведёт на страницу БЕЗ кассы.
 *   2. Ни одна цена не написана числом в вёрстке — только из каталога.
 *   3. У каждой кассы есть метка канала, иначе покупка придёт «ниоткуда».
 *   4. Обязательная оговорка про образовательный характер на месте.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

const EN_GO = readFileSync(join(APP, "en", "go", "page.tsx"), "utf8");
const EN_LONGEVITY = readFileSync(join(APP, "en", "longevity", "page.tsx"), "utf8");

describe("английские страницы: обещания и цены", () => {
  it("бесплатный блок ведёт на страницу, где нет кассы", () => {
    // На посадочной блок назван бесплатным и ведёт на разбор.
    expect(EN_GO).toContain("/en/longevity");
    expect(EN_GO.toLowerCase()).toContain("free");

    // А сам разбор отдаётся без оплаты: единственная касса на нём — отдельный
    // платный гайд, и она НЕ выдаётся за содержимое страницы.
    const buyLinks = EN_LONGEVITY.match(/<BuyLink/g) ?? [];
    expect(buyLinks.length).toBeLessThanOrEqual(1);
    // Слово free на странице разбора не должно стоять рядом с ценой: если
    // когда-нибудь разбор станет платным, этот тест обязан покраснеть.
    expect(EN_LONGEVITY).not.toMatch(/free[^.\n]{0,40}\$\d/i);
  });

  it("ни одна цена не написана числом в вёрстке", () => {
    // Цена живёт в каталоге. Вторая копия в странице расходится молча —
    // ровно так «$39» однажды пережил смену цены на $29.
    for (const [name, src] of [
      ["en/go", EN_GO],
      ["en/longevity", EN_LONGEVITY],
    ] as const) {
      // Разрешён только «$0» у бесплатного блока и подстановка {p.priceUsd}.
      const hardcoded = (src.match(/\$\d+/g) ?? []).filter((m) => m !== "$0");
      expect(hardcoded, `${name}: цена написана числом — ${hardcoded.join(", ")}`).toEqual([]);
    }
  });

  it("каждая касса несёт метку канала", () => {
    for (const [name, src] of [
      ["en/go", EN_GO],
      ["en/longevity", EN_LONGEVITY],
    ] as const) {
      const buys = (src.match(/<BuyLink/g) ?? []).length;
      const tagged = (src.match(/withChannel\(/g) ?? []).length;
      expect(tagged, `${name}: касс ${buys}, помечено каналом ${tagged}`).toBeGreaterThanOrEqual(buys);
    }
  });

  it("обе страницы несут оговорку про образовательный характер НА ЭКРАНЕ", () => {
    // Тема здоровья — ограниченная категория и у поисковиков, и у рекламных
    // систем: страница без оговорки рискует не только доверием.
    //
    // Проверять надо ВИДИМЫЙ текст, а не файл целиком. Первая версия теста
    // искала «not diagnosis» где угодно — и находила её в metadata. Мутация это
    // вскрыла: я убрал оговорку с экрана, а тест остался зелёным, потому что
    // описание для поисковика её сохраняло. Человеку показывают не metadata.
    const visible = (src: string) => src.slice(src.indexOf("export default"));
    for (const [name, src] of [
      ["en/go", EN_GO],
      ["en/longevity", EN_LONGEVITY],
    ] as const) {
      const body = visible(src);
      expect(body, `${name}: оговорки нет в видимом тексте`).toMatch(/not diagnosis/i);
      expect(body, `${name}: нет слов про лечение`).toMatch(/not treatment/i);
    }
  });

  it("разбор сохраняет градацию доказательности, включая отрицательную", () => {
    // Честность этого материала держится на градации: без буквы E раздел
    // «что переоценено» превращается в рекламу того же самого.
    expect(EN_LONGEVITY).toContain("no demonstrated effect");
    // A/B/C стоят в данных панели и стека, E — только у раздела «переоценённое»,
    // где градация проставляется в разметке. Первая версия теста искала все
    // четыре в данных и краснела на букве E — то есть на верном коде.
    for (const grade of ["A", "B", "C"]) {
      expect(EN_LONGEVITY).toContain(`ev: "${grade}"`);
    }
    expect(EN_LONGEVITY).toContain('ev="E"');
  });
});
