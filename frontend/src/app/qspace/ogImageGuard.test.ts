import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Обещание карточки и сама картинка обязаны существовать вместе.
 *
 * Страница объявляла `summary_large_image` — то есть просила площадки показать
 * КРУПНОЕ изображение — и не давала его: у 60 страниц платформы файл
 * `opengraph-image.tsx` есть, у QSpace не было. Ссылка, отправленная в
 * мессенджере, выглядела бы пустой карточкой рядом с чужими картинками, и
 * заметить это по коду нельзя: обещание живёт в page.tsx, а исполнение —
 * в отдельном файле, которого просто нет.
 *
 * Здесь связываются оба конца. Мутация «убрать файл картинки» обязана
 * краснеть, иначе сторож стережёт форму, а не следствие.
 */
const DIR = __dirname;
const page = readFileSync(path.join(DIR, "page.tsx"), "utf8");

describe("обещание крупной карточки подкреплено картинкой", () => {
  it("объявлен summary_large_image — значит файл картинки существует", () => {
    const обещает = /summary_large_image/.test(page);
    expect(обещает, "контроль: страница вообще не объявляет карточку").toBe(true);
    expect(
      existsSync(path.join(DIR, "opengraph-image.tsx")),
      "страница просит крупную картинку, а файла opengraph-image.tsx нет — "
      + "ссылка в мессенджере покажется пустой карточкой",
    ).toBe(true);
  });

  it("картинка отдаёт нужный размер и подпись", () => {
    const og = readFileSync(path.join(DIR, "opengraph-image.tsx"), "utf8");
    // 1200×630 — размер, который просят все площадки; иное обрежется
    expect(og).toMatch(/width:\s*1200/);
    expect(og).toMatch(/height:\s*630/);
    expect(og, "нет alt — читалка и площадка не смогут описать картинку")
      .toMatch(/export const alt = "/);
    expect(og).toMatch(/contentType = "image\/png"/);
  });

  it("текст на картинке РУССКИЙ и статический", () => {
    // краулеры соцсетей не исполняют скрипты: автоперевод страницы до них не
    // доходит, значит текст обязан быть русским прямо в исходнике
    const og = readFileSync(path.join(DIR, "opengraph-image.tsx"), "utf8");
    const русские = og.match(/[а-яё]/gi) ?? [];
    expect(русские.length, "на карточке нет русского текста").toBeGreaterThan(200);
    expect(og, "текст берётся откуда-то во время выполнения — краулер его не увидит")
      .not.toMatch(/await fetch\(|process\.env\./);
  });

  it("на карточке нет чисел и цены — они устареют в кеше площадки", () => {
    const og = readFileSync(path.join(DIR, "opengraph-image.tsx"), "utf8");
    const внутриJsx = og.slice(og.indexOf("<div"));
    expect(внутриJsx, "цена на карточке: она ещё не назначена, а кеш держится долго")
      .not.toMatch(/\$\d|\d+\s*(₸|руб|\/мес)/);
    // числа каталогов (14 материалов, 40 предметов) растут, а карточка кешируется
    expect(внутриJsx).not.toMatch(/\d+\s*(материал|предмет)/i);
  });
});
