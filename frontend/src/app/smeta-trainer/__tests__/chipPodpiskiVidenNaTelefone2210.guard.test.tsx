// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * 🔴 22.10.2026, замер на проде (сайт a26c5584c, Playwright 390×844, isMobile): /smeta-trainer после «Пропустить»
 * не показывал на телефоне ни одной строки о цене — чип в шапке был обёрнут в `hidden md:block`.
 * Правка того дня: на узком экране строка выводится отдельно под шапкой (md:hidden), в шапке — как раньше.
 *
 * 🔴 27.10.2026 (Приложения-2, решение оркестратора — вариант «б»): у тренажёра НЕТ платной части —
 * бэкенд его намеренно не закрывает (index.ts: «Deliberately NOT gated here: … smeta-trainer»), в
 * PAYWALL_MODULES прода его нет. А чип говорил «Входит в подписку AEVION · от $150/мес · Купить» и вёл в
 * кассу плана, который в тренажёре ничего не открывает. Теперь в обеих обёртках — «Бесплатно · входит в
 * AEVION» и ссылка на страницу цен. Сторож: обе обёртки на месте, ни ссылки в кассу, ни цены.
 */

vi.mock("../lib/corpus", () => ({ rates: new Array(500).fill(0) }));
vi.mock("../components/LevelHome", () => ({ LevelHome: () => <div data-testid="level-home" /> }));
vi.mock("../components/OnboardingModal", () => ({ OnboardingModal: () => <div data-testid="onboarding" /> }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => <button>тема</button> }));

// eslint-disable-next-line import/first
import SmetaTrainerPage from "../_client";

const КЛИЕНТ = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "_client.tsx"), "utf8");

describe("smeta-trainer: честная строка «бесплатно» видна и на телефоне", () => {
  test("строка отрисована дважды: в шапке (hidden md:block) и под шапкой (md:hidden)", () => {
    render(<SmetaTrainerPage />);
    const чипы = screen.getAllByTestId("smeta-free-chip");
    expect(чипы, "строка должна быть в двух обёртках: для стола и для телефона").toHaveLength(2);
    const обёртки = чипы.map((c) => c.parentElement!.className);
    expect(обёртки.some((k) => /\bhidden\b/.test(k) && /\bmd:block\b/.test(k)), `шапка: ${обёртки.join(" | ")}`).toBe(true);
    expect(обёртки.some((k) => /\bmd:hidden\b/.test(k) && !/(^|\s)hidden(\s|$)/.test(k)), `телефон: ${обёртки.join(" | ")}`).toBe(true);
    const моб = screen.getByTestId("smeta-pricing-chip-mobile");
    expect(моб.closest("header"), "мобильная строка не должна быть внутри <header>").toBeNull();
  });

  test("🔴 нет ни ссылки в кассу, ни цены, ни «Купить» — тренажёр бесплатен", () => {
    const { container } = render(<SmetaTrainerPage />);
    const ссылки = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") || "");
    expect(ссылки.filter((h) => /planet-buy|#tiers|lemonsqueezy|checkout/.test(h)), "ссылки в кассу").toEqual([]);
    const текст = container.textContent || "";
    expect(текст, "цена на странице бесплатного тренажёра").not.toMatch(/\$\s?\d/);
    expect(текст).not.toMatch(/Купить|Buy\b|Сатып алу/);
    expect(текст).toContain("Бесплатно");
    expect(ссылки, "ссылка на платные приложения — страница цен, не касса").toContain("/pricing");
  });

  test("КОНТРОЛЬ источника: плашка подписки не вернулась в страницу", () => {
    expect(КЛИЕНТ).not.toContain("ModulePricingChip");
    expect(КЛИЕНТ).toContain("<FreeChip />");
  });

  // Снимать со ВСЕХ поверхностей: каталог /apps писал на карточке тренажёра «In the subscription».
  test("каталог /apps: карточка тренажёра (id smeta) — «Free», а не «In the subscription»", () => {
    const каталог = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "apps", "page.tsx"), "utf8");
    const m = каталог.match(/const FREE_APP_IDS = new Set\(\[([^\]]*)\]\)/);
    expect(m, "FREE_APP_IDS не найден — разбор сломан").toBeTruthy();
    expect(m![1]).toContain('"qcoreai"'); // контроль разбора: известный бесплатный
    expect(m![1]).toContain('"smeta"');
    // id и href одной карточки (между ними icon, name, tagline)
    expect(каталог).toMatch(/id: "smeta",[\s\S]{0,200}href: "\/smeta-trainer"/);
  });
});
