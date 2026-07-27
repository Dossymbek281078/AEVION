import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* Функция, переданная в setState, обязана быть чистой: React вправе вызвать её повторно,
   а в разработке при StrictMode (в Next 13+ включён по умолчанию) вызывает всегда. Всё,
   что складывает, от этого удваивается. За один заход это дало три дефекта в модуле:
   приз за место в турнире вместе с кубком, рейтинг и 12 Chessy на третьем шахе в
   Three-Check, и исполнение хода ДВАЖДЫ при вводе с клавиатуры (exec внутри апдейтера).

   Запрещаются только накопительные действия. Идемпотентные не считаются: `unlockAch`
   начинается с `if(c.ach[key])return c`, повторный вызов ничего не добавляет. Тост тоже
   не считается — в dev он покажется дважды, но денег не трогает. */

const DIR = "src/app/cyberchess";

const ACCUMULATING = [
  "addChessy(", // баланс
  "bumpDaily(", // счётчик дневной цели
  "svS(", // запись статистики
  "svR(", // запись рейтинга
  "sSts(", // счёт побед/поражений
  "sRat(", // рейтинг
  "exec(", // исполнение хода
];

const SETTER = /(?<![.\w])(set[A-Z][\w$]*|s[A-Z][\w$]*)\s*\(\s*\(?\s*(prev|prevState|p|c|s|st|list|arr|n|x|old|cur)\s*\)?\s*=>\s*\{/;

function sources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__") walk(p);
      } else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(DIR);
  return out;
}

describe("state updaters", () => {
  it("never accumulate from inside the updater", () => {
    const bad: string[] = [];
    for (const f of sources()) {
      const lines = readFileSync(f, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!SETTER.test(lines[i])) continue;
        let depth = 0;
        const body: string[] = [];
        for (let j = i; j < Math.min(i + 30, lines.length); j++) {
          body.push(lines[j]);
          depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
          if (j > i && depth <= 0) break;
        }
        // комментарии не в счёт: они описывают как раз этот запрет
        const txt = body.join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
        const hits = ACCUMULATING.filter((a) => txt.includes(a));
        if (hits.length) bad.push(`${f}:${i + 1} — ${hits.join(", ")} внутри апдейтера`);
      }
    }
    expect(bad).toEqual([]);
  });
});
