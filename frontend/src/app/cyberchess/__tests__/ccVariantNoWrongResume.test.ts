import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 08.09.2026. ResumeSnap (автосейв незавершённой партии) НЕ хранит вариант и
 * вариант-специфичное состояние. Автосейв срабатывал на любой партии, поэтому
 * возобновление вариантной (Atomic/KotH/ThreeCheck/…) молча играло бы по
 * СТАНДАРТУ из той позиции — правила варианта пропадали (marquee-фича «12
 * вариантов»). Пока полного восстановления вариантов нет, автосейв ограничен
 * СТАНДАРТОМ: лучше не предлагать resume варианту, чем воскресить его с чужими
 * правилами.
 *
 * Сторож держит гард. Мутация (убрать variant!=="standard") → красный.
 */
const SRC = path.join(__dirname, "..", "page.tsx");
const src = () => fs.readFileSync(SRC, "utf-8");

describe("вариантные партии не воскрешаются по стандарту", () => {
  it("автосейв незавершённой партии ограничен вариантом standard", () => {
    const s = src();
    // условие раннего выхода автосейва включает variant!=="standard"
    expect(s).toMatch(/if\(tab!=="play"\|\|!on\|\|over\|\|setup\|\|hist\.length===0\|\|variant!=="standard"\)return/);
  });

  it("ResumeSnap действительно НЕ содержит поля variant (обоснование гарда)", () => {
    const s = src();
    const m = s.match(/type ResumeSnap=\{[^}]*\}/);
    expect(m, "тип ResumeSnap не найден — проверку обновить").not.toBeNull();
    // если поле variant появится (полное восстановление сделано) — этот тест
    // краснеет как напоминание снять гард автосейва и восстановить вариант.
    expect(/\bvariant\b/.test(m![0])).toBe(false);
  });
});
