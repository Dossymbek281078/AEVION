import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Канонический адрес модуля должен вести на его собственную страницу.
 *
 * Общий маршрут `app/[id]` отдаёт страницу любого модуля каталога, поэтому у
 * модуля с выделенной страницей адреса два: /build и /qbuild, /bureau и
 * /aevion-ip-bureau. Какой из них считать настоящим, решает `canonical` —
 * и решает молча: ошибка здесь не роняет страницу, а лишь уводит поисковик
 * не туда.
 *
 * Две таких ошибки уже были найдены руками:
 *   - `qtradeoffline: "/qtrade"` — каноникл офлайн-платежей указывал на
 *     страницу торгового терминала, ДРУГОГО продукта;
 *   - `qbuild` отсутствовал в карте, поэтому каноникл вёл на /qbuild, хотя
 *     страница модуля — /build.
 *
 * Правило, которое проверяется: если у модуля каталога есть своя папка
 * страницы, канонический адрес обязан вести именно на неё.
 *
 * ЧЕГО ЭТОТ СТРАЖ НЕ ЛОВИТ — вторую из двух найденных ошибок в её исходном
 * виде. У QBuild страница называется /build, то есть папки с именем `qbuild`
 * нет, и «модуль забыли вписать в карту» отсюда неотличимо от «у модуля
 * просто нет выделенной страницы» (как у globus или revenue-hub, которые
 * законно живут через [id]). Связь id → чужое имя папки в коде не записана
 * нигде, кроме самой этой карты, поэтому вывести её автоматически нельзя.
 * Такие случаи по-прежнему находятся только чтением.
 */

const ROUTE_FILE = resolve(__dirname, "../page.tsx");
const CATALOG = resolve(__dirname, "../../../../../aevion-globus-backend/src/data/projects.ts");
const APP_DIR = resolve(__dirname, "../..");

function dedicatedRoutes(): Record<string, string> {
  const src = readFileSync(ROUTE_FILE, "utf8");
  const block = /const DEDICATED_ROUTES[^{]*\{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error("не нашёл DEDICATED_ROUTES в app/[id]/page.tsx");
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/"?([\w-]+)"?\s*:\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

describe("канонические адреса модулей", () => {
  it("карта маршрутов читается", () => {
    // Иначе пустая карта дала бы зелёный тест, ничего не проверив.
    expect(Object.keys(dedicatedRoutes()).length).toBeGreaterThan(3);
    expect(existsSync(CATALOG), `нет каталога: ${CATALOG}`).toBe(true);
  });

  it("каноникл ведёт на существующую страницу", () => {
    const broken = Object.entries(dedicatedRoutes())
      .filter(([, path]) => !existsSync(resolve(APP_DIR, path.slice(1), "page.tsx")))
      .map(([id, path]) => `${id} → ${path}`);

    expect(broken, "Каноникл указывает на несуществующую страницу:\n" + broken.join("\n")).toEqual(
      [],
    );
  });

  it("у модуля со своей страницей каноникл ведёт именно на неё", () => {
    // Ловит обе найденные ошибки: и отсутствие модуля в карте, и указание на
    // страницу другого продукта.
    const src = readFileSync(CATALOG, "utf8");
    const ids = [...src.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length, "каталог не разобрался").toBeGreaterThan(30);

    const routes = dedicatedRoutes();
    const wrong: string[] = [];
    for (const id of ids) {
      const ownPage = existsSync(resolve(APP_DIR, id, "page.tsx"));
      if (!ownPage) continue; // страницу отдаёт [id] — каноникл по умолчанию верен
      const expected = `/${id}`;
      const actual = routes[id] ?? expected;
      if (actual !== expected) wrong.push(`${id}: каноникл ${actual}, а страница ${expected}`);
    }

    expect(wrong, "Каноникл уводит с собственной страницы модуля:\n" + wrong.join("\n")).toEqual(
      [],
    );
  });
});
