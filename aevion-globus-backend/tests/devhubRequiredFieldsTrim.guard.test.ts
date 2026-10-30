// Обязательные строковые поля DevHub проверяются ПОСЛЕ trim: пробелы — отказ.
// 30.10.2026: name из пробелов давал проект без имени (поведенческий тест рядом —
// devhubProjectNameNotBlank); тот же класс стоял у prompt (платный вызов ИИ с
// «ничем»), title GitHub-репо, key env-переменной, title сниппета. Сторож ИСХОДНИКА.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");

describe("required-проверки DevHub учитывают trim", () => {
  it("ни одна проверка «X is required» не стоит без trim в условии", () => {
    const lines = src.split("\n");
    const плохие: string[] = [];
    lines.forEach((l, i) => {
      if (!/is required"/.test(l)) return;
      // условие — на этой же строке (однострочник) или на 1–2 строках выше
      const окно = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
      // условие целиком до «) {» или «) return» — внутри него может стоять .trim()
      // с собственными скобками, поэтому не [^)]*
      const m = окно.match(/if \(!(\w+) \|\| typeof \1 !== "string"(.*?)\)\s*(\{|return)/s);
      if (!m) return; // другая форма проверки — не этот класс
      if (!new RegExp(`${m[1]}\\.trim\\(\\)`).test(m[2])) плохие.push(`${i + 1}: ${l.trim()}`);
    });
    expect(плохие, "проверки без trim").toEqual([]);
  });
});
