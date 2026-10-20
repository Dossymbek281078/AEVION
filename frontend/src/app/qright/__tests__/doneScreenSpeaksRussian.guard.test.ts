import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tq } from "../qrightI18n";

/**
 * 20.10.2026, окно «Приложения», по слову оркестратора («путь лида бюро»). Замер на проде
 * cde01b698 10:5x: экран «готово» после регистрации при ru-RU нёс 122 английских слова —
 * подписи сертификата (AUTHOR, TYPE, Content Hash…), вид работы без словаря, строка
 * «4-layer protection active» и два длинных пояснения литералами. Сторож: в блоке done нет
 * английских текстовых узлов и литералов-подписей, каждый ключ tq блока есть в RU.
 */
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const DICT = readFileSync(join(__dirname, "..", "qrightI18n.ts"), "utf8");
const START = PAGE.indexOf('{step === "done" && result && (');
const END = PAGE.indexOf("{/* ── Registry toggle ── */}", START);
const BLOCK = PAGE.slice(START, END > START ? END : START + 24000); // блок done ≈ 20,7 тыс. знаков (20.10)

const LATIN_OK = new Set(["aevion", "hmac", "sha", "ed25519", "shamir", "qright", "json", "pdf", "id", "quantum", "shield", "svg", "png", "url"]);
function englishWords(s: string): string[] {
  return [...s.matchAll(/[A-Za-z][A-Za-z’']{2,}/g)].map((m) => m[0]).filter((w) => !LATIN_OK.has(w.toLowerCase().replace(/[’']/g, "")));
}
function jsxTextNodes(src: string): string[] {
  const s = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  // пути вида «/verify-offline» — адреса, не фразы
  for (const m of s.matchAll(/>([^<]*)</g)) { const span = m[1]; if (/[{}=;]/.test(span)) continue; const t = span.replace(/\s+/g, " ").trim(); if (t && !t.startsWith("/") && englishWords(t).length) out.push(t); }
  return out;
}

describe("экран «готово» QRight говорит по-русски при ru", () => {
  test("блок done найден", () => { expect(START).toBeGreaterThan(0); });

  test("в блоке нет английских текстовых узлов", () => {
    expect(jsxTextNodes(BLOCK)).toEqual([]);
  });

  test("нет литералов-подписей и тернарных английских строк", () => {
    const labels = [...BLOCK.matchAll(/label:\s*"([^"]*)"/g)].map((m) => m[1]).filter((t) => englishWords(t).length);
    expect(labels).toEqual([]);
    const ternary = [...BLOCK.matchAll(/\?\s*"([^"]{6,})"\s*:\s*"/g)].map((m) => m[1]).filter((t) => englishWords(t).length);
    expect(ternary).toEqual([]);
    expect(BLOCK).not.toMatch(/[?:]\s*"Each layer detects a different attack/);
    expect(BLOCK).toContain('tq(lang, "Each layer detects a different attack');
  });

  test("каждый ключ tq блока переведён на русский", () => {
    const keys = [...new Set([...BLOCK.matchAll(/tq\(lang,\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThanOrEqual(30);
    const missing = keys.filter((k) => tq("ru", k) === k);
    expect(missing).toEqual([]);
    expect(DICT).toContain('"AUTHOR": "АВТОР"');
  });

  test("кнопка «Upgrade to Verified» на экране «готово» — через словарь (ru и kk)", () => {
    // 20.10 12:4x, замер Продукта на проде: «Verified»×2 оставались английскими при ru
    expect(BLOCK).toContain('{tq(lang, "⭐ Upgrade to Verified")}');
    expect(BLOCK).not.toMatch(/>\s*⭐ Upgrade to Verified \(/);
    expect(tq("ru", "⭐ Upgrade to Verified")).not.toBe("⭐ Upgrade to Verified");
    expect(tq("kk", "⭐ Upgrade to Verified")).not.toBe("⭐ Upgrade to Verified");
  });

  test("вид работы в сертификате — через словарь", () => {
    expect(BLOCK).toContain("tq(lang, KIND_OPTIONS.find((k) => k.value === result.certificate.kind)?.label || result.certificate.kind)");
    expect(tq("ru", "Music / Audio")).not.toBe("Music / Audio");
  });

  test("контроль: детектор видит английский узел", () => {
    expect(jsxTextNodes('<div>{tq(lang, "x")}</div><b>Certificate ID</b>')).toEqual(["Certificate ID"]);
  });
});
