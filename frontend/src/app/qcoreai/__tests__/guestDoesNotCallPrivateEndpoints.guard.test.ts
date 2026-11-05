import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Гость /qcoreai/multi без входа получал 401 на /me/personas, /templates и
 * presence/ping каждые 20 с (замер Продаж, Playwright 4.11.2026) — человеку не
 * видно, но шум в журнале и лишние запросы. Без токена эти ручки не зовём.
 */
const page = fs.readFileSync(path.join(__dirname, "../multi/page.tsx"), "utf8");

describe("гость без токена не зовёт личные ручки", () => {
  test("есть hasAuthToken и он стоит перед personas, templates и presence ping", () => {
    expect(page).toMatch(/function hasAuthToken\(\): boolean/);
    expect(page).toMatch(/if \(!activeSessionId \|\| !hasAuthToken\(\)\) \{ setPresenceCount\(0\); return; \}/);
    expect(page).toMatch(/if \(hasAuthToken\(\)\) try \{\s*const pRes = await fetch\(apiUrl\("\/api\/qcoreai\/me\/personas"\)/);
    expect(page).toMatch(/hasAuthToken\(\) \? fetch\(apiUrl\("\/api\/qcoreai\/templates"\)/);
  });
  test("публичные шаблоны гостю по-прежнему грузятся", () => {
    expect(page).toMatch(/fetch\(apiUrl\("\/api\/qcoreai\/templates\/public\?limit=20"\)\)/);
  });
});
