import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Дата на /go совпадает с датой посадочной страницы запуска.
 *
 * В самом файле /go стоял комментарий «дата и содержание совпадают с
 * посадочной» — обещание без проверки. 30.08.2026 оно оказалось ложным:
 * запуск перенесли на 30 сентября, посадочную поправили, а /go продолжал
 * обещать 30 августа. Это самая видная страница платформы: единственная
 * кликабельная ссылка в шапках соцсетей.
 *
 * Сторож сверяет две страницы МЕЖДУ СОБОЙ и не знает «правильной» даты —
 * значит переживёт следующий перенос и покраснеет только на расхождении.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Дата после слова-маркера, позиционно: собранный из строки шаблон здесь уже терял слэши. */
function dateAfter(src: string, marker: string): string | null {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const tail = src.slice(i + marker.length, i + marker.length + 40);
  const cut = tail.split("<")[0].split('"')[0].trim();
  return cut.length > 3 ? cut : null;
}

describe("дата запуска одна на всех страницах", () => {
  test("/go называет ту же дату, что посадочная", () => {
    const landing = dateAfter(read("src/app/cyberchess/launch/page.tsx"), "Открываем ");
    const go = dateAfter(read("src/app/go/page.tsx"), "открываем ");
    expect(landing, "на посадочной не найдена дата после «Открываем»").toBeTruthy();
    expect(go, "на /go не найдена дата после «открываем»").toBeTruthy();
    expect(go, `посадочная обещает «${landing}», а /go — «${go}»`).toBe(landing);
  });

  test("подпись карточки на /go тоже не расходится", () => {
    const src = read("src/app/go/page.tsx");
    const landing = dateAfter(read("src/app/cyberchess/launch/page.tsx"), "Открываем ");
    const kicker = dateAfter(src, 'kicker="');
    expect(kicker, "у карточки запуска нет подписи").toBeTruthy();
    expect(
      String(kicker).startsWith(String(landing)),
      `подпись карточки «${kicker}» не начинается с даты посадочной «${landing}»`,
    ).toBe(true);
  });
});
