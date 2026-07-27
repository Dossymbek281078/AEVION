import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Размер платформы называется ТОЛЬКО по реестру.
 *
 * 27.07.2026 `/pitch` показывал инвестору «12 LIVE MVPS · of 33 planned nodes»,
 * а абзацем выше — «41 product nodes». Числа брались из `pitchModel.ts` —
 * рукописного списка, который остановился на 33 узлах, пока реестр дорос до 41.
 * Страница занижала продукт втрое и спорила сама с собой; `/demo` повторял то же.
 *
 * Сторож масштаба этого не увидел: он сверяет числа-ЛИТЕРАЛЫ в тексте, а здесь
 * значение считалось из длины массива в рантайме. Эта проверка закрывает ровно
 * ту слепую зону — она смотрит на ИСТОЧНИК числа, а не на само число.
 *
 * Что можно: `launchedModules.filter(...).length` как «сколько модулей мы
 * считаем глубокими» — это утверждение о нашей оценке, а не о размере реестра.
 * Что нельзя: подавать длину этих списков как количество модулей платформы.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Фразы, которые заявляют размер платформы. Рядом с ними число обязано быть из реестра. */
const SIZE_PHRASES = [
  "planned nodes",
  "emerging nodes",
  "product nodes",
  "modules in the registry",
  "modules deployed",
];

/** Источники, которым нельзя измерять платформу. */
const HANDWRITTEN = ["launchedModules.length", "ecosystemNodes.length", "totalNodes"];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

export function findHandwrittenSizeClaims(files: string[]): string[] {
  const bad: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      const claimsSize = SIZE_PHRASES.some((p) => line.includes(p));
      if (!claimsSize) return;
      const source = HANDWRITTEN.find((h) => line.includes(h));
      if (!source) return;
      bad.push(
        `${file.replace(APP_DIR, "src/app")}:${index + 1} — размер платформы взят из «${source}», ` +
          `а не из MODULE_NODES/LIVE_MODULES: «${line.trim().slice(0, 90)}»`,
      );
    });
  }
  return bad;
}

const FILES = collectSourceFiles(APP_DIR);
const VIOLATIONS = findHandwrittenSizeClaims(FILES);

describe("размер платформы называется по реестру, а не по рукописному списку", () => {
  it("сканирует настоящий набор страниц", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("ни одна страница не меряет платформу длиной локального массива", () => {
    expect(VIOLATIONS).toEqual([]);
  });

  it("правило ловит именно тот дефект, что был на /pitch (негативный тест)", () => {
    const seeded = join(APP_DIR, "__tests__", "fixtures", "handwrittenPlatformSize.txt");
    const found = findHandwrittenSizeClaims([seeded]);
    // Ровно две строки — как было на /pitch и на /demo. Точное число, чтобы
    // ложное срабатывание на допустимой строке рядом не осталось незамеченным.
    expect(found).toHaveLength(2);
  });
});
