import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Поведение проверки живёт в tests/staticServable.test.ts (мутация в
 * можноСлужитьСтатикой() валит 4 теста из 7 — проверено 28.09.2026).
 * Здесь остаётся ОДНО: маршрут публикации не отвязали от этой функции.
 * Такой сторож по тексту слаб сам по себе, поэтому он и не единственный.
 */
const маршрут = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");

describe("публикация в Pages привязана к проверенной проверке статики", () => {
  it("маршрут импортирует можноСлужитьСтатикой", () => {
    expect(маршрут).toContain('from "../lib/staticServable"');
    expect(маршрут).toContain("можноСлужитьСтатикой(");
  });

  it("отказ выдаёт 409, а не молчаливый успех", () => {
    const i = маршрут.indexOf("можноСлужитьСтатикой(путиФайлов)");
    expect(i).toBeGreaterThan(0);
    const блок = маршрут.slice(i, i + 1600);
    expect(блок).toContain("status(409)");
    expect(блок).toContain("project is not static");
  });

  it("отказ случается ДО загрузки в Cloudflare", () => {
    const iПроверка = маршрут.indexOf("можноСлужитьСтатикой(путиФайлов)");
    const iЗагрузка = маршрут.indexOf("deployViaWrangler(", iПроверка);
    expect(iПроверка).toBeGreaterThan(0);
    expect(iЗагрузка).toBeGreaterThan(iПроверка);
  });
});
