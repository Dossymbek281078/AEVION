import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// Посадочная, которой нет в карте сайта и на которую не ведёт ссылка, — невидимая
// страница. Замер 19.08.2026: на /devhub/launch и /multichat-engine/launch не вела
// НИ ОДНА ссылка, и в sitemap их не было. Единственные упоминания в коде —
// собственный тест и комментарий. То есть страницы просили у людей адрес почты, а
// попасть на них было нельзя.
//
// Этот сторож проверяет класс: каждая страница вида app/**/launch/page.tsx обязана
// быть в карте сайта.

const APP = join(__dirname, "..");

function launchPages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name === "launch") {
      try {
        statSync(join(p, "page.tsx"));
        // Путь для карты сайта: от app/ и без имени файла.
        // Разделитель берём из node:path, а не пишем регуляркой: экранирование
        // обратного слэша в шаблоне уже один раз молча превратило «\» в «\»,
        // и путь windows остался неразделённым — сторож покраснел на исправном.
        out.push("/" + p.slice(APP.length + 1).split(sep).join("/"));
      } catch {
        /* каталог launch без страницы — не наш случай */
      }
    }
    launchPages(p, out);
  }
  return out;
}

describe("карта сайта покрывает посадочные запуска", () => {
  const sitemap = readFileSync(join(APP, "sitemap.ts"), "utf8");
  const pages = launchPages(APP);

  test("прибор нашёл посадочные и читает карту сайта", () => {
    // Отрицательный контроль: без него «все покрыты» могло бы означать «ни одной
    // не найдено» — самый удобный способ быть зелёным.
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages).toContain("/devhub/launch");
    expect(sitemap).toContain('path: "/launch-status"');
  });

  test("каждая посадочная перечислена в sitemap.ts", () => {
    const missing = pages.filter((p) => !sitemap.includes(`path: "${p}"`));
    expect(missing, "эти страницы не найдёт ни человек, ни поисковик").toEqual([]);
  });
});
