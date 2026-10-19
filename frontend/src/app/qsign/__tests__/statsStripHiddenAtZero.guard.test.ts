/*
 * 🔴 19.10.2026: полоса счётчиков QSign не рисуется при нуле подписей.
 * Повод: после фильтра проб на бэке настоящих подписей 0 из 54 (прод-база 19.10),
 * и старая полоса показала бы гостю «0 подписей · 0 издателей · 0 стран».
 * Проверка исходника: условие стоит именно на total > 0, а не только на наличии ответа.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("полоса счётчиков QSign при нуле", () => {
  test("контроль: это страница QSign и полоса в ней есть", () => {
    expect(src).toContain("/api/qsign/v2/stats");
    expect(src).toContain('label="Signatures anchored"');
  });
  test("полоса под условием total > 0, а не просто «stats пришёл»", () => {
    expect(src.includes("{stats && stats.signatures.total > 0 ? ("), "полоса рисуется при нуле").toBe(true);
    expect(/\{stats \? \(\s*<div[\s\S]{0,400}StatCard/.test(src), "осталось условие только на наличие stats").toBe(false);
  });
});
