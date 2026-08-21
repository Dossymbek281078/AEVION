import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { stripComments } from "./helpers/sourceCode";
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
      const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
      expect(src.length).toBeGreaterThan(2000);
      expect(src).toContain(`${key}.length === 0`);
    }
  });

  test.each(PAGES)("%s проверяет res.ok ИМЕННО в загрузке каталога", (_n, file, key) => {
    // Привязка к нужному месту, а не «есть где-то в файле».
    //
    // Первая версия искала `if (!res.ok)` по всему исходнику — и осталась
    // зелёной, когда я в порядке мутации закомментировал проверку в загрузке
    // каталога: в файле нашлось ДРУГОЕ вхождение, из формы создания товара.
    // Совпадение было настоящим, но не тем.
    const lines = stripComments(readFileSync(join(ROOT, file), "utf8")).split(
      String.fromCharCode(10),
    );
    const i = lines.findIndex((l) => l.includes(`/api/${file.split("/")[0]}/${key}`));
    expect(i, "запрос каталога не найден — проверка была бы ни о чём").toBeGreaterThan(-1);
    const block = lines.slice(i, i + 22).join(String.fromCharCode(10));
    expect(block, "код ответа не проверяется — 503 станет пустым списком").toMatch(
      /if\s*\(!res\.ok\)/,
    );
    expect(block, "отказ не попадает в состояние — экран промолчит").toMatch(/setLoadError/);
  });

  test.each(PAGES)("%s держит отдельное состояние отказа", (_n, file) => {
    const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
    expect(src, "нет состояния loadError").toMatch(/loadError/);
    expect(src, "отказ не отрисован как отдельная ветка").toMatch(/loadError\s*\?\s*\(/);
    expect(src, "нет видимой плашки с role=alert").toMatch(/role="alert"/);
  });

  test.each(PAGES)("%s показывает текст сервера, если он пришёл", (_n, file) => {
    const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
    // Свой текст — запасной; объяснение сервера точнее и меняется без правки
    // страницы.
    expect(src).toMatch(/data\?\.warning/);
  });
});
