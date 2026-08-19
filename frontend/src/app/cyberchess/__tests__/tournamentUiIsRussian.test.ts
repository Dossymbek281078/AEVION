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

describe("заголовки разделов модуля — русские", () => {
  // Ходьба по страницам 20.08: «хлебные крошки» и заголовки оставались
  // английскими — Training Hub, Tournament Hub, Leaderboard, Dashboard —
  // на страницах, где весь остальной текст русский.
  const stranitsy: Array<[string, string[], string[]]> = [
    ["training/page.tsx", ["Тренировки"], [">Training Hub<"]],
    ["tournament/page.tsx", ["Турнирный"], [">Tournament Hub<"]],
    ["cpi/leaderboard/page.tsx", ["Таблица лидеров"], [">Leaderboard<"]],
    ["cpi/dashboard/page.tsx", ["Мой CPI"], [">Dashboard<"]],
  ];
  test.each(stranitsy)("%s", (fajl, dolzhno, ne_dolzhno) => {
    const s = fs.readFileSync(path.join(ROOT, ...fajl.split("/")), "utf-8");
    for (const t of dolzhno) expect(s, `нет русского заголовка «${t}»`).toContain(t);
    for (const t of ne_dolzhno) expect(s, `английский заголовок вернулся: ${t}`).not.toContain(t);
  });
});

describe("контроли времени названы одинаково во всём модуле", () => {
  // 20.08.2026, ходьба по проду: одни и те же скорости назывались по-разному на
  // трёх страницах — Bullet/Blitz/Rapid/Classic в поиске соперника, ПУЛЯ/БЛИЦ/
  // РАПИД/КЛАССИКА в таблице лидеров, Буллет/Блиц/Рапид на главной. Человек не
  // обязан догадываться, что это одно и то же.
  //
  // Главную страницу тут НЕ проверяем: её ведут четыре чужие ветки, и правка
  // отдана владельцу списком. Придёт — сюда добавится строка.
  const angliyskie = [/Bullet /, /Blitz /, /Rapid /, /Classic /];

  test("шаблоны узнают свои образцы", () => {
    const obraztsy = ['sub: "Bullet · 1"', 'sub: "Blitz · 3"', 'sub: "Rapid · 10"', 'sub: "Classic · 30"'];
    angliyskie.forEach((re, i) => {
      expect(re.test(obraztsy[i]), `шаблон ${i + 1} не узнаёт свой образец`).toBe(true);
    });
  });

  test("в поиске соперника скорости по-русски", () => {
    const s = fs.readFileSync(path.join(ROOT, "matchmaking", "page.tsx"), "utf-8");
    expect(s).toContain("Пуля · 1 мин");
    expect(s).toContain("Блиц · 3 мин");
    expect(s).toContain("Рапид · 10 мин");
    expect(s).toContain("Классика · 30 мин");
    // Значения для сервера ("60+0") НЕ трогаем — это устройство, а не текст.
    expect(s).toContain('value: "60+0"');
    const kod = s.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    angliyskie.forEach((re) => {
      expect(re.test(kod), `английское название скорости вернулось: ${re}`).toBe(false);
    });
  });
});
