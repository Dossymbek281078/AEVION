import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Пустой каталог при живой базе — ответ. Пустой при упавшей — отказ.
 *
 * Страницы читали `data.products || []` и `data.courses || []` БЕЗ проверки
 * res.ok, а qlearn вдобавок делал `catch { setCourses([]) }`. Обе ветки вели к
 * одному экрану: «No products yet · Be the first to list one!».
 *
 * С 21.08.2026 бэкенд отвечает 503 и объяснением вместо пустого списка — но до
 * этой правки витрина превращала его обратно в пустоту. Правда доезжала до
 * границы API и там останавливалась; за это окно так случилось трижды.
 *
 * Тест по исходникам намеренно: он должен краснеть при правке страницы, даже
 * если сборка в этот прогон не запускалась.
 */

const ROOT = join(__dirname, "..");

const PAGES: Array<[string, string, string]> = [
  ["QStore", "qstore/page.tsx", "products"],
  ["QLearn", "qlearn/page.tsx", "courses"],
];

describe("сбой загрузки не выдаётся за пустой каталог", () => {
  test("контроль: файлы читаются и это те самые страницы", () => {
    for (const [, file, key] of PAGES) {
      const src = readFileSync(join(ROOT, file), "utf8");
      expect(src.length).toBeGreaterThan(2000);
      expect(src).toContain(`${key}.length === 0`);
    }
  });

  test.each(PAGES)("%s проверяет res.ok, а не только тело", (_n, file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(src, "ответ разбирается без проверки кода — 503 станет пустым списком").toMatch(
      /if\s*\(!res\.ok\)/,
    );
  });

  test.each(PAGES)("%s держит отдельное состояние отказа", (_n, file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(src, "нет состояния loadError").toMatch(/loadError/);
    expect(src, "отказ не отрисован как отдельная ветка").toMatch(/loadError\s*\?\s*\(/);
    expect(src, "нет видимой плашки с role=alert").toMatch(/role="alert"/);
  });

  test.each(PAGES)("%s показывает текст сервера, если он пришёл", (_n, file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    // Свой текст — запасной; объяснение сервера точнее и меняется без правки
    // страницы.
    expect(src).toMatch(/data\?\.warning/);
  });
});
