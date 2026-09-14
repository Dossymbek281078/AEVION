import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

/**
 * Непокупаемый тариф обязан ОБЪЯСНИТЬ себя, а не просто погаснуть.
 *
 * Кнопка тарифа гасится, когда его ссылки НЕТ в списке настроенных
 * (`sellable.configured`). До 14.09.2026 проверка шла по списку НЕнастроенных
 * (`sellable.missing`) и была слепа к тарифу, которого нет в справочнике вовсе:
 * так на живом проде жил `pro`. Первый тест ниже воспроизводит ИМЕННО это
 * состояние — pro нет ни в одном списке. До 13.09.2026 рядом не было ничего: человек видел
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

// configured = null — healthz ответил, но поля продаваемости в нём НЕТ
// (так было до выкатки 29.08.2026 и так будет при любом сбое сборки ответа).
function ответыСервера(configured: string[] | null, missing: string[] = []) {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      const h = {
        ok: true,
        providers: {
          paybox: { configured: false },
          lemonsqueezy: configured === null
            ? { configured: true }
            : { configured: true, sellable: { configured, missing } },
        },
      };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 } },
      tiers: [тариф("free", "Free", 0), тариф("full", "Full", 49), тариф("pro", "Universe", 149)],
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
    // Ровно прод 13.09.2026: full настроен, а pro НЕТ НИ В ОДНОМ списке.
    // Проверка по `missing` ответила бы здесь «продаётся» — на этом и жил дефект.
    ответыСервера(["tier_full_monthly", "tier_full_annual"], []);
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

    // Пробный период ведёт в ту же кассу — у непокупаемого тарифа он обязан погаснуть.
    const пробная = document.querySelector<HTMLButtonElement>('button[aria-label$=": pro"]');
    expect(пробная, "кнопки пробного периода у pro не нашлось — проверка ниже пустая").not.toBeNull();
    expect(пробная?.disabled, "пробный период непокупаемого тарифа остался живым").toBe(true);
  });

  it("бесплатный тариф подпись «оформить нельзя» не получает никогда", async () => {
    // Free нет в справочнике товаров по определению. Положительный список без
    // исключения повесил бы на него «оформить онлайн пока нельзя».
    ответыСервера(["tier_full_monthly", "tier_full_annual"], []);
    await отрисовать();
    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=free")),
      "бесплатный тариф назван непокупаемым",
    ).toBe(false);
  });

  it("незнание о продаваемости кнопки НЕ гасит и подпись НЕ вешает", async () => {
    // Самое дорогое направление ошибки: если «поля нет» прочитается как
    // «ничего не продаётся», один сбой ответа остановит ВСЕ продажи.
    ответыСервера(null);
    await отрисовать();
    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=pro")),
      "незнание прочитано как «купить нельзя»",
    ).toBe(false);
    const пробная = document.querySelector<HTMLButtonElement>('button[aria-label$=": pro"]');
    expect(пробная, "кнопки пробного периода у pro не нашлось — проверка ниже пустая").not.toBeNull();
    expect(пробная?.disabled, "незнание погасило пробный период").toBe(false);
  });

  it("контроль: когда всё продаётся, лишней подписи НЕТ", async () => {
    // Без этого контроля проверка выше проходила бы и от подписи, которая
    // висит на странице ВСЕГДА, а это уже шум на рабочем тарифе.
    ответыСервера(["tier_full_monthly", "tier_full_annual", "tier_pro_monthly", "tier_pro_annual"], []);
    await отрисовать();

    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=pro")),
      "подпись о недоступности показана на продаваемом тарифе",
    ).toBe(false);

    const пробная = document.querySelector<HTMLButtonElement>('button[aria-label$=": pro"]');
    expect(пробная, "кнопки пробного периода у pro не нашлось — проверка ниже пустая").not.toBeNull();
    expect(пробная?.disabled, "пробный период погашен у продаваемого тарифа").toBe(false);
  });
});
