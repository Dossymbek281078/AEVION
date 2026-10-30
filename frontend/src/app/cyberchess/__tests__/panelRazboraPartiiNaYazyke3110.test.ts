/**
 * Панель живого разбора партии говорит на языке страницы.
 *
 * Повод 31.10.2026 — путь платящего CyberChess на проде 2f217a909 (скрипт aevion-cyberchess-pay-path.mjs,
 * en-US и kk-KZ, 390 и 1280): после двух ходов в партии — «Неточность», «Ходы», «Точность», «Оценка по
 * ходам». Тексты идут через pt() из лениво грузимого zadachiText.ts, и словарь теперь грузится на любой
 * вкладке, если язык не русский (раньше — только в задачах).
 * КОНТРОЛЬ: на 4cb36509f красный.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ZADACHI_TEXT } from "../zadachiText";

const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const KIR = /[А-Яа-яЁё]/;

describe("панель разбора партии", () => {
  test("подписи — через pt(), голых литералов нет", () => {
    expect(PAGE).toContain('{pt("Точность")}');
    expect(PAGE).toContain('{pt("Оценка по ходам")}');
    expect(PAGE).toContain('{pt("Ходы")} {hist.length>0');
    expect(PAGE).not.toMatch(/>Точность<\/span>/);
    expect(PAGE).not.toMatch(/<span>Оценка по ходам<\/span>/);
    for (const q of ["БЛЕСТЯЩЕ!!", "Зевок", "Ошибка", "Неточность", "Отлично!"]) expect(PAGE).toContain(`pt("${q}")`);
  });

  test("переводы есть, en без кириллицы", () => {
    for (const k of ["БЛЕСТЯЩЕ!!", "Зевок", "Ошибка", "Неточность", "Отлично!", "Точность", "Оценка по ходам", "Ходы"]) {
      expect(ZADACHI_TEXT[k], k).toBeTruthy();
      expect(KIR.test(ZADACHI_TEXT[k].en), `${k}: ${ZADACHI_TEXT[k].en}`).toBe(false);
    }
  });

  test("словарь грузится на любой вкладке, если язык не русский", () => {
    expect(PAGE).toContain('if(cc.locale==="ru"||zt)return;');
    expect(PAGE).not.toContain('if(cc.locale==="ru"||zt||!(tab==="puzzles"||pzCurrent))return;');
  });
});
