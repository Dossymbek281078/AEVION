import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 138 (13.10.2026): первый экран = доска + один явный шаг в кадре.
 * Замер на проде 43cf21e2e, 1463×724: большая кнопка «ИГРАТЬ» в лобби лежала на 662–736 при
 * высоте окна 724 — за кромкой; на 390×844 — на 1115. Подпись «Нажмите доску» внизу доски
 * ложилась на фигуры нижнего ряда. Теперь призыв — пилюля в ЦЕНТРЕ доски (как «Play» у
 * chess.com), не перехватывающая клик (доска остаётся кнопкой). Живой кадр и попадание
 * elementFromPoint мерит прибор 01-CyberChess/2026-10-14-ДОСКА/priemka-doski.mjs + Playwright.
 */
const SRC = readFileSync(join(process.cwd(), "src/app/cyberchess/SetupBoardPreview.tsx"), "utf8");

describe("пилюля «Играть» в центре доски первого экрана", () => {
  it("есть маркер data-cc-start-pill, центрирована, не перехватывает клик", () => {
    expect(SRC).toContain('data-cc-start-pill="1"');
    const блок = SRC.slice(SRC.indexOf('data-cc-start-pill="1"'));
    expect(блок).toMatch(/left:\s*"50%"/);
    expect(блок).toMatch(/top:\s*"50%"/);
    expect(блок).toMatch(/transform:\s*"translate\(-50%,-50%\)"/);
    expect(блок).toMatch(/pointerEvents:\s*"none"/);
    expect(блок).toMatch(/fontSize:\s*18/);
  });
  it("прежней тонкой подписи у нижнего ряда нет", () => {
    expect(SRC).not.toContain("linear-gradient(to top, rgba(0,0,0,0.58), rgba(0,0,0,0))");
    expect(SRC).not.toMatch(/bottom:\s*0,\s*\n\s*\/\/ Тонко и мягко/);
  });
  it("доска по-прежнему кнопка с onStart и aria-label", () => {
    expect(SRC).toContain("onClick={onStart}");
    expect(SRC).toContain("aria-label={label}");
  });
});
