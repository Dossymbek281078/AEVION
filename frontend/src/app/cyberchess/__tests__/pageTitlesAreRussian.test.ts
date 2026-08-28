import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..");

// 20.08.2026. Заголовки страниц — поверхность, которую не видит ни один тест,
// а человек видит первой: вкладка браузера, закладка, строка в поиске. Было 18
// английских из 30 файлов: «Personal CPI Dashboard», «Chessy Economy»,
// «CyberChess Studio · Streamer mode», «Training Hub — daily-задания».
//
// ВАЖНО про прибор: первый свип ответил «подозрительных 1» и НЕ ошибся вслух —
// у него потерялся обратный слэш, и регулярка молча искала не то. Поэтому здесь
// нет ни одной регулярки со слэшами: только startsWith/indexOf/includes.

const ZHARGON = ["hub", "daily", "dashboard", "leaderboard", "streamer mode", "brackets", "badges"];

// Имена, которые остаются английскими намеренно: продукт, валюта, чужие
// программы. Их присутствие НЕ повод краснеть.
const IMENA = ["cyberchess", "chessy", "obs", "pip", "cpi"];

function metaStroki(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!(t.startsWith("title:") || t.startsWith("description:"))) continue;
    const i = t.indexOf('"');
    if (i < 0) continue;
    const j = t.indexOf('"', i + 1);
    if (j < 0) continue;
    const v = t.slice(i + 1, j);
    if (v.length >= 8) out.push(v);
  }
  return out;
}

function fajly(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") fajly(p, acc);
    } else if (e.name === "layout.tsx") acc.push(p);
  }
  return acc;
}

describe("заголовки страниц модуля — по-русски", () => {
  test("прибор ловит заведомо плохой заголовок", () => {
    const obrazec = '  title: "Training Hub — daily-задания, эндшпиль",';
    const stroki = metaStroki(obrazec);
    expect(stroki.length, "разбор не нашёл заголовок вообще").toBe(1);
    const low = stroki[0].toLowerCase();
    expect(ZHARGON.some((w) => low.includes(w)), "жаргон в образце не распознан").toBe(true);
  });

  test("прибор молчит на нормальном заголовке", () => {
    const obrazec = '  title: "Тренировки — задания дня, эндшпиль, координаты",';
    const low = metaStroki(obrazec)[0].toLowerCase();
    expect(ZHARGON.some((w) => low.includes(w))).toBe(false);
    expect(IMENA.some((w) => low.includes(w))).toBe(false);
  });

  test("во всех layout заголовки без английского жаргона", () => {
    const spisok = fajly(ROOT);
    expect(spisok.length, "обход не нашёл layout — сторож ничего не проверил").toBeGreaterThan(5);
    const plohie: string[] = [];
    for (const f of spisok) {
      for (const v of metaStroki(fs.readFileSync(f, "utf-8"))) {
        const low = v.toLowerCase();
        const najdeno = ZHARGON.filter((w) => low.includes(w));
        if (najdeno.length) plohie.push(`${path.relative(ROOT, f)}: ${v.slice(0, 60)} [${najdeno}]`);
      }
    }
    expect(plohie).toEqual([]);
  });
});

describe("подписи на главной странице модуля — русские", () => {
  // 21.08. Перевёл 60 подписей из 73. Сторож держит те, что человек читает как
  // кнопку или заголовок; имена и форматы (PGN, SVG, Syzygy, Twitch, Lichess),
  // ники игроков и названия тем оформления сюда НЕ входят — они английские
  // намеренно.
  const ZAPRESHCHENO = [
    ">Win Rate<", ">Rating<", ">Editor<", ">Insights<", ">Opening Trainer<",
    ">🔁 Rematch<", ">↩ Undo<", ">💡 Hint<", ">⚔ Captured<", ">✕ Disconnect<",
    ">🏆 Tournament Mode", ">🎲 Chess Variants", ">👻 Ghost Mode", ">Streak<",
  ];

  test("шаблоны узнают свои образцы", () => {
    // Контроль: без него сторож молча зеленеет, если образец перестанет
    // совпадать по форме записи — на этом я уже попадался сегодня.
    const obrazec = '<div>Win Rate</div><span>🔁 Rematch</span>';
    expect(ZAPRESHCHENO.filter((z) => obrazec.includes(z)).length).toBeGreaterThan(1);
  });

  test("английские подписи не вернулись", () => {
    const src = fs.readFileSync(path.join(ROOT, "page.tsx"), "utf-8");
    const kod = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    const vernulis = ZAPRESHCHENO.filter((z) => kod.includes(z));
    expect(vernulis, "английская подпись вернулась на главную").toEqual([]);
  });
});

