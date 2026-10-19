/**
 * 🔴 19.10.2026 — бренд бюро на странице проверки (обещано письмами WPK и Central
 * Illustration Agency). Строка «Запись сделана через <Бюро> · проверку обеспечивает
 * AEVION» рисуется ТОЛЬКО при заполненном поле partner; без партнёра страница — как
 * прежде (ни пустой строки, ни «undefined»).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");

describe("бренд бюро на /verify (19.10.2026)", () => {
  it("тип ответа знает поле partner", () => {
    expect(SRC).toContain("partner?: string | null;");
  });
  it("строка партнёра рисуется только при заполненном поле и несёт обе подписи", () => {
    expect(SRC).toContain("{cert.partner ? (");
    expect(SRC).toContain('data-testid="cert-partner"');
    expect(SRC).toContain("Запись сделана через {cert.partner} · проверку обеспечивает AEVION");
    expect(SRC).toContain("Record made via {cert.partner} · verification by AEVION");
  });
  it("без партнёра — ничего: ветка null, не пустой div и не «undefined»", () => {
    const i = SRC.indexOf("{cert.partner ? (");
    const block = SRC.slice(i, i + 800);
    expect(block).toMatch(/\) : null\}/);
    expect(block).not.toContain("undefined");
  });
  it("строка стоит в шапке карточки сразу под названием записи — видна без прокрутки", () => {
    const title = SRC.indexOf("{cert.title}</div>");
    const partner = SRC.indexOf('data-testid="cert-partner"');
    expect(title).toBeGreaterThan(0);
    expect(partner).toBeGreaterThan(title);
    expect(partner - title, "строка партнёра ушла далеко от названия").toBeLessThan(600);
  });
});
