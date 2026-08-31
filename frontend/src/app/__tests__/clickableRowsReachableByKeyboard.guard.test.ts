import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Строки, которые нажимают мышью, должны нажиматься и с клавиатуры.
 *
 * Замер 28.08.2026: в мультичате 12 элементов с `onClick` и `cursor: pointer`
 * не имели ни роли, ни фокуса, ни обработки клавиш — Tab их пропускает, то
 * есть применить шаблон или подставить подсказку с клавиатуры было НЕЛЬЗЯ.
 *
 * Из 12 настоящих оказалось СЕМЬ. Остальные пять законны и трогать их нельзя:
 *   • три обёртки `(e) => e.stopPropagation()` — они не действие, а защита от
 *     закрытия; роль кнопки там была бы враньём для читалки;
 *   • две подложки модальных окон (закрыть по клику мимо) — им нужен Esc, а
 *     не место в обходе по Tab. Esc там уже есть (строка ~590).
 *
 * Поэтому храповик, а не ноль: он держит достигнутое и не заставляет «чинить»
 * то, что исправно.
 */

const FILE = join(__dirname, "..", "qcoreai", "multi", "page.tsx");
const BASELINE = 5;

function clickableWithoutKeyboard(src: string): number {
  let n = 0;
  let i = 0;
  while (true) {
    i = src.indexOf("<div", i);
    if (i === -1) break;
    let j = i;
    let depth = 0;
    while (j < src.length) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
      j++;
    }
    const tag = src.slice(i, j + 1);
    i = j + 1;
    if (!tag.includes("onClick")) continue;
    if (tag.includes("activatable(")) continue;
    if (tag.includes("role=") && tag.includes("tabIndex")) continue;
    n++;
  }
  return n;
}

describe("нажимаемые строки достижимы с клавиатуры", () => {
  it("их число не растёт", () => {
    const n = clickableWithoutKeyboard(readFileSync(FILE, "utf8"));
    expect(n, `стало ${n} при пороге ${BASELINE} — появилась строка, до которой не дойти по Tab`)
      .toBeLessThanOrEqual(BASELINE);
  });

  it("счётчик умеет краснеть — иначе порог ничего не охраняет", () => {
    // Отрицательный контроль: подсунуть заведомо плохой кусок.
    const bad = '<div onClick={() => go()} style={{ cursor: "pointer" }}>x</div>';
    expect(clickableWithoutKeyboard(bad)).toBe(1);
    const good = '<div {...activatable(() => go())}>x</div>';
    expect(clickableWithoutKeyboard(good)).toBe(0);
  });
});
