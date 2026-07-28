import { describe, it, expect } from "vitest";
import { describeBot, HUMAN_PROFILES } from "../humanBot";

/* Паспорт показывается игроку до партии, поэтому он обязан говорить правду о
   КОНКРЕТНОМ уровне, а не общими словами. Тест проверяет две вещи, которые здесь
   ломаются молча: что числа берутся из профиля этого уровня, и что уровни без
   человеческой модели не выдают себя за человекоподобных. */

describe("паспорт бота", () => {
  it("у каждого уровня с профилем свои числа, а не общий текст", () => {
    const texts = Object.keys(HUMAN_PROFILES).map((k) => describeBot(Number(k)).lines.join(" "));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("числа совпадают с профилем, а не выдуманы", () => {
    for (const key of Object.keys(HUMAN_PROFILES)) {
      const lvl = Number(key);
      const p = HUMAN_PROFILES[lvl];
      const text = describeBot(lvl).lines.join(" ");
      expect(text).toContain(`до ${p.bookPlies} полуходов`);
      expect(text).toContain(`${Math.round(p.bestChance * 100)}%`);
      expect(text).toContain(`${Math.round(p.blunderChance * 100)}%`);
    }
  });

  it("уровень без человеческой модели честно говорит, что это движок", () => {
    const engine = describeBot(6);
    expect(engine.human).toBe(false);
    expect(engine.lines.join(" ")).toContain("движок");
  });

  it("уровень с моделью помечен человеческим", () => {
    expect(describeBot(0).human).toBe(true);
  });

  it("описание не пустое ни для одного из семи уровней", () => {
    for (let i = 0; i <= 6; i++) {
      const d = describeBot(i);
      expect(d.lines.length).toBeGreaterThan(0);
      expect(d.lines.every((l) => l.trim().length > 0)).toBe(true);
    }
  });

  it("слабый уровень ошибается чаще сильного — и это видно в тексте", () => {
    // защита от копипасты: если описание перестанет зависеть от уровня, тест упадёт
    const weak = Math.round(HUMAN_PROFILES[0].blunderChance * 100);
    const strong = Math.round(HUMAN_PROFILES[2].blunderChance * 100);
    expect(weak).toBeGreaterThan(strong);
    expect(describeBot(0).lines.join(" ")).toContain(`${weak}%`);
    expect(describeBot(2).lines.join(" ")).toContain(`${strong}%`);
  });
});
