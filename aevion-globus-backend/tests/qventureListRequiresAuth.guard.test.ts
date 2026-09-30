import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Список разборов QVenture закрыт входом, а поштучный — открыт.
 *
 * Замер 30.09.2026: GET /api/qventure/analyses отдавал любому желающему 50
 * последних разборов с названием компании, отраслью, стадией и оценкой. Это
 * чужие сделки: человек разбирал свою заявку, а её видел кто угодно. Наши
 * пробы в той же выдаче (11 «Smoke Ledger» и 3 «Probe Co») были меньшей бедой.
 *
 * Сторож держит ОБЕ стороны, и вторая здесь не формальность:
 *  • список обязан требовать вход — иначе утечка возвращается;
 *  • поштучный /analyses/:id обязан ОСТАВАТЬСЯ открытым — на нём держится
 *    страница общего доступа /qventure/a/[id]. Закрыть его «заодно» значит
 *    сломать то, ради чего человек делится своим разбором по ссылке.
 *
 * Проверяем исходник, а не живой сервер: тест должен работать в CI без базы.
 */
const файл = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/routes/qventure.ts",
);
const исходник = readFileSync(файл, "utf8");

describe("QVenture: список закрыт, поштучный открыт", () => {
  it("GET /analyses требует вход", () => {
    const список = исходник.match(/qventureRouter\.get\(\s*"\/analyses"\s*,([^)]*)/);
    expect(список, "роут GET /analyses не найден — он переименован или удалён").not.toBeNull();
    expect(список![1]).toContain("requireAuth");
  });

  it("requireAuth действительно ввезён в файл, а не написан строкой", () => {
    expect(исходник).toMatch(/import\s*\{[^}]*requireAuth[^}]*\}\s*from\s*"\.\.\/lib\/authJwt"/);
  });

  it("поштучный GET /analyses/:id остаётся открытым", () => {
    const один = исходник.match(/qventureRouter\.get\(\s*"\/analyses\/:id"\s*,([^)]*)/);
    expect(один, "роут GET /analyses/:id не найден").not.toBeNull();
    expect(один![1]).not.toContain("requireAuth");
  });

  it("витрина /examples остаётся открытой — её показывает публичная страница", () => {
    const примеры = исходник.match(/qventureRouter\.get\(\s*"\/examples"\s*,([^)]*)/);
    expect(примеры, "роут GET /examples не найден").not.toBeNull();
    expect(примеры![1]).not.toContain("requireAuth");
  });
});
