import { describe, test, expect } from "vitest";
import { stripComments } from "./helpers/sourceCode";

/**
 * Помощник, без которого сторожа по исходникам охраняют пустоту.
 */
describe("stripComments", () => {
  test("строчный комментарий не выдаётся за код", () => {
    const src = ['const a = 1;', '// const bmi: number | null = null;'].join("\n");
    expect(src).toContain("bmi: number | null");        // так было — и сторож зеленел
    expect(stripComments(src)).not.toContain("bmi: number | null");
  });

  test("блочный комментарий тоже", () => {
    const src = "/* app.use(makeHttpErrorHandler()) */\nconst x = 1;";
    expect(stripComments(src)).not.toContain("makeHttpErrorHandler");
  });

  test("хвостовой комментарий отрезается, код остаётся", () => {
    const out = stripComments('const limit = 10; // старое: Number(q)');
    expect(out).toContain("const limit = 10;");
    expect(out).not.toContain("Number(q)");
  });

  test("контроль: настоящий код переживает обработку", () => {
    // Иначе «безопасность» съела бы и то, что сторож обязан найти.
    const code = 'if (!res.ok) {\n  setLoadError("нет");\n}';
    expect(stripComments(code)).toContain("if (!res.ok)");
    expect(stripComments(code)).toContain('setLoadError("нет")');
  });
});
