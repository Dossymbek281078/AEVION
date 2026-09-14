import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// 14.09.2026, живой прод: кнопка «Open QSkyway» на /en/qskyway вела на
// /qskyway, а тот при cookie en отвечал 307 обратно на /en/qskyway.
// Англоязычный посетитель ходил по кругу и до демо не доходил никогда.
//
// Каждая половина по отдельности была «верна»: посадочная ссылается на модуль,
// модуль уводит англичанина на посадочную. Дефект жил только в их СВЯЗКЕ,
// поэтому сторож берёт настоящую ссылку из посадочной и отдаёт её странице.

const state = vi.hoisted(() => ({
  lang: undefined as string | undefined,
  redirectedTo: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "aevion_lang_v1" && state.lang ? { name, value: state.lang } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirectedTo = to;
    // Настоящий redirect тоже прерывает рендер исключением.
    throw new Error("NEXT_REDIRECT " + to);
  },
}));
vi.mock("@/lib/paywall", () => ({ fetchOrPaywall: async () => ({ ok: true }) }));
vi.mock("@/components/PaywallScreen", () => ({ PaywallScreen: () => null }));
vi.mock("@/components/PageTracking", () => ({ PageTracking: () => null }));
vi.mock("./_client", () => ({ default: () => null }));

import Page from "./page";
import EnQskywayPage from "../en/qskyway/page";

async function demoHrefFromEnglishLanding(): Promise<string> {
  const el = await EnQskywayPage({ searchParams: Promise.resolve({}) });
  const html = renderToStaticMarkup(el);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const demo = hrefs.find((h) => h === "/qskyway" || h.startsWith("/qskyway?"));
  expect(demo, "на английской посадочной нет ссылки на демо: " + hrefs.join(", ")).toBeTruthy();
  return demo as string;
}

function paramsOf(href: string): Record<string, string> {
  const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  return Object.fromEntries(new URLSearchParams(q));
}

async function openModule(params: Record<string, string>): Promise<string | null> {
  state.redirectedTo = null;
  try {
    await Page({ searchParams: Promise.resolve(params) });
  } catch (e) {
    if (!String(e).includes("NEXT_REDIRECT")) throw e;
  }
  return state.redirectedTo;
}

describe("английский посетитель доходит до демо QSkyway", () => {
  beforeEach(() => {
    state.lang = "en";
  });

  it("контроль: голый /qskyway под cookie en по-прежнему уводит на посадочную", async () => {
    // Без этой проверки сторож был бы зелёным и на странице, у которой
    // перенаправление просто удалили.
    expect(await openModule({})).toBe("/en/qskyway");
  });

  it("ссылка «Open QSkyway» с посадочной открывает демо, а не посадочную снова", async () => {
    const href = await demoHrefFromEnglishLanding();
    expect(await openModule(paramsOf(href)), "петля: " + href + " -> /en/qskyway").toBeNull();
  });

  it("без cookie en страница не перенаправляет вовсе", async () => {
    state.lang = undefined;
    expect(await openModule({})).toBeNull();
  });
});