describe("подписи отделены от ключей", () => {
  // 21.08. Кнопки контроля времени выводили КЛЮЧ напрямую (`{c}` из
  // ["Bullet","Blitz","Rapid","Custom"]), и на экране стояло английское слово.
  // Браузер переводил его сам — я видел «Буллет» и принял за нашу подпись,
  // хотя такого слова в исходнике нет вовсе.
  //
  // Ключи менять нельзя: они участвуют в сравнениях и в типе. Поэтому подпись
  // отделена картой, и сторож держит именно её.
  const src = () => fs.readFileSync(path.join(ROOT, "page.tsx"), "utf-8");

  test("у кнопок скоростей есть русская карта подписей", () => {
    const s = src();
    expect(s, "подпись снова берётся из ключа").not.toContain("<span>{c}</span>");
    expect(s).toContain('Bullet:"Пуля"');
    expect(s).toContain('Custom:"Свой"');
    // Ключи на месте — иначе сломается выбор категории.
    expect(s).toContain('["Bullet","Blitz","Rapid","Custom"]');
  });

  test("ранги названы по-русски, звания оставлены", () => {
    // Таблица званий 28.08.2026 переехала в rating.ts — вместе с формулой
    // рейтинга, от которой зависит. Сторож ходит туда, где код живёт сейчас;
    // привязка к page.tsx давала ложное падение на переезде, а не на дефекте.
    const s = fs.readFileSync(path.join(ROOT, "rating.ts"), "utf-8");
    expect(s).toContain('t:"Начинающий"');
    expect(s).toContain('t:"Клубный"');
    // CM/FM/IM/GM — официальные звания ФИДЕ, они не переводятся.
    expect(s).toContain('t:"GM"');
  });
});

describe("подсказки и aria-label — по-русски", () => {
  // 21.08. Их не видно глазами: title всплывает при наведении, aria-label
  // читает экранный диктор. На русской странице было 28 английских, в том числе
  // aria-label="Close" в шести окнах — диктор объявлял «Close» по-английски.
  const ZAPRESHCHENO = [
    'aria-label="Close"', 'title="Close"', 'title="Edit URL"',
    'title="Show Twitch panel"', 'title="🎓 Opening Trainer"',
    'title="♛ Board Editor"', 'aria-label="loading"', 'aria-label="Choose voice"',
  ];

  test("шаблоны узнают свой образец", () => {
    const obrazec = '<button aria-label="Close" title="Edit URL">';
    expect(ZAPRESHCHENO.filter((z) => obrazec.includes(z)).length).toBe(2);
  });

  test("английских подсказок в модуле не осталось", () => {
    const plohie: string[] = [];
    const obojti = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__") obojti(p);
        } else if (e.name.endsWith(".tsx")) {
          const kod = fs.readFileSync(p, "utf-8")
            .split("\n")
            .filter((l) => !l.trim().startsWith("//"))
            .join("\n");
          for (const z of ZAPRESHCHENO) {
            if (kod.includes(z)) plohie.push(`${path.relative(ROOT, p)}: ${z}`);
          }
        }
      }
    };
    obojti(ROOT);
    expect(plohie).toEqual([]);
  });
});

