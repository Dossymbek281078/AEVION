import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Универсальный поиск (`/api/search`) собирает ссылку на каждый результат сам —
 * и до 27.07.2026 пять источников из шести вели на несуществующие маршруты
 * (`/qlearn/courses/<id>`, `/qnews/<id>`, `/qevents/<id>`, `/qjobs/<id>`,
 * `/qright/<id>` — все 404 на проде). Заметить это было некому: ни одна страница
 * фронта поиск не вызывала, так что мёртвые ссылки никто не открывал.
 *
 * Сторож держит инвариант «каждая ссылка из выдачи ведёт на существующую
 * страницу»: разбирает шаблоны адресов прямо из роутера поиска и требует, чтобы
 * под каждый нашёлся файл маршрута в `app/`. Статический — падает в CI до того,
 * как читатель кликнет.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEARCH_ROUTER = join(APP_DIR, "..", "..", "..", "aevion-globus-backend", "src", "routes", "search.ts");

/** `/qstore/${row.id}` → `/qstore/:id`; `/qlearn?course=${x}` → `/qlearn` */
function normalize(template: string): string {
  return template
    .split("?")[0]
    .replace(/\$\{[^}]*\}/g, ":param")
    .replace(/\/+$/, "");
}

/** Есть ли в app/ маршрут под такой путь (динамический сегмент = любая [..] папка). */
function routeExists(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  let dir = APP_DIR;
  for (const seg of segments) {
    if (seg === ":param") {
      // единственный динамический сегмент в AEVION — [id]; проверяем именно его
      const dyn = join(dir, "[id]");
      if (!existsSync(dyn)) return false;
      dir = dyn;
      continue;
    }
    const next = join(dir, seg);
    if (!existsSync(next)) return false;
    dir = next;
  }
  return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"));
}

describe("ссылки из универсального поиска ведут на существующие страницы", () => {
  const src = readFileSync(SEARCH_ROUTER, "utf8");

  // Контроль инструмента: если роутер переписали и шаблоны перестали находиться,
  // тест обязан упасть, а не молча пройти на пустом списке.
  const templates = [...src.matchAll(/url:\s*`([^`]+)`/g)].map((m) => m[1]);
  const internal = [...src.matchAll(/return\s+`(\/[^`]+)`/g)].map((m) => m[1]);
  const all = [...new Set([...templates, ...internal])].filter((u) => u.startsWith("/"));

  it("шаблоны адресов вообще найдены в роутере поиска", () => {
    expect(all.length).toBeGreaterThanOrEqual(6);
  });

  for (const template of all) {
    it(`${template} → маршрут существует`, () => {
      const path = normalize(template);
      expect(routeExists(path), `нет страницы под ${path} (шаблон ${template})`).toBe(true);
    });
  }
});
