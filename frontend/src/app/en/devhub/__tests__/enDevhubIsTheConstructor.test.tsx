import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 /en/devhub = КОНСТРУКТОР на английском, посадочная с листом ожидания — ниже.
 *
 * Замер Оркестратора и Продаж 30.10.2026 на проде: /en/devhub отдавал посадочную
 * «Describe it» без конструктора, а /devhub с Accept-Language en — конструктор.
 * Английские каналы (Shorts) ведут на /en/devhub, то есть в страницу без входа в продукт.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("c=probe-x"),
  usePathname: () => "/en/devhub",
}));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@monaco-editor/react", () => ({ default: () => null }));

// eslint-disable-next-line import/first
import EnLayout from "../layout";
// eslint-disable-next-line import/first
import EnPage from "../page";

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

async function кадр(c?: string) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch);
  const страница = await EnPage({ searchParams: Promise.resolve(c ? { c } : {}) });
  const дерево = EnLayout({ children: страница });
  const div = document.createElement("div");
  div.innerHTML = renderToString(<I18nProvider>{дерево}</I18nProvider>);
  return div;
}

describe("/en/devhub", () => {
  it("🔴 язык кадра — en (макет задаёт его сам, без заголовков)", async () => {
    const div = await кадр("probe-x");
    expect(div.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("en");
  });

  it("🔴 конструктор — первым блоком, на английском, без кириллицы в h1", async () => {
    const div = await кадр("probe-x");
    const h1s = [...div.querySelectorAll("h1")];
    expect(h1s.length).toBeGreaterThanOrEqual(2);
    // Первый h1 — конструктора (из /devhub), второй — посадочной ниже.
    expect(h1s[0].textContent ?? "").not.toMatch(/\p{Script=Cyrillic}/u);
    expect(h1s[0].textContent).not.toContain("Describe it. Get a deployed project.");
    expect(h1s[h1s.length - 1].textContent).toContain("Describe it. Get a deployed project.");
  });

  it("лист ожидания/посадочная — ниже конструктора, ссылки посадочной несут ?c=", async () => {
    // Метка из каталога каналов (yt): неизвестная (probe-…) по правилу сайта в ссылки не идёт.
    const div = await кадр("yt");
    const html = div.innerHTML;
    expect(html.indexOf("Describe it. Get a deployed project.")).toBeGreaterThan(html.indexOf("<h1"));
    expect(html).toMatch(/href="[^"]*[?&]c=yt/);
  });

  it("сторож: страница рисует конструктор из /devhub, а не копию, и метаданные en остались", () => {
    const src = readFileSync(join(process.cwd(), "src/app/en/devhub/page.tsx"), "utf8");
    expect(src).toContain('from "../../devhub/page"');
    expect(src).toContain('canonical: "https://aevion.app/en/devhub"');
    const макет = readFileSync(join(process.cwd(), "src/app/en/devhub/layout.tsx"), "utf8");
    expect(макет).toContain('<ServerLangProvider lang="en">');
  });
});
