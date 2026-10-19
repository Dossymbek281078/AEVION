/**
 * 🔴 19.10.2026 — Constitution «оплата → доступ»: railway run constitution-e2e показал, что
 * покупка плана делает /api/constitution/me/plan = pro (лимиты сняты, чистый PDF), а страница
 * /constitution звала план, PDF и ИИ-подсказку БЕЗ Authorization — подписчик в браузере
 * выглядел free (тот же класс, что DevHub 21:5x). Все три запроса обязаны нести вход.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("запросы Конституции несут вход", () => {
  it("план, PDF и ИИ-подсказка идут с getAuthHeaders()", () => {
    expect(SRC).toMatch(/import \{[^}]*getAuthHeaders[^}]*\} from "@\/lib\/auth";/);
    expect(SRC).toContain('fetch("/api-backend/api/constitution/me/plan", { headers: getAuthHeaders() })');
    for (const path of ["/api-backend/api/constitution/pdf", "/api-backend/api/constitution/ai-suggest-stream"]) {
      const i = SRC.indexOf(`fetch("${path}"`);
      expect(i, path).toBeGreaterThan(0);
      expect(SRC.slice(i, i + 200), `${path} без входа`).toContain('headers: { "Content-Type": "application/json", ...getAuthHeaders() }');
    }
  });
  it("контроль: ни одного запроса к бэкенду Конституции без заголовков входа не осталось", () => {
    const calls = [...SRC.matchAll(/fetch\("\/api-backend\/api\/constitution[^"]*"(,\s*\{[^}]*)?/g)];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const c of calls) expect(c[0], c[0].slice(0, 80)).toContain("getAuthHeaders()");
  });
});
