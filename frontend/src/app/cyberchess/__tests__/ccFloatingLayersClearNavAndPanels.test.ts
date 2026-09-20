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

describe("тосты на телефоне — над BottomNav", () => {
  it("общий провайдер: bottom учитывает --aevion-toast-lift (по умолчанию 0)", () => {
    expect(toast).toContain('bottom: "calc(16px + var(--aevion-toast-lift, 0px))"');
    expect(toast).not.toMatch(/right: 16,\n\s*bottom: 16,/);
  });
  it("страница шахмат задаёт подъём ≥ 56px на <769 и снимает при размонтировании", () => {
    const m = page.match(/setProperty\("--aevion-toast-lift",vwPx<769\?"(\d+)px":"0px"\)/);
    expect(m, "подъём тостов не задан").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(56);
    expect(page).toContain('removeProperty("--aevion-toast-lift")');
  });
});

describe("карточка теории дебюта — слева внизу и только на десктопе", () => {
  it("рендер гейтится vwPx>=769", () => {
    expect(page).toContain("{currentOpening&&vwPx>=769&&<OpeningFlashCard");
    expect(page).not.toContain("{currentOpening&&<OpeningFlashCard");
  });
  it("fixed слева, не справа", () => {
    expect(card).toMatch(/position: "fixed",\n\s*bottom: 24,\n\s*left: 24,/);
    expect(card).not.toMatch(/bottom: 24,\n\s*right: 24,/);
  });
});
