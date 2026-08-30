import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Одна вещь — одно имя. 28.08.2026 на первом экране новичка тактическая
 * позиция называлась и «задачей» (шапка «400 задач», кнопка «Решить задачу»,
 * «502 584 задачи в банке»), и «пазлом» (цель дня «Реши 5 пазлов», вкладка
 * «Пазлы», тост «Битый пазл, пропускаю»). Человек не обязан догадываться,
 * что это одно и то же.
 *
 * Машинные имена (id вкладки puzzles, PUZZLES, puzzleGoal) и название режима
 * Puzzle Rush — не в счёт: их читает код, а не человек.
 */
// Весь модуль, а не только page.tsx. 28.08.2026 сторож был зелёным, пока
// слово «Пазлы» жило в OnboardingOverlay.tsx — на карточке ПЕРВОГО экрана
// новичка, то есть в самом видном месте из возможных. Проверять один файл
// там, где текст разложен по многим, — это обещать охват, которого нет.
// DailyMission.tsx добавлен 28.08: слово «Пазлы» пережило унификацию именно
// там — файла не было в списке, и сторож молчал законно. Это второй раз, когда
// список файлов отстаёт от реальности; полный обход модуля пока невозможен —
// в daily/ и studio/ остались места, которые ведут чужие ветки.
const FAJLY = ["page.tsx", "OnboardingOverlay.tsx", "CommandPalette.tsx", "DailyMission.tsx"]
  .map((f) => path.join(__dirname, "..", f))
  .filter((f) => fs.existsSync(f));
const PAGE = FAJLY[0];

/** Видимые человеку строки: текст между тегами и строковые литералы. */
function vidimoe(src: string): string[] {
  const bezKom = src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
  const out: string[] = [];
  for (const m of bezKom.matchAll(/>([^<>{}]{4,300})</g)) out.push(m[1]);
  // Только те литералы, которые доходят до глаз: подписи, заголовки,
  // подсказки, сообщения. Брать ВСЕ строки нельзя — под шаблон попадают
  // куски кода и имена классов, и сторож краснеет на самом себе.
  const POZICII =
    /([a-zA-Z]*[Ll]abel:|title:|hint:|sub:|desc:|task:|placeholder=|aria-label=)\s*[`"]([^`"]{4,300})[`"]/g;
  for (const m of bezKom.matchAll(POZICII)) out.push(m[2]);
  for (const v of bezKom.matchAll(/showToast\(([^;]{0,400}?)\)/g)) {
    for (const lit of (v[1] ?? "").matchAll(/[`"]([^`"]{4,300})[`"]/g)) out.push(lit[1]);
  }
  return out;
}

function govoritPazl(t: string): boolean {
  if (t.includes("Puzzle Rush")) return false; // название режима
  return /[Пп]азл/.test(t);
}

describe("тактическая позиция называется задачей, а не пазлом", () => {
  it("в видимом тексте модуля слова «пазл» нет", () => {
    const najdeno = FAJLY.flatMap((f) => vidimoe(fs.readFileSync(f, "utf8"))).filter(govoritPazl);
    expect(najdeno.map((t) => t.slice(0, 60))).toEqual([]);
  });

  it("проверка умеет краснеть", () => {
    expect(vidimoe('<div>Реши 5 пазлов</div>').filter(govoritPazl).length).toBe(1);
  });

  it("название режима не считается нарушением", () => {
    expect(vidimoe('<div>Puzzle Rush — 3 минуты</div>').filter(govoritPazl)).toEqual([]);
  });
});
