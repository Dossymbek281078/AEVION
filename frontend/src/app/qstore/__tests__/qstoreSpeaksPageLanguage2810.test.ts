import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";
import { tQ, catName, QSTORE_KEYS, QSTORE_DICT } from "../i18n";

/*
 * 28.10.2026 (окно «Приложения»). QStore был целиком английским при любом языке сайта,
 * ошибки сервера шли на экран сырыми кодами (`d.error || "Purchase failed"`), отказы
 * рисовались зелёной плашкой. Все шесть товаров витрины оказались демо-заглушками —
 * бэкенд их снимает (списки их не отдают, покупка → 410 demo_product_not_for_sale,
 * карточка → product.demo: true), и витрина станет пустой.
 * Здесь: словарь полон на ru/en/kk; на экране нет текста мимо словаря; сырые ответы
 * не выводятся; демо-карточка не рисует кнопку покупки; пустая витрина зовёт
 * выставить товар и открывает форму; сбой каталога — не «товаров нет».
 */
const ПАПКА = join(process.cwd(), "src/app/qstore");
const ФАЙЛЫ = ["page.tsx", "[id]/page.tsx", "seller/[id]/page.tsx", "QStoreNotify.tsx"];
const СЕРВЕР = readFileSync(join(process.cwd(), "..", "aevion-globus-backend", "src", "routes", "qstore.ts"), "utf8");
const кириллица = /[А-Яа-яЁё]/;
const безКомментариев = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("QStore: словарь ru/en/kk", () => {
  test("у трёх языков все ключи непустые; en без кириллицы; kk не копия ru", () => {
    expect(QSTORE_KEYS.length).toBeGreaterThan(100);
    for (const lang of ["ru", "en", "kk"]) for (const k of QSTORE_KEYS) expect(QSTORE_DICT[lang]![k].trim(), `${lang}:${k}`).not.toBe("");
    expect(QSTORE_KEYS.filter((k) => кириллица.test(QSTORE_DICT.en![k]))).toEqual([]);
    const копии = QSTORE_KEYS.filter((k) => QSTORE_DICT.kk![k] === QSTORE_DICT.ru![k]);
    expect(копии).toEqual(["cat.music", "cat.design"]); // «Музыка», «Дизайн» — одинаковы в ru и kk
    // kk — правда казахский, а не русский под другим ключом: специфические буквы в большинстве строк.
    const сБуквами = QSTORE_KEYS.filter((k) => /[әіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(QSTORE_DICT.kk![k]));
    expect(сБуквами.length / QSTORE_KEYS.length).toBeGreaterThan(0.7);
  });

  test("подстановки одинаковы во всех языках", () => {
    for (const k of QSTORE_KEYS) {
      const нужные = (QSTORE_DICT.en![k].match(/\{\w+\}/g) ?? []).sort();
      for (const lang of ["ru", "kk"]) expect((QSTORE_DICT[lang]![k].match(/\{\w+\}/g) ?? []).sort(), `${lang}:${k}`).toEqual(нужные);
    }
    expect(tQ("ru", "page.count", { n: 0 })).toBe("Товаров: 0");
    expect(tQ("de", "page.emptyCta")).toBe("Become the first seller"); // язык без словаря → en, не ru
  });

  test("словарь знает каждую категорию сервера; неизвестный id — как пришёл", () => {
    const блок = СЕРВЕР.slice(СЕРВЕР.indexOf("const CATEGORIES = ["), СЕРВЕР.indexOf("];", СЕРВЕР.indexOf("const CATEGORIES = [")));
    const ids = [...блок.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBe(7);
    for (const lang of ["ru", "kk"]) for (const id of ids) expect(catName(lang, id), `${lang}:${id}`).toMatch(кириллица);
    for (const id of ids) expect(catName("en", id)).not.toBe(id);
    expect(catName("ru", "ebook")).toBe("ebook");
  });
});

describe("QStore: исходники", () => {
  test("🔴 на экране нет текста мимо словаря (JSX-текст, placeholder, aria-label, title, alt)", () => {
    for (const ф of ФАЙЛЫ) {
      const s = безКомментариев(readFileSync(join(ПАПКА, ф), "utf8"));
      expect(s.length, ф).toBeGreaterThan(2000);
      const плохие = s.split("\n").filter((l) =>
        (/>\s*[A-Za-zА-Яа-яЁё][^<{}]*</.test(l) && !/>\s*(QStore|← QStore)\s*</.test(l)) ||
        (/(placeholder|aria-label|title|alt|label)[=:]\s*"[^"]*[A-Za-zА-Яа-яЁё]{3}/.test(l) && !/placeholder="you@example\.com"/.test(l)) ||
        /^\s+[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё,.!?'’—-]*\s[A-Za-zА-Яа-яЁё ,.!?'’—-]{3,}$/.test(l),
      );
      expect(плохие, ф).toEqual([]);
    }
  });

  test("сырые ответы сервера и исключения не выводятся человеку", () => {
    for (const ф of ФАЙЛЫ) {
      const s = безКомментариев(readFileSync(join(ПАПКА, ф), "utf8"));
      expect(s, ф).not.toMatch(/\.error\s*\|\||\|\|\s*[\w$?.]*\.error\b|\be\.message\b|String\(e\)|\{\s*[\w$?.]+\.error\s*\}|Request failed \(/);
    }
  });

  test("отказы — красной плашкой role=alert, а не зелёной", () => {
    for (const ф of ["page.tsx", "[id]/page.tsx"]) {
      const s = readFileSync(join(ПАПКА, ф), "utf8");
      expect(s, ф).toContain(`role={noticeIsError ? "alert" : "status"}`);
      expect(s, ф).toContain(`background: noticeIsError ? "#fef2f2" : "#f0fdf4"`);
    }
  });

  test("метаданные не обещают покупку", () => {
    for (const ф of ["layout.tsx", "[id]/layout.tsx"]) {
      const s = безКомментариев(readFileSync(join(ПАПКА, ф), "utf8"));
      expect(s, ф).not.toMatch(/\bBuy\b|instant delivery|Digital delivery/i);
    }
  });
});

/* ── рендер ─────────────────────────────────────────────────────────────── */

const язык = vi.hoisted(() => ({ lang: "ru" }));
const каталог = vi.hoisted(() => ({
  products: vi.fn(async () => ({ items: [] as unknown[] })),
  featured: vi.fn(async () => ({ popular: [], newest: [], trending: [], topRated: [] })),
}));

vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => ({ lang: язык.lang }) }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
vi.mock("@/lib/auth", () => ({ getAuthToken: () => "tok" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "p1" }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: unknown; href: string }) => createElement("a", { href }, children as never) }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({ ProductPageShell: ({ children }: { children: unknown }) => createElement("div", null, children as never) }));
vi.mock("@/components/PaddleUpgradeButton", () => ({ PaddleUpgradeButton: () => null }));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));
vi.mock("@/lib/aevionCatalog", () => ({ catalog: { qstore: каталог } }));

