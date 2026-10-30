import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Вкладка «Visual» рабочего окна говорит на языке посетителя.
 *
 * Замер 21.10.2026 (yazyk-devhub.mjs --build, прод a26c5584c): у kk-посетителя
 * на первом экране рабочего окна стояло «Click any text element in the preview
 * above…». Текст между тегами доводчик AutoTranslate переводит С РУССКОГО, а
 * английский литерал оставляет как есть — ru и kk видели его английским.
 * Сторож workspaceTextIsRussian его не видел: фраза стоит отдельной строкой
 * JSX, без тегов на той же строке. Атрибуты (placeholder, title) доводчик не
 * переводит вовсе — они в ATTR_UI.
 */

const SRC = fs.readFileSync(path.resolve(__dirname, "..", "[id]", "page.tsx"), "utf8");

function visualBlock(src: string): string {
  const start = src.indexOf('{activeTab === "visual" && (');
  const end = src.indexOf('tPro("proj.undoAi")', start);
  return start >= 0 && end > start ? src.slice(start, end) : "";
}

/** Строка JSX-текста, начатая английским словом и продолженная английскими словами. */
const ENGLISH_TEXT_LINE = /^[ \t]+[A-Z][a-z]+(?: [a-z]+){2,}[^=;{}()]*$/gm;
const LITERAL_ATTR = /\b(?:placeholder|title|aria-label)=(?:'[^']*'|"[^"]*"|\{`[^`]*`\})/g;

describe("вкладка Visual: текст и атрибуты на языке посетителя", () => {
  test("прибор видит то, что ищет, и не клевещет на словарь", () => {
    expect("                      Click any text element in the preview above.".match(ENGLISH_TEXT_LINE)?.length, "прибор ослеп").toBe(1);
    expect("                      Нажмите на любой текст в превью.".match(ENGLISH_TEXT_LINE), "прибор клевещет на русский").toBeNull();
    expect("title={`Align ${align}`}".match(LITERAL_ATTR)?.length, "прибор ослеп к шаблонной строке").toBe(1);
    expect("placeholder='e.g. \"x\"'".match(LITERAL_ATTR)?.length, "прибор ослеп к одинарным кавычкам").toBe(1);
    expect("placeholder={AL.veAiPrompt} title={AL[`veAlign_${align}`]}".match(LITERAL_ATTR), "прибор клевещет на словарь").toBeNull();
  });

  test("блок найден и в нём нет английского текста и литеральных атрибутов", () => {
    const block = visualBlock(SRC);
    expect(block.length, "блок вкладки Visual не найден — якоря сменились").toBeGreaterThan(2000);
    expect(block.match(ENGLISH_TEXT_LINE) ?? [], "английская фраза в тексте — ru/kk увидят её как есть").toEqual([]);
    expect(block.match(LITERAL_ATTR) ?? [], "литеральный атрибут — доводчик его не переведёт").toEqual([]);
  });

  test("новые ключи ATTR_UI есть на всех трёх языках", () => {
    for (const key of ["veImgPrompt", "veAiPrompt", "veAlign_left", "veAlign_center", "veAlign_right"]) {
      expect(SRC.split(`    ${key}: `).length - 1, key).toBe(3);
    }
  });
});
