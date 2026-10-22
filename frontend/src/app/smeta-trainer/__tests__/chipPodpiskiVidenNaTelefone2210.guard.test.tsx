// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/*
 * 🔴 22.10.2026, замер на проде (сайт a26c5584c, Playwright 390×844, isMobile): /smeta-trainer после «Пропустить»
 * в приветственном окне не показывал НИ ОДНОЙ кнопки «Купить»/«Тарифы» — ни сразу, ни после прокрутки вниз,
 * тогда как соседние страницы (psyapp-deps, qskyway, qmedia) показывали чип «Входит в подписку · Купить».
 * Причина: чип в шапке обёрнут в `hidden md:block`. На столе (1463×724) путь Купить → /pricing#planet-buy →
 * «Оформить — $225 в месяц» → касса LS проходил. Правка: на узком экране чип выводится отдельной строкой
 * под шапкой (md:hidden), в шапке — как раньше. Сторож рендерит страницу и проверяет, что чип есть в ОБЕИХ
 * обёртках: одна скрыта на телефоне, другая — на столе; мутация, убирающая мобильную строку, краснеет.
 */

vi.mock("../lib/corpus", () => ({ rates: new Array(500).fill(0) }));
vi.mock("../components/LevelHome", () => ({ LevelHome: () => <div data-testid="level-home" /> }));
vi.mock("../components/OnboardingModal", () => ({ OnboardingModal: () => <div data-testid="onboarding" /> }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => <button>тема</button> }));
vi.mock("@/components/ModulePricingChip", () => ({
  default: ({ moduleId }: { moduleId: string }) => <a href="/pricing#planet-buy" data-testid="pricing-chip" data-module={moduleId}>Купить</a>,
}));

// eslint-disable-next-line import/first
import SmetaTrainerPage from "../_client";

describe("smeta-trainer: чип подписки виден и на телефоне", () => {
  test("🔴 чип отрисован дважды: в шапке (hidden md:block) и строкой под шапкой (md:hidden) — на любой ширине ровно один виден", () => {
    render(<SmetaTrainerPage />);
    const чипы = screen.getAllByTestId("pricing-chip");
    expect(чипы, "чип должен быть в двух обёртках: для стола и для телефона").toHaveLength(2);
    for (const чип of чипы) expect(чип.getAttribute("data-module")).toBe("smeta-trainer");
    const обёртки = чипы.map((c) => c.parentElement!.className);
    expect(обёртки.some((k) => /\bhidden\b/.test(k) && /\bmd:block\b/.test(k)), `шапка: ${обёртки.join(" | ")}`).toBe(true);
    expect(обёртки.some((k) => /\bmd:hidden\b/.test(k) && !/(^|\s)hidden(\s|$)/.test(k)), `телефон: ${обёртки.join(" | ")}`).toBe(true);
    // мобильная строка — отдельный узел с меткой, стоит ПОСЛЕ шапки (не внутри неё), чтобы не ломать строку шапки на 390 px
    const моб = screen.getByTestId("smeta-pricing-chip-mobile");
    expect(моб.closest("header"), "мобильная строка не должна быть внутри <header>").toBeNull();
    expect(моб.querySelector("[data-testid=pricing-chip]")).not.toBeNull();
  });

  test("КОНТРОЛЬ: на столе чип остаётся в шапке", () => {
    render(<SmetaTrainerPage />);
    const вШапке = document.querySelector("header [data-testid=pricing-chip]");
    expect(вШапке).not.toBeNull();
    expect(вШапке!.parentElement!.className).toMatch(/md:block/);
  });
});
