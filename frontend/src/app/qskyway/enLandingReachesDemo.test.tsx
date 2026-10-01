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

  it("голый /qskyway под cookie en НИКУДА не уводит — английской страницы нет", async () => {
    /*
     * 🔴 01.10.2026 УТВЕРЖДЕНИЕ ПЕРЕВЁРНУТО, и вот чем.
     *
     * Прежде здесь требовалось, чтобы страница уводила гостя на /en/qskyway.
     * Комментарий к самому редиректу (14.09) объяснял, что так лечили «хождение
     * по кругу», — но лечение круг и замкнуло: своей страницы /en/qskyway не
     * имеет, middleware возвращал гостя сюда, а страница снова уводила туда.
     *
     * Замер прода 01.10 курлом: с кукой aevion_lang_v1=en — 6 шагов и опять 307;
     * без куки — 200. Так же вели себя /longevity, /qrenew и /smeta-trainer.
     *
     * Теперь адрес берётся из общего списка английских страниц, и для /qskyway
     * он пуст: гость остаётся на русской странице и видит её, а не круг.
     */
    expect(await openModule({})).toBeNull();
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
