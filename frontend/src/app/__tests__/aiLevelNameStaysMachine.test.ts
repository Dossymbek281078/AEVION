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

  it("кнопка выбора уровня показывает русское имя", () => {
    expect(src).toContain("}}>{al.ru}</button>;");
  });
});
