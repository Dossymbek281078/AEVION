import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Четвёртый срез того же вопроса, что и `testsActuallyRun` / `ciStepsResolve`:
// объявленное и действительное разошлись молча.
//
// 10.08.2026: роутер QSkyway отдаёт 14 путей, `/api/openapi.json` описывал 13.
// Не хватало ровно `/airspace/impact` — эндпоинта, откуда интерфейс берёт цифру
// влияния («столько-то маршрутов из 42 укладывается в опубликованный потолок»).
// Он появился позже остальных, и его просто не дописали в спеку.
//
// Для модуля, который продаёт проверяемость, это дороже обычного пропуска в
// документации: спека — то, по чему внешний человек решает, что у нас есть.
// Эндпоинт, которого в ней нет, для него не существует.
//
// Тест читает ИСХОДНИКИ, а не поднятый сервер: цель — поймать расхождение в
// CI-прогоне бэкенда, где сервера нет.

const SRC = path.join(__dirname, "..", "src");

const routerSrc = fs.readFileSync(path.join(SRC, "routes", "qskyway.ts"), "utf8");
const specSrc = fs.readFileSync(path.join(SRC, "lib", "openapiSpec.ts"), "utf8");

/**
 * Express и OpenAPI пишут параметр по-разному: `/slots/:id/verify` против
 * `/slots/{id}/verify`. Сводим к одной форме, иначе первый же параметрический
 * путь выглядит одновременно «не описанным» и «лишним» — тест краснеет дважды
 * на одном и том же эндпоинте и не говорит правды ни в одном из двух случаев.
 */
const normalize = (p: string): string => p.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

/** Пути, объявленные роутером, в форме `/cities`, `/airspace/impact`. */
function routerPaths(): string[] {
  const out = new Set<string>();
  for (const m of routerSrc.matchAll(/qskywayRouter\.(?:get|post|put|delete)\(\s*"([^"]+)"/g)) {
    out.add(normalize(m[1]));
  }
  return [...out].sort();
}

/** Пути QSkyway, описанные в openapi, в той же форме. */
function documentedPaths(): string[] {
  const out = new Set<string>();
  for (const m of specSrc.matchAll(/"\/api\/qskyway([^"]*)"/g)) {
    out.add(m[1] === "" ? "/" : m[1]);
  }
  return [...out].sort();
}

describe("публичный контракт QSkyway описан целиком", () => {
  it("роутер вообще разбирается — иначе тест прошёл бы вхолостую", () => {
    expect(routerPaths().length).toBeGreaterThan(5);
    expect(documentedPaths().length).toBeGreaterThan(5);
  });

  it("каждый путь роутера есть в /api/openapi.json", () => {
    const documented = new Set(documentedPaths());
    const missing = routerPaths().filter((p) => !documented.has(p));
    expect(missing, `не описаны в openapi: ${missing.join(", ")}`).toEqual([]);
  });

  it("openapi не описывает путей, которых роутер не отдаёт", () => {
    // Обратная сторона: описанный, но снесённый эндпоинт — обещание 404.
    const declared = new Set(routerPaths());
    const phantom = documentedPaths().filter((p) => !declared.has(p));
    expect(phantom, `описаны, но роутер их не отдаёт: ${phantom.join(", ")}`).toEqual([]);
  });
});
