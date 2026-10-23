import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SHELL_DICT, SHELL_KEYS, tShell } from "../buildShellI18n";

// 24.10.2026, прод 390: меню QBuild — «Menu», «Projects», «Vacancies»,
// «Success Stories», «Why us» по-английски рядом с «Тарифы». В BuildShell не
// было ни одного вызова перевода; русское давал только живой слой перевода.
const SRC = readFileSync(join(__dirname, "..", "BuildShell.tsx"), "utf8");
const код = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("оболочка QBuild говорит на языке посетителя", () => {
  test("пункты меню и нижней панели — ключи словаря", () => {
    const подписи = [...код.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    expect(подписи.length, "знаменатель").toBeGreaterThan(25);
    expect(подписи.filter((x) => !/^(nav|tab)\./.test(x))).toEqual([]);
  });
  test("в разметке нет английских надписей и подписей кнопок (кроме бренда)", () => {
    const текст = [...код.matchAll(/>\s*([^<>{}]*[A-Za-z]{3,}[^<>{}]*?)\s*</g)].map((m) => m[1].trim()).filter((x) => x && !/QBuild/.test(x) && !/[;=()]/.test(x));
    expect(текст).toEqual([]);
    expect(код).not.toMatch(/(aria-label|title|placeholder)="[A-Za-z]/);
  });
  test("ru и kk — тот же набор ключей, перевод не английский", () => {
    for (const lang of ["ru", "kk"]) {
      expect(Object.keys(SHELL_DICT[lang]!).sort()).toEqual([...SHELL_KEYS].sort());
      expect(tShell(lang, "nav.projects")).not.toBe("Projects");
    }
    expect(tShell("ru", "notif.new", { n: 3 })).toBe("Новых уведомлений: 3");
  });
});
