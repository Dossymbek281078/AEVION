import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Дефект 30.10.2026: нижний блок /pricing («Приложения и цены») оставался русским у
// русского браузера при /pricing?lang=en — getServerLang не видел ?lang=.
const req = vi.hoisted(() => ({ search: "", al: "ru-RU,ru;q=0.9" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({
    get: (n: string) =>
      n === "x-aevion-search" ? req.search : n === "accept-language" ? req.al : null,
  }),
}));
vi.mock("@/lib/appsJsonLd", () => ({
  разметкаПриложений: async () => null,
  оплачиваемыеПриложения: async () => [
    { id: "devhub", name: "DevHub", yearOnlyUsd: 50, monthlyFromUsd: null, href: "/devhub" },
  ],
}));

// eslint-disable-next-line import/first
import PricingLayout from "../layout";

afterEach(() => vi.unstubAllGlobals());

describe("блок цен для робота на /pricing", () => {
  it("?lang=en у русского браузера — блок английский", async () => {
    req.search = "?lang=en";
    const html = renderToStaticMarkup(await PricingLayout({ children: null }));
    expect(html).toContain("Apps and prices");
    expect(html).not.toContain("Приложения и цены");
  });
  it("без ?lang= у русского браузера — русский", async () => {
    req.search = "";
    const html = renderToStaticMarkup(await PricingLayout({ children: null }));
    expect(html).toContain("Приложения и цены");
  });
});
