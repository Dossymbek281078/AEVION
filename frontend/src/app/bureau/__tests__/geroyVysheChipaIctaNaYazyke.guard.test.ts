import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Первый экран /bureau: герой с CTA «Защитить работу» стоит ВЫШЕ полосы подписки,
 * а CTA — на языке страницы (ru/en/kk), не литералом.
 *
 * Повод 13.10.2026 (воронка 14 дн.: 16 живых сессий бюро, нажатий 0; кадры 390×844):
 * над героем стояла полоса «Входит в подписку · от $200/мес · Купить» (164 px), h1 — на
 * 490 px, первый продуктовый CTA — на 901 px, вне первого экрана; на ru-RU CTA звучал
 * «Protect Your Work». Кадр после выкатки меряется прибором отдельно (rect+elementFromPoint).
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/bureau/page.tsx"), "utf8");

describe("/bureau: герой выше чипа цены, CTA на языке страницы", () => {
  it("🔴 порядок блоков: герой → заметка/чип цены, а не наоборот", () => {
    const hero = СТРАНИЦА.indexOf("── Hero Header ──");
    const notice = СТРАНИЦА.indexOf("<DataBuyerNotice />");
    const chip = СТРАНИЦА.indexOf('<ModulePricingChip moduleId="bureau"');
    expect(hero, "герой есть").toBeGreaterThan(0);
    expect(notice, "заметка есть").toBeGreaterThan(0);
    expect(chip, "чип есть").toBeGreaterThan(0);
    expect(hero).toBeLessThan(notice);
    expect(hero).toBeLessThan(chip);
  });

  it("🔴 CTA «Защитить работу» — из карты языков ru/en/kk, литерала в JSX нет", () => {
    expect(СТРАНИЦА).toContain('ru: "🛡️ Защитить работу"');
    expect(СТРАНИЦА).toContain('kk: "🛡️ Жұмысты қорғау"');
    expect(СТРАНИЦА).toContain('?? "🛡️ Protect Your Work"');
    expect(СТРАНИЦА).toContain("{ctaProtect}");
    expect(СТРАНИЦА).not.toMatch(/>\s*🛡️ Protect Your Work\s*</);
  });
  it("🔴 128б: в герое ряд кнопок с CTA стоит ВЫШЕ абзаца — на 390×844 ru CTA был на 724 px при пороге 700", () => {
    const hero = СТРАНИЦА.indexOf("── Hero Header ──");
    const row = СТРАНИЦА.indexOf('<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>', hero);
    const lede = СТРАНИЦА.indexOf('<p style={{ margin: "16px 0 0", fontSize: 16, opacity: 0.8', hero);
    expect(row, "ряд кнопок есть").toBeGreaterThan(hero);
    expect(lede, "абзац есть").toBeGreaterThan(hero);
    expect(row).toBeLessThan(lede);
  });
});
