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
// Счётчик рисует null — подменяем его меткой, но решает показать ли метку настоящий PageTracking
// (с учётом глушения вложенного): считаем, сколько счётчиков реально ЖИВЫ в кадре.
vi.mock("@/components/PageTracking", async (оригинал) => {
  const m = await оригинал<typeof import("@/components/PageTracking")>();
  return {
    ...m,
    PageTracking: (p: { page: string }) => (m.PageTracking(p) ? <i data-pt={p.page} /> : null),
  };
});

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
  it("🔴 ссылки в цены несут язык: на /en/devhub нет /pricing без lang=en (приёмка прода 7d91f4884, 30.10)", async () => {
    const div = await кадр("probe-x");
    const вЦены = [...div.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").filter((h) => h.startsWith("/pricing"));
    expect(вЦены.length).toBeGreaterThan(0);
    expect(вЦены.filter((h) => !h.includes("lang=en"))).toEqual([]);
  });

  it("🔴 язык кадра — en (макет задаёт его сам, без заголовков)", async () => {
    const div = await кадр("probe-x");
    expect(div.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("en");
  });

  it("🔴 конструктор — первым блоком, на английском; в кадре ровно один h1 — конструктора", async () => {
    const div = await кадр("probe-x");
    const h1s = [...div.querySelectorAll("h1")];
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent ?? "").not.toMatch(/\p{Script=Cyrillic}/u);
    expect(h1s[0].textContent).not.toContain("Describe it. Get a deployed project.");
    // Заголовок посадочной остался, но уровнем ниже.
    const h2 = [...div.querySelectorAll("h2")].find((h) => (h.textContent ?? "").includes("Describe it. Get a deployed project."));
    expect(h2).toBeTruthy();
  });

  it("🔴 учёт: ровно один счётчик посещений в кадре — en-devhub (конструктор не считает второй раз)", async () => {
    const div = await кадр("probe-x");
    const метки = [...div.querySelectorAll("[data-pt]")].map((e) => e.getAttribute("data-pt"));
    expect(метки).toEqual(["en-devhub"]);
  });

  it("контроль: сам /devhub считает себя (счётчик конструктора жив вне /en)", async () => {
    const Конструктор = (await import("../../../devhub/page")).default;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch);
    const div = document.createElement("div");
    div.innerHTML = renderToString(<I18nProvider><Конструктор /></I18nProvider>);
    expect([...div.querySelectorAll("[data-pt]")].map((e) => e.getAttribute("data-pt"))).toEqual(["devhub"]);
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
    // Личность гостя уже ставит корневой макет; второй экземпляр слал adopt-guest дважды.
    expect(макет).not.toMatch(/<DevHubGuestIdentity/);
    expect(readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8")).toContain("<DevHubGuestIdentity />");
  });
});
