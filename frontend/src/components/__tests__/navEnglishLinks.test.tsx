import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * 30.10.2026: на /en/devhub «Pricing» шапки и подвала вёл на русский /pricing
 * (curl прода f2db0ee93). На /en/* внутренние ссылки обязаны нести язык.
 */
let путь = "/en/devhub";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => путь,
}));
class ПустойНаблюдатель {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ПустойНаблюдатель);

import { I18nProvider } from "@/lib/i18n";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";

const внутренние = (c: HTMLElement) =>
  [...c.querySelectorAll("a")]
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith("/") && !h.startsWith("//"));

describe("общая шапка и подвал на английских путях", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    путь = "/en/devhub";
  });

  test.each([
    ["шапка", () => render(<I18nProvider><SiteHeader /></I18nProvider>).container],
    ["подвал", () => render(<I18nProvider><SiteFooter /></I18nProvider>).container],
  ])("%s: на /en/devhub ни одной ссылки на русский адрес без языка", (_n, draw) => {
    const links = внутренние(draw());
    expect(links.length).toBeGreaterThanOrEqual(8);
    const русские = links.filter((h) => !h.startsWith("/en/") && !/[?&]lang=en/.test(h));
    expect(русские).toEqual([]);
  });

  test("шапка: /pricing -> /pricing?lang=en, /shop -> /en/shop", () => {
    const links = внутренние(render(<I18nProvider><SiteHeader /></I18nProvider>).container);
    expect(links).toContain("/pricing?lang=en");
    expect(links).toContain("/en/shop");
    expect(links).not.toContain("/pricing");
  });

  test("на русском пути /devhub ссылка /pricing прежняя", () => {
    путь = "/devhub";
    for (const c of [render(<I18nProvider><SiteHeader /></I18nProvider>).container, render(<I18nProvider><SiteFooter /></I18nProvider>).container]) {
      const links = внутренние(c);
      expect(links.some((h) => /lang=en/.test(h))).toBe(false);
    }
    expect(внутренние(render(<I18nProvider><SiteHeader /></I18nProvider>).container)).toContain("/pricing");
  });

  test("/energy не принимается за английский путь", () => {
    путь = "/energy";
    expect(внутренние(render(<I18nProvider><SiteHeader /></I18nProvider>).container)).toContain("/pricing");
  });
});
