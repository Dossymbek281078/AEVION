import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUREAU_TEXT, tBureau } from "../bureauText";

// 24.10.2026, прод /bureau на ru: 31 из 138 строк по-английски — статистика,
// «How AEVION IP Bureau Works», уровни, реестр, правовая база и оговорка.
// Переведён был только первый экран. Теперь строки идут через tb("…").
const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const body = SRC.slice(SRC.indexOf("function BureauPageInner()"));
const код = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// Названия уровней — не переводятся (так и на ru-витрине); бренды и форматы.
const ОСТАВИТЬ = new Set(["Verified", "Notarized", "📄 PDF", "AEC", "QR"]);

describe("страница бюро говорит на языке посетителя", () => {
  test("у каждого tb(\"…\") есть перевод ru и kk", () => {
    const ключи = [...код.matchAll(/tb\("((?:[^"\\]|\\.)*)"\)/g)].map((m) => m[1].replace(/\\"/g, '"'));
    expect(ключи.length, "знаменатель: строк через tb").toBeGreaterThan(80);
    const без = ключи.filter((k) => !BUREAU_TEXT[k]?.ru || !BUREAU_TEXT[k]?.kk);
    expect(без).toEqual([]);
  });
  test("в разметке компонента нет английских надписей-литералов", () => {
    const текст = [...код.matchAll(/>\s*([^<>{}]*[A-Za-z]{3,}[^<>{}]*?)\s*</g)]
      .map((m) => m[1].trim())
      .filter((x) => x && !ОСТАВИТЬ.has(x) && !/[;=()]/.test(x) && !/[А-Яа-яЁё]/.test(x));
    expect(текст).toEqual([]);
  });
  test("en — исходник как есть, ru/kk — перевод; правовая оговорка переведена", () => {
    expect(tBureau("en", "Legal Disclaimer")).toBe("Legal Disclaimer");
    expect(tBureau("ru", "Legal Disclaimer")).toBe("Правовая оговорка");
    expect(tBureau("kk", "How AEVION IP Bureau Works")).not.toBe("How AEVION IP Bureau Works");
    // формат «А / Б» нужен фильтру видов (берёт часть до « / »)
    for (const k of ["Music / Audio", "Code / Software"]) expect(tBureau("ru", k)).toContain(" / ");
  });
});
