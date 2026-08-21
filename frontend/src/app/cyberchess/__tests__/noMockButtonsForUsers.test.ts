import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..");

// 21.08.2026. Нашлось свипом по «кнопкам, которые ничего не делают»: на
// странице турниров кнопка «Spectate» у ИДУЩЕГО турнира показывала человеку
// «[mock] Spectate <название>» — заготовку разработчика. Рядом регистрация
// отвечала «Registered. Ticket <id>» и «Error: <код>» — чужой язык и код
// вместо объяснения.
//
// Сторож проверяет две вещи: слова-заготовки нигде не доходят до человека,
// и в сообщениях alert() нет чисто английского текста.

function stranicy(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") stranicy(p, acc);
    } else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function bezKommentariev(src: string): string {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("\/\/") || t.startsWith("\*") || t.startsWith("\/\*"));
    })
    .join("\n");
}

describe("человеку не показывают заготовки разработчика", () => {
  test("шаблон узнаёт свой образец", () => {
    // Контроль: сторож без него молча зеленеет — проверено на себе трижды.
    expect(/\[mock\]/i.test('alert(`[mock] Spectate ${t.title}`)')).toBe(true);
  });

  test("слова-заготовки не доходят до экрана", () => {
    const plohie: string[] = [];
    for (const f of stranicy(ROOT)) {
      const kod = bezKommentariev(fs.readFileSync(f, "utf-8"));
      for (const m of kod.matchAll(/(alert|setMessage|setError)\(([^;]*)/g)) {
        if (/\[mock\]|\[stub\]|\[TODO\]|placeholder/i.test(m[2])) {
          plohie.push(`${path.relative(ROOT, f)}: ${m[2].slice(0, 60)}`);
        }
      }
    }
    expect(plohie).toEqual([]);
  });

  test("в alert() нет чисто английского текста", () => {
    const plohie: string[] = [];
    for (const f of stranicy(ROOT)) {
      const kod = bezKommentariev(fs.readFileSync(f, "utf-8"));
      for (const m of kod.matchAll(/alert\(([^;]*)/g)) {
        const tekst = m[1].replace(/\$\{[^}]*}/g, "");
        const slova = tekst.match(/[A-Za-z]{3,}/g) || [];
        const est_russkiy = /[А-Яа-яЁё]/.test(tekst);
        // Английские слова без единого русского — значит человек получит
        // сообщение на чужом языке.
        if (slova.length >= 2 && !est_russkiy) {
          plohie.push(`${path.relative(ROOT, f)}: ${tekst.slice(0, 60)}`);
        }
      }
    }
    expect(plohie).toEqual([]);
  });
});
