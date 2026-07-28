import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * «prod smoke 20/20» на /acquire было верно в тот день, когда его написали.
 * Замер 27.07 дал 24 шага в qsign-v2 и 12 в aev — счёт молча разошёлся с
 * реальностью, потому что смоки растут, а строка на странице нет.
 *
 * Проверить сам счёт статически нельзя — для этого надо гонять смоки против
 * прода. Но можно потребовать минимум: если на странице стоит счёт прогонов,
 * рядом обязана стоять дата замера. Тогда читатель видит, на когда цифра, а
 * не принимает её за сегодняшнюю.
 *
 * Сканирование делается на загрузке модуля, а не внутри it() — см.
 * qsignClaims.guard.test.ts: 400 файлов внутри теста не укладываются
 * в дефолтные 5 секунд под полным прогоном.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** «smoke 24/24», «прогон 13/13» и подобное. */
const RUN_COUNT = /(?:smoke|прогон|checks?)\s+(\d{1,3})\s*\/\s*(\d{1,3})/gi;
/** Дата замера сразу после счёта: «(27 Jul)», «(27.07)», «(2026-07-27)». */
const DATED = /^[^,·\n]{0,4}\(\s*(?:\d{1,2}[.\s][A-Za-zА-Яа-я]{3,8}|\d{1,2}\.\d{2}|\d{4}-\d{2}-\d{2})[^)]{0,12}\)/;

/** Страницы-хроники описывают прошлый релиз — дата там задана самим разделом. */
const CHRONICLE = /[\\/](changelog|history|archive)[\\/]/i;

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

/**
 * Отдаёт и находки, и число прочитанных файлов — общий контракт дисковых
 * сторожей: пустой результат при оборванном цикле выглядит как чистый код.
 */
export function findUndatedRunCounts(
  files: string[],
): { bad: string[]; scanned: number } {
  const bad: string[] = [];
  let scanned = 0;
  for (const file of files) {
    if (CHRONICLE.test(file)) continue;
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(RUN_COUNT)) {
      const after = text.slice((match.index ?? 0) + match[0].length);
      if (DATED.test(after)) continue;
      const line = text.slice(0, match.index ?? 0).split("\n").length;
      bad.push(`${file.replace(APP_DIR, "src/app")}:${line} — счёт без даты замера: «${match[0]}»`);
    }
  }
  return { bad, scanned };
}

const FILES = collectSourceFiles(APP_DIR);
const { bad: UNDATED, scanned: SCANNED } = findUndatedRunCounts(FILES);

describe("run-count claims carry the date they were measured", () => {
  it("scans a real, non-trivial set of page sources", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("every smoke/run count on a page says when it was measured", () => {
    expect(SCANNED, "цикл чтения оборвался — прочитано слишком мало файлов").toBeGreaterThan(50);
    expect(UNDATED).toEqual([]);
  });

  it("catches every undated count in the fixture and none of the dated one", () => {
    const seeded = join(APP_DIR, "__tests__", "fixtures", "undatedRunCount.txt");
    const { bad: found } = findUndatedRunCounts([seeded]);
    // Ровно три: две отгруженные строки с /acquire и русский вариант.
    // Точное число, а не «больше нуля»: иначе ложное срабатывание на
    // датированной строке прошло бы незамеченным.
    expect(found).toHaveLength(3);
    expect(found.join(" ")).not.toContain("24/24");
  });
});
