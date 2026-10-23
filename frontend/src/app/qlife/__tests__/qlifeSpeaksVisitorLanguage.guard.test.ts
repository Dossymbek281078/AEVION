import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { QLIFE_DICT, QLIFE_KEYS, tQlife } from "../i18n";

// 24.10.2026: страница QLife была смесью — заголовок по-русски, форма, тренды,
// план и ошибки по-английски при любом языке. Теперь словарь ru/en/kk.
const ROOT = join(__dirname, "..");
const files = ["page.tsx", ...readdirSync(join(ROOT, "components")).filter((f) => f.endsWith(".tsx")).map((f) => `components/${f}`)];
const код = (f: string) => readFileSync(join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const БРЕНДЫ = new Set(["QLife", "MVP", "QPersona", "HealthAI", "AEVION ·", "AEVION"]);

describe("QLife говорит на языке посетителя", () => {
  test("в разметке нет надписей-литералов (кроме названий модулей)", () => {
    const найдено: string[] = [];
    for (const f of files) {
      for (const m of код(f).matchAll(/>\s*([^<>{}]*[A-Za-zА-Яа-я]{3,}[^<>{}]*?)\s*</g)) {
        const x = m[1].trim();
        if (x && !БРЕНДЫ.has(x) && !/[;=()]/.test(x)) найдено.push(`${f}: ${x}`);
      }
      for (const m of код(f).matchAll(/setError\("[^"]+"\)/g)) найдено.push(`${f}: ${m[0]}`);
    }
    expect(найдено).toEqual([]);
  });

  test("знаменатель и ключи: ru/kk совпадают с EN, перевод не английский", () => {
    expect(QLIFE_KEYS.length).toBeGreaterThan(50);
    for (const lang of ["ru", "kk"]) {
      expect(Object.keys(QLIFE_DICT[lang]!).sort()).toEqual([...QLIFE_KEYS].sort());
      expect(tQlife(lang, "plan.submit")).not.toBe("Generate My Plan");
    }
    expect(tQlife("ru", "form.value", { unit: "kg" })).toBe("Значение (kg)");
  });
});
