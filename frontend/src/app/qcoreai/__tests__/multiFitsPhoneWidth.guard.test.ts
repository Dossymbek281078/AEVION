import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * 4.11.2026, замер прода (Playwright 390×844): после ответа Parallel страница
 * /qcoreai/multi становилась 672 px шириной — колонка `1fr` растёт до
 * min-content карточек. На телефоне сравнение A/B должно читаться без
 * горизонтальной прокрутки: minmax(0,1fr) и min-width:0 у детей сетки.
 */
const page = fs.readFileSync(path.join(__dirname, "../multi/page.tsx"), "utf8");
const media = page.slice(page.indexOf("@media (max-width: 880px)"), page.indexOf("@media (max-width: 640px)"));

describe("/qcoreai/multi на телефоне без прокрутки вбок", () => {
  test("сетка ≤880: minmax(0,1fr) и min-width:0 у колонок", () => {
    expect(media).toMatch(/\.qc-layout \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(media).toMatch(/\.qc-layout > \* \{ min-width: 0; max-width: 100%; \}/);
  });
  test("ряд кнопок прогона переносится", () => {
    expect(page).not.toMatch(/marginLeft: "auto", display: "flex", gap: 6 \}/);
  });
});