describe("кнопки-значки имеют имя для диктора", () => {
  // 21.08. Восемь кнопок были только значком — «✕», «⏮», «⏭» — без aria-label
  // и без title. Экранный диктор объявляет такую кнопку словом «кнопка» и
  // больше ничем: незрячий человек не знает, закроет он окно или переключит
  // трек. Глазами этот класс не виден вовсе.
  const ZNACHKI = ["✕", "⏮", "⏭"];

  function bezImeni(src: string): string[] {
    const out: string[] = [];
    for (const m of src.matchAll(/<button([^>]{0,400})>([^<]{1,12})<\/button>/g)) {
      const t = m[2].trim();
      if (!ZNACHKI.includes(t)) continue;
      if (/aria-label|title=/.test(m[1])) continue;
      out.push(t);
    }
    return out;
  }

  test("детектор видит кнопку без имени", () => {
    expect(bezImeni('<button style={{a:1}}>✕</button>').length).toBe(1);
    expect(bezImeni('<button aria-label="Закрыть">✕</button>').length).toBe(0);
  });

  test("в модуле таких кнопок нет", () => {
    const plohie: string[] = [];
    const obojti = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__") obojti(p);
        } else if (e.name.endsWith(".tsx")) {
          const n = bezImeni(fs.readFileSync(p, "utf-8")).length;
          if (n) plohie.push(`${path.relative(ROOT, p)}: ${n}`);
        }
      }
    };
    obojti(ROOT);
    expect(plohie, "кнопка-значок без имени для диктора").toEqual([]);
  });
});

describe("подпись связана с полем на пути новичка", () => {
  // 21.08. У поля «Ник» и ползунка «Твой рейтинг» подпись стояла рядом, но
  // программно с полем связана НЕ была: нет htmlFor и id. Глазами подпись
  // видна, диктор её не назовёт — он скажет «поле ввода» и всё.
  //
  // Граница честная: в модуле 59 полей без связи, здесь закреплены только два
  // на пути новичка (поиск соперника). Остальные — в отчёте основателю; чинить
  // их скопом без проверки каждого экрана рискованнее, чем оставить.
  test("поиск соперника: ник и рейтинг связаны", () => {
    const s = fs.readFileSync(path.join(ROOT, "matchmaking", "page.tsx"), "utf-8");
    expect(s).toContain('htmlFor="mm-nick"');
    expect(s).toContain('id="mm-nick"');
    expect(s).toContain('htmlFor="mm-rating"');
    expect(s).toContain('id="mm-rating"');
  });
});

describe("у каждого поля ввода есть имя для диктора", () => {
  // 21.08. Было 58 полей, у которых диктор говорил «поле ввода» и ничего
  // больше: ни label рядом, ни aria-label. Стало 0 — 13 связаны с подписями,
  // 45 получили имя по месту.
  //
  // Окно 14 строк, а не 6: имя может стоять далеко от открывающего тега.
  // С окном в 6 строк детектор не увидел уже существующий aria-label в
  // VoiceCoach и поставил ВТОРОЙ — дубль поймал TSC.
  function bezImeni(src: string): number {
    const lines = src.split("\n");
    let n = 0;
    lines.forEach((l, i) => {
      if (!/<(input|textarea|select)\b/.test(l)) return;
      const blok = lines.slice(i, i + 14).join("\n");
      if (/type\s*=\s*["'](hidden|checkbox|radio|range|color|file)/.test(blok)) return;
      if (/aria-label|aria-labelledby|\bid\s*=/.test(blok)) return;
      if (/<label[^>]*>/.test(lines.slice(Math.max(0, i - 4), i).join("\n"))) return;
      n++;
    });
    return n;
  }

  test("детектор видит поле без имени и не видит поле с именем", () => {
    expect(bezImeni("<input value={x} />")).toBe(1);
    expect(bezImeni('<input aria-label="Ник" value={x} />')).toBe(0);
  });

  test("во всём модуле полей без имени нет", () => {
    const plohie: string[] = [];
    const obojti = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__") obojti(p);
        } else if (e.name.endsWith(".tsx")) {
          const n = bezImeni(fs.readFileSync(p, "utf-8"));
          if (n) plohie.push(`${path.relative(ROOT, p)}: ${n}`);
        }
      }
    };
    obojti(ROOT);
    expect(plohie, "поле ввода без имени для диктора").toEqual([]);
  });
});
