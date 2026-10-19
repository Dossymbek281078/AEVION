/*
 * 🔴 19.10.2026: баннер /qsign/verify/<id> на 390×844 рвал «ДЕЙСТВИТЕЛЬНАЯ ПОДПИСЬ»
 * посреди слов: grid «minmax(0,1fr) auto» отдавал QR 180px и оставлял заголовку 98px
 * (замер Playwright на проде 16:1x, h1.width=98). Сторож по исходнику: раскладка
 * баннера переносит QR под текст, заголовок не ужимается в колонку и не ломает слова.
 * Живой замер по 5 парам окон — после выкатки (приёмка оркестратора 16:02).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "verify", "[id]", "page.tsx"), "utf8");
const banner = src.slice(src.indexOf("background: bannerBg"), src.indexOf("{bannerCaption}"));

describe("баннер проверки подписи не рвёт слова заголовка", () => {
  test("контроль: это баннер с заголовком и подписью", () => {
    expect(banner.length).toBeGreaterThan(200);
    expect(banner).toContain("{bannerTitle}");
  });
  test("раскладка — flex с переносом, а не grid «текст | QR»", () => {
    expect(banner, "grid-колонка «minmax(0,1fr) auto» вернулась").not.toContain('gridTemplateColumns: "minmax(0,1fr) auto"');
    expect(banner).toContain('flexWrap: "wrap"');
    expect(banner, "текстовому блоку нужна нижняя граница ширины ≥ 240px").toMatch(/flex: "1 1 2[4-9]\dpx"/);
  });
  test("заголовок зависит от ширины окна и не ломает слова", () => {
    expect(banner).toMatch(/fontSize: "clamp\(\d+px, \d+(\.\d+)?vw, 30px\)"/);
    expect(banner).toContain('overflowWrap: "normal"');
  });
});
