// Плавающие слои не должны ложиться на нав телефона и на панели правой колонки десктопа.
// Тестер 18–20.09.2026 (настоящая партия кликами на проде):
//  • 390: тост общего провайдера «Мат в 2 · Лёгкая · Эндшпиль · 849 ×» лежал на иконках BottomNav
//    даже внизу прокрутки (bottom:16 при наве ~56px) → провайдер поднимается CSS-переменной,
//    которую страница шахмат задаёт на телефоне; остальные потребители провайдера не меняются;
//  • 1920/1366: карточка «Знаешь теорию этого дебюта?» (fixed справа внизу, 280px) накрывала
//    «Точность / Оценка по ходам», чипы тем задач («🏁 Эндшпиль») и кнопку «Войти» панели
//    «Анализ варианта» → слева внизу (левая колонка внизу пуста) и только с 769.
// Сторож ИСХОДНИКА; наложения — тестером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const card = readFileSync(join(__dirname, "..", "OpeningFlashCard.tsx"), "utf8");
const toast = readFileSync(join(__dirname, "..", "..", "..", "components", "ToastProvider.tsx"), "utf8");

describe("тосты на телефоне — сверху под шапкой, не на кнопках и не на наве", () => {
  it("общий провайдер: top/bottom управляются переменными, умолчание прежнее (справа внизу)", () => {
    expect(toast).toContain('top: "var(--aevion-toast-top, auto)"');
    expect(toast).toContain('bottom: "var(--aevion-toast-bottom, calc(16px + var(--aevion-toast-lift, 0px)))"');
    expect(toast).not.toMatch(/right: 16,\n\s*bottom: 16,/);
  });
  it("страница шахмат на <769 ставит top и bottom:auto, на десктопе снимает, при размонтировании чистит", () => {
    expect(page).toContain('if(vwPx<769){r.setProperty("--aevion-toast-top","64px");r.setProperty("--aevion-toast-bottom","auto")');
    expect(page).toContain('else{r.removeProperty("--aevion-toast-top");r.removeProperty("--aevion-toast-bottom")');
    expect(page).toContain('for(const k of ["--aevion-toast-top","--aevion-toast-bottom","--aevion-toast-lift"])r.removeProperty(k)');
  });
});

describe("карточка теории дебюта — в потоке левой колонки, не fixed", () => {
  it("рендерится ОДИН раз, внутри aside после карточки «Партия»", () => {
    expect(page.split("<OpeningFlashCard").length - 1).toBe(1);
    const i = page.indexOf("<OpeningFlashCard");
    const before = page.slice(Math.max(0, i - 700), i);
    expect(before).toContain("Коуч: <b style={{color:CC.text}}>супер-GM</b>");
    expect(page.slice(i, page.indexOf("/>}", i) + 3)).toContain("onDismiss");
    expect(page.indexOf("</aside>;", i)).toBeGreaterThan(i);
  });
  it("компонент не fixed: position relative, ширина колонки", () => {
    expect(card).toMatch(/position: "relative",\n\s*width: "100%",/);
    expect(card).not.toContain('position: "fixed"');
  });
});
