import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Кнопка «Купить» на странице модуля доводит метку канала до страницы цен.
 *
 * Найдено 31.08.2026 обходом пути покупателя в браузере — не грепом: кнопка
 * вела в кассу без метки, хотя вебхук читает канал с 19.08.
 *
 * 15.09.2026 — новая ценовая политика: кнопка ведёт не в кассу напрямую, а к
 * выбору срока (/pricing?app=<slug>#apps для пяти приложений, /pricing#tiers для
 * остальных модулей). Страница цен читает короткую метку ?c= и доводит её до
 * кассы — поэтому метка обязана стоять ДО хеша.
 *
 * Проверяется АДРЕС ссылки, по которому уйдёт браузер.
 */

vi.mock("@/lib/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

// eslint-disable-next-line import/first
import ModulePricingChip from "../ModulePricingChip";

function at(search: string) {
  Object.defineProperty(window, "location", {
    value: { search, href: "", pathname: "/qlearn" },
    writable: true,
  });
}

beforeEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    // приватный режим — хранилища нет
  }
  // Гость: права не пришли — кнопка «Купить» обязана быть.
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  document.body.innerHTML = "";
  at("");
});

afterEach(() => vi.unstubAllGlobals());

async function buyHref(moduleId: string): Promise<string> {
  render(<ModulePricingChip moduleId={moduleId} />);
  const link = await screen.findByText(/купить/i);
  // Дожидаемся метки: она ставится после отрисовки (useEffect).
  await waitFor(() => expect(link.closest("a")).toBeTruthy());
  return link.closest("a")!.getAttribute("href") ?? "";
}

describe("кнопка модуля несёт метку канала к выбору срока", () => {
  test("приложение: метка доезжает и стоит до хеша", async () => {
    at("?c=tg");
    await waitFor(async () => expect(await buyHref("cyberchess")).toBe("/pricing?app=cyberchess&c=tg#apps"));
  });

  test("модуль вне пяти: ведёт к подписке, с меткой", async () => {
    at("?c=tg");
    await waitFor(async () => expect(await buyHref("qlearn")).toBe("/pricing?c=tg#tiers"));
  });

  test("без метки адрес чистый", async () => {
    expect(await buyHref("cyberchess")).toBe("/pricing?app=cyberchess#apps");
  });

  test("выдуманная метка не уезжает", async () => {
    at("?c=zzzz");
    expect(await buyHref("qlearn")).toBe("/pricing#tiers");
  });
});
