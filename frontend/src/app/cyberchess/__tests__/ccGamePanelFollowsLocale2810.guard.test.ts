import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tFor } from "../i18n";

/**
 * 28.10.2026, дефект от Продаж: на /cyberchess при English в панели партии стояли
 * русские «Вы», «Ход:», «Твой ход», «Партия завершена», «ходов», а исход партии
 * («Мат — вы победили!») переводился на русский ВСЕГДА, независимо от языка.
 * Источник — хардкод в page.tsx и ruResult() без языка.
 *
 * Сторож держит две вещи: (1) словарь даёт английские слова для ключей панели;
 * (2) в page.tsx не вернулся хардкод тех самых строк и ruResult зовётся только
 * внутри resultText (который на en отдаёт строку движка как есть).
 */
const PANEL_KEYS = [
  "game.panel", "game.moveNo", "game.over", "game.youWon", "game.draw", "game.youLost",
  "game.player", "game.player1", "game.player2", "game.moves", "game.analyzeWhole", "game.you",
];

describe("панель партии CyberChess следует языку", () => {
  test("EN — английские подписи, без кириллицы", () => {
    for (const k of PANEL_KEYS) {
      const v = tFor("en", k);
      expect(v, `${k}: ключа нет, откат на ru`).not.toBe(k);
      expect(/[а-яА-ЯёЁ]/.test(v), `${k} по-русски при en: «${v}»`).toBe(false);
    }
    expect(tFor("en", "game.you")).toBe("You");
    expect(tFor("en", "game.over")).toBe("Game over");
  });

  test("RU и KK — ключи заполнены", () => {
    for (const k of PANEL_KEYS) {
      expect(tFor("ru", k), `ru ${k}`).not.toBe(k);
      expect(tFor("kk", k), `kk ${k}`).not.toBe(k);
    }
    expect(tFor("ru", "game.you")).toBe("Вы");
  });

  test("page.tsx: хардкод панели не вернулся, ruResult только внутри resultText", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8");
    const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    for (const bad of ['"Твой ход"', '"Партия завершена"', '"Вы выиграли"', '"Вы проиграли"', '"Игрок 1"', '{histLen} ходов']) {
      expect(code.includes(bad), `вернулся хардкод ${bad}`).toBe(false);
    }
    // Определение + единственный вызов из resultText; остальные показы идут через resultText.
    const calls = (code.match(/ruResult\(/g) || []).length;
    const definition = (code.match(/function ruResult\(/g) || []).length;
    const inResultText = (code.match(/: ruResult\(o\)/g) || []).length;
    // Текст для «поделиться» и вопрос тренеру (две строки, целиком русские) пока зовут ruResult напрямую.
    expect(calls - definition - inResultText, "новых прямых вызовов ruResult в показе").toBeLessThanOrEqual(2);
    expect(code.includes("function resultText(")).toBe(true);
    expect(code.includes('locale === "en" ? (o || "") : ruResult(o)')).toBe(true);
  });
});
