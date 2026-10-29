import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { редиректПоПараметруЯзыка as f } from "../middleware";

/**
 * Замер 29.10.2026: /cyberchess?lang=en отдавал русские title/description/og.
 * Проверяется чистая функция, Next не поднимается.
 */
describe("?lang=en на русском адресе со своей английской страницей", () => {
  it("/cyberchess?lang=en → /en/cyberchess", () => {
    expect(f("/cyberchess", "?lang=en")).toBe("/en/cyberchess");
  });
  it("метка канала сохраняется, lang убирается", () => {
    expect(f("/cyberchess", "?lang=en&c=yt")).toBe("/en/cyberchess?c=yt");
  });
  it("регистр значения не важен", () => {
    expect(f("/cyberchess", "?c=yt&lang=EN")).toBe("/en/cyberchess?c=yt");
  });
  it("другой язык и пустой запрос — null", () => {
    expect(f("/cyberchess", "?lang=ru")).toBeNull();
    expect(f("/cyberchess", "")).toBeNull();
    expect(f("/cyberchess", null)).toBeNull();
  });
  it("уже /en — петли нет", () => {
    expect(f("/en/cyberchess", "?lang=en")).toBeNull();
  });
  it("нет своей английской страницы — остаёмся", () => {
    expect(f("/pricing", "?lang=en")).toBeNull();
  });
  it("правило общее для списка: /go → /en/go", () => {
    expect(f("/go", "?lang=en")).toBe("/en/go");
  });
  it("в middleware() вызов стоит после языковойРедирект и до NextResponse.next()", () => {
    const src = readFileSync(join(__dirname, "..", "middleware.ts"), "utf-8");
    const тело = src.slice(src.indexOf("export function middleware("));
    const a = тело.indexOf("языковойРедирект(");
    const b = тело.indexOf("редиректПоПараметруЯзыка(");
    const c = тело.indexOf("NextResponse.next()");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
