import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 2.11.2026 (прод a9dd00658, curl): после DELETE заявки API отвечал 404, а страница
 * /startup-exchange/<id> ещё до часа отдавала 200 со старым названием и описанием —
 * решение «есть ли заявка» и превью брали ответ бэкенда из кэша на 3600 с.
 */
const ИСХОДНИК = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "[id]", "layout.tsx"), "utf8");

describe("снятая заявка: страница не живёт из кэша", () => {
  it("проверка существования в макете — без кэша", () => {
    const макет = ИСХОДНИК.slice(ИСХОДНИК.indexOf("export default async function ListingLayout"));
    expect(макет).toMatch(/cache:\s*"no-store"/);
    expect(макет).not.toMatch(/revalidate/);
  });

  it("превью кэшируется не дольше минуты", () => {
    const сроки = [...ИСХОДНИК.matchAll(/revalidate:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(сроки.length).toBeGreaterThan(0);
    for (const с of сроки) expect(с).toBeLessThanOrEqual(60);
  });
});
