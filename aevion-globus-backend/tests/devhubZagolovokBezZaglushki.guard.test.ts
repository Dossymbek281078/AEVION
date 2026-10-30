import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ubratZaglushkiIzZagolovkov, ochistitFaylyOtZaglushek, ukazanieBezVydumannyhDannyh, ZAGLUSHKA_V_SKOBKAH } from "../src/lib/devhubNoFakeData";

const html = (title: string, h1: string) =>
  `<html><head><title>${title}</title></head><body><h1>${h1}</h1><p>Phone: [your phone]</p></body></html>`;
const vTegah = (s: string) => [...s.matchAll(/<(title|h1)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);

describe("title/h1 сайта без [заглушки]", () => {
  it("пустое имя: заглушка из title и h1 уходит, тема остаётся, скобок нет", () => {
    const out = ubratZaglushkiIzZagolovkov(html("[your company name] — Coffee Shop", "[your company name]"), "coffee shop landing page");
    for (const t of vTegah(out)) expect(ZAGLUSHKA_V_SKOBKAH.test(t), t).toBe(false);
    expect(out).toContain("<title>Coffee Shop</title>");
    expect(out).toContain("<h1>Coffee shop landing</h1>");
    // тело не тронуто: контактная заглушка разрешена
    expect(out).toContain("[your phone]");
  });
  it("русская заглушка тоже", () => {
    const out = ubratZaglushkiIzZagolovkov(html("[название вашей компании] | Кофейня", "Кофейня [название вашей компании]"));
    for (const t of vTegah(out)) expect(/\[|\]/.test(t), t).toBe(false);
    expect(out).toContain("<title>Кофейня</title>");
  });
  it("имя «Bean & Co» сохраняется в title", () => {
    const src = html("Bean & Co — Coffee Shop", "Bean & Co");
    expect(ubratZaglushkiIzZagolovkov(src, "coffee shop")).toBe(src);
  });
  it("применяется только к html-файлам", () => {
    const f = ochistitFaylyOtZaglushek([{ path: "a.js", content: "<title>[x y]</title>" }, { path: "index.html", content: html("[your company name]", "Hi") }], "cafe");
    expect(f[0].content).toBe("<title>[x y]</title>");
    expect(f[1].content).toContain("<title>Cafe</title>");
  });
  it("указание модели запрещает заглушку в title/h1", () => {
    expect(ukazanieBezVydumannyhDannyh(2026, "en")).toContain("<title> and the main <h1> must NEVER contain a placeholder");
  });
  it("🔴 генератор пропускает результат через сторож", () => {
    const код = readFileSync(join(__dirname, "../src/routes/devhub.ts"), "utf8");
    expect(код).toContain("files: ochistitFaylyOtZaglushek(files, prompt),");
  });
});
