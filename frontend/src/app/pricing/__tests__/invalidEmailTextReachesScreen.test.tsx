/**
 * Касса ответила 400 invalid_email с текстом для человека — витрина показывает
 * ЭТОТ текст, а не общую «Ошибка оплаты» (просьба Приложений 31.10.2026).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { STANDALONE_APPS } from "@/lib/termPricing";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing",
}));

const ТЕКСТ_СЕРВЕРА = "Проверьте адрес почты: в нём опечатка.";
const ВСЕ_ССЫЛКИ = [
  "tier_lite", "tier_medium", "tier_pro", "tier_full", "tier_max",
  ...STANDALONE_APPS.flatMap((a) => ["lite", "medium", "pro", "full", "max"].map((t) => `app_${a.slug}_${t}`)),
];
let вКассу = 0;

function ответыСервера(ответКассы: unknown, статус: number) {
  вКассу = 0;
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    const ok = (h: unknown, status = 200) => ({ ok: status < 400, status, json: async () => h }) as unknown as Response;
    if (адрес.includes("checkout/healthz")) {
      return ok({ ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true, sellable: { configured: ВСЕ_ССЫЛКИ, missing: [] } } } });
    }
    if (адрес.includes("checkout/session")) { вКассу++; return ok(ответКассы, статус); }
    if (адрес.includes("/pricing/quote")) return ok({ tierId: "pro", termMonths: 6, currency: "USD", lines: [], subtotal: 0, discount: 0, total: 0, notes: [], promo: null });
    if (адрес.includes("/pricing/trust")) return ok({ numbers: [], badges: [] });
    return ok({ currencies: { USD: { symbol: "$", rate: 1 } }, tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [] });
  });
}

async function нажатьКупитьШахматы() {
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => { render(<I18nProvider><Страница /></I18nProvider>); });
  const к = document.getElementById("apps")!.querySelector<HTMLElement>('[data-app="cyberchess"]');
  expect(к, "карточки шахмат нет — проверка пустая").not.toBeNull();
  await act(async () => { к!.querySelector("button")!.click(); await new Promise((r) => setTimeout(r, 50)); });
  expect(вКассу, "нажатие не дошло до кассы — проверка пустая").toBe(1);
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("отказ кассы invalid_email", () => {
  it("400 invalid_email → на экране текст сервера", async () => {
    ответыСервера({ error: "invalid_email", message: ТЕКСТ_СЕРВЕРА }, 400);
    await нажатьКупитьШахматы();
    expect(document.body.textContent).toContain(ТЕКСТ_СЕРВЕРА);
  });
  it("контроль: прочий отказ без url — текст сервера не подставляется", async () => {
    ответыСервера({ error: "other", message: ТЕКСТ_СЕРВЕРА }, 400);
    await нажатьКупитьШахматы();
    expect(document.body.textContent).not.toContain(ТЕКСТ_СЕРВЕРА);
  });
});
