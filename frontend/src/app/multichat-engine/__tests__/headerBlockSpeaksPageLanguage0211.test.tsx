// Шапка /multichat-engine («AEVION Multichat Engine» + «One backend, …») стояла английским блоком посреди русской страницы.
// Теперь идёт через tm() по языку страницы: ru — русский, kk — казахский, en — исходник.
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getAuthHeaders: () => ({}) }));
const язык = vi.hoisted(() => ({ lang: "ru" }));
vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: язык.lang, t: (k: string) => k }),
}));
vi.mock("../CouncilConsole", () => ({ CouncilConsole: () => null }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));
vi.mock("@/components/FooterWaitlist", () => ({ WaitlistIfMissing: () => null }));

import MultichatEnginePage from "../MultichatEngineClient";

const кириллица = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const заголовок = () => screen.getByRole("heading", { level: 1 }).textContent ?? "";
const абзац = () => screen.getByRole("heading", { level: 1 }).nextElementSibling?.textContent ?? "";

describe("шапка страницы на языке посетителя", () => {
  test("ru: русский заголовок и описание, английской фразы нет", () => {
    язык.lang = "ru";
    render(<MultichatEnginePage />);
    expect(заголовок()).toBe("AEVION Мультичат");
    expect(абзац()).toMatch(кириллица);
    expect(абзац()).not.toMatch(/One backend/);
    expect(document.body.textContent).not.toMatch(/Single chat/);
    for (const [en, ru] of [["Backend health", "Состояние сервера"], ["Configured providers", "Подключённые поставщики"], ["Role defaults", "Модели ролей по умолчанию"]]) {
      expect(screen.getByRole("link", { name: ru })).toBeTruthy();
      expect(screen.queryByRole("link", { name: en })).toBeNull();
    }
  });
  test("kk: казахский текст", () => {
    язык.lang = "kk";
    render(<MultichatEnginePage />);
    expect(абзац()).toMatch(/жеткізушісі/);
    expect(screen.getByRole("link", { name: "Сервер күйі" })).toBeTruthy();
    expect(абзац()).not.toMatch(/One backend/);
  });
  test("en: остаётся английский", () => {
    язык.lang = "en";
    render(<MultichatEnginePage />);
    expect(заголовок()).toBe("AEVION Multichat Engine");
    expect(абзац()).toMatch(/^One backend, several LLM providers/);
    expect(абзац()).not.toMatch(кириллица);
    for (const n of ["Backend health", "Configured providers", "Role defaults"]) expect(screen.getByRole("link", { name: n })).toBeTruthy();
  });
});
