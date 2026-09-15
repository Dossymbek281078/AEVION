/**
 * Маршруты DevHub, которые ПИШУТ DNS, требуют входа, а запись customDomain
 * проверяет имя внутри нашей зоны. Проверка по исходнику: сами маршруты
 * тянут базу и внешние ключи, а здесь важен факт наличия проверки в КАЖДОМ
 * из трёх мест — забыть одно и дыра 15.09.2026 вернётся.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.resolve(__dirname, "../src/routes/devhub.ts"), "utf8");

function handler(route: string): string {
  const i = src.indexOf(`devhubRouter.post("${route}"`) >= 0 ? src.indexOf(`devhubRouter.post("${route}"`) : src.indexOf(`devhubRouter.patch("${route}"`);
  expect(i, `маршрут ${route} не найден`).toBeGreaterThan(-1);
  return src.slice(i, i + 1600);
}

describe("DNS-маршруты DevHub", () => {
  for (const route of ["/projects/:id/domain/auto-setup", "/projects/:id/domain/setup"]) {
    it(`${route}: без входа — 401, и это стоит раньше чтения проекта`, () => {
      const h = handler(route);
      const iAuth = h.indexOf("if (!auth?.sub) return res.status(401)");
      const iRead = h.indexOf("readProject(");
      expect(iAuth, "нет проверки входа").toBeGreaterThan(-1);
      expect(iRead).toBeGreaterThan(-1);
      expect(iAuth, "проверка входа должна стоять раньше чтения проекта").toBeLessThan(iRead);
    });
  }
  it("auto-setup не трогает имена внутри нашей зоны", () => {
    expect(handler("/projects/:id/domain/auto-setup")).toContain("labelInZone(project.customDomain) !== null");
  });
  for (const route of ["/projects/:id", "/projects/:id/domain"]) {
    it(`${route}: customDomain внутри зоны проходит через zoneWriteRefusal`, () => {
      expect(handler(route)).toContain("zoneWriteRefusal(");
    });
  }
});
