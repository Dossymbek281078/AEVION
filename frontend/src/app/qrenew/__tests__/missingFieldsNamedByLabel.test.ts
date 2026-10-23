import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 24.10.2026, прод: пустая форма → 400 и «Не хватает показателей: albumin,
// creatinine, glucose, crp, lymphocytePct…» — имена из кода вместо подписей.
// И подсказка «40» в пустом поле читалась как уже введённое значение.
const src = readFileSync(join(__dirname, "..", "_client.tsx"), "utf8");

describe("форма биовозраста говорит словами человека", () => {
  test("недостающие показатели называются подписями полей", () => {
    expect(src).toContain("BIO_FIELDS.find((f) => f.key === k)?.label");
    expect(src).toMatch(/data\.missing as string\[\]\)\.map\(подпись\)/);
  });
  test("подсказка в поле — пример, а не значение", () => {
    expect(src).toContain("placeholder={`напр. ${f.placeholder}`}");
  });
});
