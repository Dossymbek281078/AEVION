import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tq } from "../qrightI18n";

/**
 * 20.10.2026, окно «Приложения». Экран «готово» QRight печатает тексты авторской доли,
 * которые приходят с бэка по-английски (routes/pipeline.ts: warning + recoveryPaths) —
 * после перевода всего блока именно они оставались английскими при ru (38–88 слов).
 * Фронт переводит их словарём по ТОЧНОЙ строке бэка; этот сторож читает бэк и краснеет,
 * если строка там изменилась, а в словаре осталась старая (перевод молча пропадёт).
 */
const BACKEND = join(__dirname, "..", "..", "..", "..", "..", "aevion-globus-backend", "src", "routes", "pipeline.ts");
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("тексты авторской доли с бэка переведены на русский", () => {
  test("фронт пропускает warning и recoveryPaths через словарь", () => {
    expect(PAGE).toContain("{tq(lang, result.authorShard.warning)}");
    expect(PAGE).toContain("• {tq(lang, p)}");
  });

  test("каждая строка бэка есть в словаре с русским переводом", () => {
    if (!existsSync(BACKEND)) { console.warn("бэк рядом не найден — проверка пропущена: " + BACKEND); return; }
    const be = readFileSync(BACKEND, "utf8");
    const warn = be.match(/warning:\s*\n?\s*"((?:[^"\\]|\\.)*)"/)?.[1];
    const paths = [...be.matchAll(/^\s*"(Your Author Shard \+[^"]*|AEVION vault \+ public Witness Shard[^"]*)",$/gm)].map((m) => m[1]);
    expect(warn, "warning на бэке").toBeTruthy();
    expect(paths.length).toBe(3);
    for (const s of [warn as string, ...paths]) {
      const ru = tq("ru", s);
      expect(ru, s.slice(0, 60)).not.toBe(s);
      expect(/[А-Яа-яЁё]/.test(ru), s.slice(0, 60)).toBe(true);
    }
  });
});
