import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Остаток за месяц показывается человеку, а не выбрасывается.
 *
 * Замер 28.08.2026: витрина запрашивала /studio/credits и брала из ответа ТОЛЬКО
 * тариф. А ручка отдаёт и числа:
 *
 *   { video: {used: 0, limit: 3}, image: {used: 0, limit: 10}, tts: {...} }
 *
 * То есть модуль знал, сколько у человека осталось, и не говорил. Предел
 * узнавался единственным способом — упереться в него на бесплатном тарифе
 * (видео 3, картинки 10).
 */

const SRC = fs.readFileSync(path.resolve(__dirname, "..", "page.tsx"), "utf8");
const DICT = fs.readFileSync(path.resolve(__dirname, "..", "i18n.ts"), "utf8");

describe("остаток за месяц доходит до экрана", () => {
  test("прибор исправен: файлы прочитаны", () => {
    expect(SRC.length).toBeGreaterThan(2000);
    expect(DICT.length).toBeGreaterThan(500);
  });

  test("числа из ответа сохраняются, а не отбрасываются", () => {
    expect(SRC).toContain("if (d.usage) setUsage(d.usage)");
  });

  test("и выводятся на экран", () => {
    expect(SRC).toContain("usage.title");
    expect(SRC).toContain("USAGE_LABEL[k]");
  });

  test("безлимитное НЕ показывается", () => {
    // limit === -1 значит «без предела»; строка «осталось -1 из -1» была бы
    // хуже отсутствия строки.
    expect(SRC).toContain("v.limit > 0");
  });

  test("при неответившей ручке строки нет вовсе", () => {
    // Выдумать «0 из 0» хуже, чем не показать: человек решит, что квота
    // исчерпана, и уйдёт.
    expect(SRC).toContain("{usage && (");
  });

  test("подпись переведена на три языка", () => {
    const n = DICT.split('"usage.title"').length - 1;
    expect(n, "подпись есть не во всех языках").toBe(3);
  });
});
