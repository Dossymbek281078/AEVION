import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QSTORE_DICT, QSTORE_KEYS, tQstore, pluralForm } from "./i18n";

// 05.11.2026: на ru/kk весь интерфейс QStore был английским («+ List a product», «Sort by», «No products yet»).
const читать = (f: string) => readFileSync(join(__dirname, f), "utf8");
const без = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const ФАЙЛЫ = ["page.tsx", "[id]/page.tsx", "QStoreNotify.tsx"];

describe("QStore говорит на языке посетителя", () => {
  for (const f of ФАЙЛЫ) {
    test(`${f}: в разметке нет английских и русских надписей-литералов`, () => {
      // placeholder="you@example.com" — пример адреса, не слово языка; оставлен сознательно.
      const код = без(читать(f)).replace('placeholder="you@example.com"', "");
      const текст = [...код.matchAll(/>\s*([^<>{}]*[A-Za-zА-Яа-я]{3,}[^<>{}]*?)\s*</g)]
        .map((m) => m[1].trim())
        .filter((x) => x && x.replace(/^←\s*/, "") !== "QStore" && !/[;=()]/.test(x));
      expect(текст).toEqual([]);
      expect(код).not.toMatch(/(placeholder|title|aria-label)="[^"]*[A-Za-zА-Яа-я]{3}/);
      expect(код).not.toMatch(/set(Notice|FormError|Msg)\("[^"]*[A-Za-zА-Яа-я]{3}/);
    });
  }
  test("даты — из локали посетителя", () => {
    expect(читать("[id]/page.tsx")).not.toMatch(/toLocaleDateString\(\)/);
  });
  test("у ru и kk тот же набор ключей, значения не английские", () => {
    expect(QSTORE_KEYS.length, "знаменатель").toBeGreaterThan(80);
    for (const lang of ["ru", "kk"]) {
      const d = QSTORE_DICT[lang]!;
      expect(Object.keys(d).sort()).toEqual([...QSTORE_KEYS].sort());
      for (const k of ["hero.list", "sort.label", "empty.h", "paySoon", "loading", "d.leave"] as const) {
        expect(tQstore(lang, k), `${lang}:${k}`).not.toBe(tQstore("en", k));
        expect(tQstore(lang, k), `${lang}:${k}`).toMatch(/[А-Яа-яӘәҒғҚқҢңӨөҰұҮүІіҺһ]/);
      }
    }
  });
  test("числительные: ru товар/товара/товаров, en один/много", () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => pluralForm("ru", n))).toEqual(["one", "few", "many", "many", "one", "few", "many"]);
    expect([1, 2].map((n) => pluralForm("en", n))).toEqual(["one", "many"]);
  });
});
