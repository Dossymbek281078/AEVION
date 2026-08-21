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

describe("кнопка к таблице лидеров названа одинаково", () => {
  // Ходьба по проду 20.08: на двух страницах кнопка называлась «Лидерборд»,
  // а сама страница, куда она ведёт, — «Рейтинг-лидерборд», и в разделе CPI
  // я уже назвал её «Таблица лидеров». Три имени у одной кнопки.
  test.each(["matchmaking/page.tsx", "history/page.tsx"])("%s", (fajl) => {
    const s = fs.readFileSync(path.join(ROOT, ...fajl.split("/")), "utf-8");
    expect(s, "кнопка всё ещё зовётся Лидерборд").not.toContain(">Лидерборд<");
    expect(s).toContain("Таблица лидеров");
  });
});

describe("в центре обучения нет жаргона разработчика", () => {
  // 20.08: на экран уехали внутренние термины — «Основан на CPI weak factor,
  // due Coach reminders, и daily-variant ротации», «Открой Coach Knowledge»,
  // «за визит в training hub». Это записки для себя, а не текст для человека.
  const zhargon = [/CPI weak factor/, /Coach reminders/, /daily-variant/, /Coach Knowledge/, /training hub/];

  test("шаблоны узнают свои образцы", () => {
    const obraztsy = ["Основан на CPI weak factor", "due Coach reminders,", "и daily-variant ротации",
                      "Открой Coach Knowledge чтобы", "за визит в training hub."];
    zhargon.forEach((re, i) => {
      expect(re.test(obraztsy[i]), `шаблон ${i + 1} не узнаёт свой образец`).toBe(true);
    });
  });

  test("видимый текст страницы чист", () => {
    const s = fs.readFileSync(path.join(ROOT, "training", "page.tsx"), "utf-8");
    // Комментарии и структурированные данные не трогаем: первое — записки в коде,
    // второе — то, что читает поисковик, и меняется отдельным решением.
    const vidimyj = s
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .filter((l) => !l.includes("description:") && !l.includes("@id"))
      .join("\n");
    zhargon.forEach((re) => {
      expect(re.test(vidimyj), `жаргон вернулся на экран: ${re}`).toBe(false);
    });
  });
});

describe("подписи со значком тоже по-русски", () => {
  // 21.08. Дыра в МОЁМ прежнем свипе: он требовал, чтобы видимый текст начинался
  // с латинской буквы, а у кнопок впереди значок — «▶ Drill», «✎ Edit»,
  // «⏱ Clock Pressure Drill». Поэтому вчерашний вывод «модуль чист по языку» был
  // шире, чем проверка. Нашлось глазами на /cyberchess/repertoire.
  //
  // Первая версия ЭТОГО сторожа тоже была декоративной: искала ">Drill" и
  // "\"Drill\"", а в файле стоит "▶ Drill" — мутация не покраснела. Поэтому
  // теперь извлекаем видимый текст между тегами и ищем слово в нём.
  function vidimyj(src: string): string[] {
    const bezKom = src
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !(t.startsWith("\/\/") || t.startsWith("\*"));
      })
      .join("\n");
    const out: string[] = [];
    for (const m of bezKom.matchAll(/>([^<>{}]{2,120})</g)) {
      const v = m[1].replace(/\s+/g, " ").trim();
      // Отсекаем код: обобщённые типы дают ложные «>текст<»
      // (useState<string | null>), и на них сторож краснел зря.
      if (v && !/[;=(){}|]/.test(v)) out.push(v);
    }
    return out;
  }

  test("извлекатель видит подпись со значком", () => {
    // Контроль: без него сторож молча зеленеет, как и случилось час назад.
    const najdeno = vidimyj("<button>\n            ▶ Drill\n          </button>");
    expect(najdeno.some((t) => t.includes("Drill")), "видимый текст со значком не извлечён").toBe(true);
  });

  const mesta: Array<[string, string[]]> = [
    ["OpeningRepertoire.tsx", ["Drill", "Edit"]],
    ["ClockPressureDrill.tsx", ["Clock Pressure Drill"]],
    ["MirrorModePanel.tsx", ["Mirror Mode"]],
    ["MultiPanel.tsx", ["Multi-panel"]],
  ];
  test.each(mesta)("%s", (fajl, zapreshcheno) => {
    const teksty = vidimyj(fs.readFileSync(path.join(ROOT, fajl), "utf-8"));
    for (const t of zapreshcheno) {
      const plohie = teksty.filter((v) => v.includes(t));
      expect(plohie, `английская подпись «${t}» на экране в ${fajl}`).toEqual([]);
    }
  });
});
