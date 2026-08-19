import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..");
const detail = () => fs.readFileSync(path.join(ROOT, "tournaments", "[id]", "page.tsx"), "utf-8");
const list = () => fs.readFileSync(path.join(ROOT, "tournaments", "page.tsx"), "utf-8");

// 20.08.2026. Найдено ходьбой по страницам, а не тестом: участник ЖИВОГО
// турнира видел три вкладки по-английски — Bracket, Standings, Schedule, —
// на полностью русской странице. Рядом в форме создания турнира формат
// назывался "Single elimination" и "Round-robin".
//
// Идентификаторы вкладок (id="bracket") НЕ трогаем: это устройство, а не
// текст для человека, и переименование сломало бы выбор вкладки.

const ANGLIYSKIE_PODPISI = [
  /label="Bracket"/,
  /label="Standings"/,
  /label="Schedule"/,
  />Single elimination</,
  />Round-robin</,
];

describe("турнирные страницы говорят по-русски", () => {
  test("шаблоны сторожа узнают свои образцы", () => {
    // Без этого сторож может молча ослепнуть: испорченный шаблон не совпадает
    // ни с чем и выглядит правильным. Проверено на себе 19.08.
    const obraztsy = [
      'label="Bracket"',
      'label="Standings"',
      'label="Schedule"',
      '<option value="x">Single elimination</option>',
      '<option value="y">Round-robin</option>',
    ];
    ANGLIYSKIE_PODPISI.forEach((re, i) => {
      expect(re.test(obraztsy[i]), `шаблон ${i + 1} не узнаёт свой образец`).toBe(true);
    });
  });

  test("вкладки живого турнира — русские", () => {
    const s = detail();
    expect(s).toContain('label="Сетка"');
    expect(s).toContain('label="Таблица"');
    expect(s).toContain('label="Расписание"');
    // Устройство осталось на месте — иначе «перевод» сломал бы выбор вкладки.
    expect(s).toContain('id="bracket"');
  });

  test("названия форматов — русские", () => {
    const s = list();
    expect(s).toContain("На вылет");
    expect(s).toContain("Круговой");
    expect(s).toContain("Швейцарская");
  });

  test("английские подписи не вернулись ни на одну из двух страниц", () => {
    const kod = [detail(), list()]
      .join("\n")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    ANGLIYSKIE_PODPISI.forEach((re) => {
      expect(re.test(kod), `английская подпись вернулась: ${re}`).toBe(false);
    });
  });
});
