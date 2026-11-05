import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QNEWS_DICT, QNEWS_KEYS, tQnews, articlesCount } from "./i18n";

// 05.11.2026: QNews смешивал языки — категории и «Trending Now» по-английски, шапка и форма по-русски.
const читать = (f: string) => readFileSync(join(__dirname, f), "utf8");
const код = читать("page.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("QNews говорит на языке посетителя", () => {
  test("в разметке нет английских и русских надписей-литералов", () => {
    const текст = [...код.matchAll(/>\s*([^<>{}]*[A-Za-zА-Яа-я]{3,}[^<>{}]*?)\s*</g)]
      .map((m) => m[1].trim())
      .filter((x) => x && x !== "QNews" && !/[;=()]/.test(x));
    expect(текст).toEqual([]);
    expect(код).not.toMatch(/(placeholder|title|aria-label)="[^"]*[A-Za-zА-Яа-я]{3}/);
    expect(код).not.toMatch(/setSubmitMsg\("[^"]*[A-Za-zА-Яа-я]{3}/);
    expect(код).not.toMatch(/label: "[^"]*[A-Za-zА-Яа-я]{3}/);
  });
  test("у ru и kk тот же набор ключей, значения не английские", () => {
    expect(QNEWS_KEYS.length, "знаменатель").toBeGreaterThan(55);
    for (const lang of ["ru", "kk"]) {
      const d = QNEWS_DICT[lang]!;
      expect(Object.keys(d).sort()).toEqual([...QNEWS_KEYS].sort());
      for (const k of ["cat.crypto", "cat.business", "cat.science", "cat.world", "trending", "loading", "card.readOriginal"] as const) {
        expect(tQnews(lang, k), `${lang}:${k}`).not.toBe(tQnews("en", k));
        expect(tQnews(lang, k), `${lang}:${k}`).toMatch(/[А-Яа-яӘәҒғҚқҢңӨөҰұҮүІіҺһ]/);
      }
    }
  });
  test("числительные статей: ru статья/статьи/статей", () => {
    expect([1, 2, 5, 11, 21].map((n) => articlesCount("ru", n))).toEqual(["1 статья", "2 статьи", "5 статей", "11 статей", "21 статья"]);
    expect(articlesCount("en", 1)).toBe("1 article");
  });
});
