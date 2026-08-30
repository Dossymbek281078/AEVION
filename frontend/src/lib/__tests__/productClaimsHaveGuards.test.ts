import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Числовое обещание на продающей карточке живёт ровно до тех пор, пока за ним
 * кто-то следит.
 *
 * Замер 28.08.2026: я нашёл ручку с настоящим размером банка задач (502 584) и
 * вписал в карточку CyberChess «полмиллиона задач» — условие прежнего автора
 * («вернуть, когда будет чем подтвердить») было выполнено. Потом подменил
 * число на заведомо ложное — «десять миллионов задач» — и прогнал все проверки
 * каталога: НИ ОДНА не покраснела.
 *
 * То есть цифра стояла бы на витрине без защиты и разъехалась бы с продуктом
 * при первом изменении банка, а узнал бы об этом покупатель.
 *
 * Сторож держит принятое решение: числа задач в описании CyberChess нет. Вернуть
 * его можно — но вместе с проверкой, которая сверяет цифру с ручкой
 * /api/cyberchess-puzzles/meta. Тогда эту проверку надо ослабить осознанно, а не
 * мимоходом.
 */
const ISHODNIK = fs.readFileSync(path.join(__dirname, "..", "products.ts"), "utf-8");

function opisanieCyberchess(): string {
  const i = ISHODNIK.indexOf('id: "cyberchess"');
  expect(i, "карточка CyberChess исчезла из каталога").toBeGreaterThan(-1);
  const okno = ISHODNIK.slice(i, i + 1500);
  const m = okno.match(/desc:\s*"([^"]*)"/);
  expect(m, "у карточки CyberChess пропало описание").not.toBeNull();
  return m![1];
}

describe("числовые обещания на карточке товара", () => {
  test("в описании CyberChess нет числа задач без сторожа за ним", () => {
    const desc = opisanieCyberchess();
    // Ловим и цифрами, и словами: «500 000», «полмиллиона», «500k».
    expect(desc).not.toMatch(/\d[\d\s  ]{2,}/);
    for (const slovo of ["полмиллиона", "миллион", "тысяч", "500k", "500K"]) {
      expect(desc.toLowerCase()).not.toContain(slovo.toLowerCase());
    }
  });

  test("описание говорит теми же словами, что и сам модуль", () => {
    // В модуле их зовут задачами. «Пазлы» на витрине означали бы, что продукт и
    // продающая страница говорят о разном — так и было до 28.08.2026.
    const desc = opisanieCyberchess().toLowerCase();
    expect(desc).not.toContain("пазл");
    expect(desc).toContain("задач");
  });
});
