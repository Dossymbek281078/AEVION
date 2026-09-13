import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

/**
 * Непокупаемый тариф обязан ОБЪЯСНИТЬ себя, а не просто погаснуть.
 *
 * Кнопка тарифа гасится, когда его товар объявлен, но не настроен
 * (`sellable.missing`). До 13.09.2026 рядом не было ничего: человек видел
 * серую кнопку и не знал ни почему, ни что делать. Касса на этом пути
 * отвечает честным 503 с текстом «напишите нам», но только ПОСЛЕ нажатия.
 *
 * Здесь проверяется, что подпись и ссылка на связь доходят ДО ЭКРАНА —
 * ровно тот класс «правда обрывается на границе», ради которого в соседнем
 * тесте страницу и научили отрисовываться в стенде.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing",
}));

const тариф = (id: string, name: string, priceMonthly: number) => ({
  id,
  name,
  tagline: "",
  priceMonthly,
  priceAnnualPerMonth: Math.round((priceMonthly * 10) / 12),
  priceAnnualTotal: priceMonthly * 10,
  ctaLabel: "Купить",
  features: [],
  limits: {},
});

function ответыСервера(missing: string[]) {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      const h = {
        ok: true,
        providers: {
          paybox: { configured: false },
          lemonsqueezy: { configured: true, sellable: { configured: ["tier_full_monthly"], missing } },
        },
      };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 } },
      tiers: [тариф("full", "Full", 49), тариф("pro", "Universe", 149)],
      modules: [],
      bundles: [],
      notes: [],
      items: [],
      runs: [],
    };
    return { ok: true, status: 200, json: async () => тело } as unknown as Response;
  });
}

async function отрисовать() {
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("непокупаемый тариф объясняет себя", () => {
  it("при непродаваемом тарифе на экране есть подпись и ссылка на связь", async () => {
    ответыСервера(["tier_pro_monthly", "tier_pro_annual"]);
    await отрисовать();

    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=pro")),
      "кнопка погасла молча: ссылки на связь для непокупаемого тарифа нет",
    ).toBe(true);

    // И сама подпись, а не только ссылка: ссылка без текста — тоже загадка.
    const текст = document.body.textContent ?? "";
    expect(текст.length, "страница не отрисовалась вовсе").toBeGreaterThan(0);
    expect(текст, "подписи о недоступности нет").toMatch(/онлайн|online/i);
  });

  it("контроль: когда всё продаётся, лишней подписи НЕТ", async () => {
    // Без этого контроля проверка выше проходила бы и от подписи, которая
    // висит на странице ВСЕГДА, а это уже шум на рабочем тарифе.
    ответыСервера([]);
    await отрисовать();

    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=pro")),
      "подпись о недоступности показана на продаваемом тарифе",
    ).toBe(false);
  });
});
