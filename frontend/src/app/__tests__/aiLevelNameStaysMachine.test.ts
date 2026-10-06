import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * У уровня соперника два имени, и путать их нельзя.
 *
 * `name` — машинное: уходит в поле aiLevel на сервер, в сохранённые партии и
 * в заголовки PGN (там же стоит "You"). Перевод его сломал бы данные задним
 * числом: прошлые партии остались бы с "Club", новые пришли бы с «Клубный».
 *
 * `ru` — то, что читает человек. 28.08.2026 на первом экране новичка главный
 * выбор — против кого играть — стоял по-английски: Beginner, Casual, Club,
 * Advanced, Expert, Master.
 */
const PAGE = path.join(__dirname, "..", "cyberchess", "page.tsx");

describe("имя уровня: машинное в данных, русское на экране", () => {
  const src = fs.readFileSync(PAGE, "utf8");

  it("у каждого уровня есть русское имя", () => {
    const levels = [...src.matchAll(/\{name:"(\w+)",ru:"([^"]+)"/g)];
    expect(levels.length, "уровней с полем ru").toBe(7);
    for (const [, , ru] of levels) {
      expect(ru.length, "русское имя не пустое").toBeGreaterThan(0);
    }
  });

  it("в данные уходит машинное имя, не переведённое", () => {
    expect(src, "aiLevel обязан брать name").toContain("aiLevel:lv.name");
    expect(src.includes("aiLevel:lv.ru"), "aiLevel не должен брать ru").toBe(false);
  });

  it("кнопка выбора уровня показывает ЧЕЛОВЕЧЕСКОЕ имя, а не машинное", () => {
    /*
     * 🔴 ПЕРЕПИСАНО ПРИЁМКОЙ 06.10.2026. Было дословно:
     *     expect(src).toContain("}}>{al.ru}</button>;");
     * и покраснело на ПОЧИНКЕ: ветвь 2fef84306 закрыла главную страницу шахмат
     * переводом целиком, и `al.ru` в кнопке сменился на `imyaUrovnya(al)`.
     * Продукт стал лучше — казах и англичанин видят своё имя уровня, а не
     * русское, — но дословная проверка читала это как поломку.
     *
     * Проверяем ТРЕБОВАНИЕ, а не его сегодняшнее написание: на кнопку уходит
     * человеческое имя, и машинное (`Beginner`, `Club`) на экран попасть не
     * может. Третья проверка — запасной путь: при отсутствии ключа в словаре
     * имя обязано откатиться на русское, иначе человек увидит "ai.beginner".
     */
    expect(src, "кнопка уровня больше не зовёт имя через переводчик").toContain("imyaUrovnya(al)}</button>");
    expect(src.includes("{al.name}</button>"), "на кнопку ушло машинное имя").toBe(false);

    const i = src.indexOf("const imyaUrovnya");
    expect(i, "функция имени уровня не найдена — проверять нечего").toBeGreaterThan(0);
    const тело = src.slice(i, i + 260);
    expect(тело, "пропал запасной путь: без ключа в словаре на экран уйдёт сам ключ").toContain("a.ru");
  });
});