const товар = (extra: Record<string, unknown>) => ({
  id: "p1", sellerId: "seller-1234567890", title: "Prompt Course", description: "d", category: "template",
  price: 0, currency: "usd", previewUrl: "", tags: [], salesCount: 0, isPublic: true, createdAt: "2026-10-01T00:00:00Z", ...extra,
});

function сервер(product: Record<string, unknown>, покупка?: { status: number; body: unknown }) {
  const f = vi.fn(async (url: string, init?: { method?: string }) => {
    const ответ = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (url.endsWith("/purchase") && init?.method === "POST") return ответ(покупка!.status, покупка!.body);
    if (url.endsWith("/reviews")) return ответ(200, { reviews: [] });
    return ответ(200, { product });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => { язык.lang = "ru"; vi.stubGlobal("scrollTo", () => {}); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); каталог.products.mockReset(); каталог.products.mockImplementation(async () => ({ items: [] })); });

describe("карточка товара", () => {
  test("🔴 демо-товар: плашка «не продаётся», ни кнопки покупки, ни формы «оплата скоро»", async () => {
    сервер(товар({ demo: true, price: 1900 }));
    const { default: Item } = await import("../[id]/page");
    await act(async () => { render(createElement(Item)); });
    await screen.findByText(tQ("ru", "demo.badge"));
    expect(screen.queryByText(tQ("ru", "card.getFree"))).toBeNull();
    expect(document.querySelector("[data-qstore-notify]")).toBeNull();
    expect(screen.queryAllByRole("button").map((b) => b.textContent)).not.toContain(tQ("ru", "card.getFree"));
  });

  test("демо-товар с ценой 0 тоже без кнопки (kk)", async () => {
    язык.lang = "kk";
    сервер(товар({ demo: true, price: 0 }));
    const { default: Item } = await import("../[id]/page");
    await act(async () => { render(createElement(Item)); });
    await screen.findByText(tQ("kk", "demo.badge"));
    expect(screen.queryByText(tQ("kk", "card.getFree"))).toBeNull();
  });

  test("410 demo_product_not_for_sale при покупке — человеческий текст красной плашкой, без сырого кода", async () => {
    язык.lang = "en";
    сервер(товар({ demo: false, price: 0 }), { status: 410, body: { error: "demo_product_not_for_sale" } });
    const { default: Item } = await import("../[id]/page");
    await act(async () => { render(createElement(Item)); });
    const кнопка = await screen.findByText("Get free");
    await act(async () => { fireEvent.click(кнопка); });
    const плашка = await screen.findByRole("alert");
    expect(плашка.textContent).toContain("Demo example — not for sale");
    expect(document.body.textContent).not.toContain("demo_product_not_for_sale");
    expect(screen.queryByText("Get free")).toBeNull(); // карточка перешла в демо-вид
  });

  test("неизвестный отказ — общий текст, не код сервера", async () => {
    сервер(товар({ demo: false, price: 0 }), { status: 500, body: { error: "purchase_failed" } });
    const { default: Item } = await import("../[id]/page");
    await act(async () => { render(createElement(Item)); });
    await act(async () => { fireEvent.click(await screen.findByText(tQ("ru", "card.getFree"))); });
    expect((await screen.findByRole("alert")).textContent).toContain(tQ("ru", "buy.fail"));
    expect(document.body.textContent).not.toContain("purchase_failed");
  });
});

describe("витрина", () => {
  test("🔴 пустая витрина: человеческий текст на языке страницы и «стать первым продавцом» открывает форму", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { default: Store } = await import("../page");
    await act(async () => { render(createElement(Store)); });
    await screen.findByText(tQ("ru", "page.emptyTitle"));
    expect(document.body.textContent).not.toMatch(/No products yet|Be the first to list/);
    expect(screen.queryByText(tQ("ru", "featured.heading"))).toBeNull(); // пустые подборки не рисуются
    await act(async () => { fireEvent.click(screen.getByText(tQ("ru", "page.emptyCta"))); });
    expect(screen.getByText(tQ("ru", "form.heading"))).toBeTruthy();
    expect(screen.getByPlaceholderText(tQ("ru", "form.titlePh"))).toBeTruthy();
  });

  test("сбой каталога — отказ role=alert, а не «товаров нет»", async () => {
    vi.stubGlobal("fetch", vi.fn());
    каталог.products.mockImplementation(async () => { throw new Error("HTTP 503 storage_unavailable"); });
    const { default: Store } = await import("../page");
    await act(async () => { render(createElement(Store)); });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(tQ("ru", "page.loadFail")));
    expect(screen.queryByText(tQ("ru", "page.emptyTitle"))).toBeNull();
    expect(document.body.textContent).not.toContain("storage_unavailable");
  });
});
