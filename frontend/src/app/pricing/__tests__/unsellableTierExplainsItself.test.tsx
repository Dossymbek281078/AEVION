import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { PLANET_BASE_MONTHLY, STANDALONE_APPS, termPricePerMonth, termTotal } from "@/lib/termPricing";

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
 *
 * 15.09.2026: тариф — это срок. Ссылки заказа `tier_<срок>` и
 * `app_<slug>_<срок>`, периода месяц/год нет. То же правило «незнание не гасит,
 * отсутствие товара — «Связаться», авария — подпись у серой кнопки» теперь
 * действует и на блок отдельных приложений — он проверяется ниже.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing",
}));

const тариф = (id: string, name: string, priceMonthly: number, termMonths: number | null) => ({
  id,
  name,
  tagline: "",
  priceMonthly,
  termMonths,
  priceTermTotal: termMonths === null ? (priceMonthly === 0 ? 0 : null) : priceMonthly * termMonths,
  ctaLabel: "Купить",
  features: [],
  limits: {},
});

/** Тела запросов в кассу — чтобы проверить, ЧТО ушло по нажатию. */
let вКассу: Array<Record<string, unknown>> = [];

// configured = null — healthz ответил, но поля продаваемости в нём НЕТ
// (так было до выкатки 29.08.2026 и так будет при любом сбое сборки ответа).
function ответыСервера(configured: string[] | null, missing: string[] = [], расчётОшибкой = false) {
  вКассу = [];
  vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
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
    if (адрес.includes("checkout/session")) {
      вКассу.push(JSON.parse(String(init?.body ?? "{}")));
      // Ссылки не отдаём: страница покажет «ошибка оплаты» и никуда не уйдёт.
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }
    if (адрес.includes("/pricing/quote") && расчётОшибкой) {
      // Ручка расчёта ответила ошибкой: тело без lines. Раньше это роняло всю /pricing.
      return { ok: false, status: 400, json: async () => ({ error: "bad_request" }) } as unknown as Response;
    }
    if (адрес.includes("/pricing/quote")) {
      // Калькулятор рисует итог и кнопку оплаты только при непустом расчёте.
      // Без этого ответа кнопки нет вовсе, и «кнопка погашена» прошло бы на пустом месте.
      const расчёт = {
        tierId: "pro", termMonths: 6, currency: "USD",
        lines: [], subtotal: 1800, discount: 0, total: 1800, notes: [], promo: null,
      };
      return { ok: true, status: 200, json: async () => расчёт } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 } },
      tiers: [тариф("free", "Free", 0, null), тариф("pro", "Pro", 300, 6), тариф("full", "Full", 250, 9)],
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

/** Выбирает тариф в калькуляторе по имени и ждёт пересчёта (он идёт через 250 мс). */
async function калькуляторНа(имя: string): Promise<HTMLElement> {
  const калькулятор = document.getElementById("calculator");
  expect(калькулятор, "калькулятора на странице нет — проверки ниже пустые").not.toBeNull();
  const переключатель = Array.from(калькулятор!.querySelectorAll("button"))
    .find((b) => (b.textContent ?? "").trim() === имя);
  expect(переключатель, `переключателя «${имя}» в калькуляторе нет`).toBeTruthy();
  await act(async () => { переключатель!.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
  return калькулятор!;
}

/** Кнопка оплаты калькулятора: единственная с ценой вида «… · $…». */
function кнопкаОплатыКалькулятора(калькулятор: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(калькулятор.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => /·\s*\$/.test(b.textContent ?? ""));
}

/** Блок отдельных приложений и карточка одного приложения в нём. */
/**
 * Основная кнопка покупки на карточке срока.
 *
 * До 17.09.2026 проверки «кнопка карточки следует продаваемости» шли через кнопку
 * пробного периода (`button[aria-label$=": pro"]`). Основатель решил, что пробный
 * период не нужен, кнопку сняли — и тот же селектор МОЛЧА попал бы на кнопку
 * калькулятора, у которой подпись оканчивается так же. Проверка осталась бы зелёной,
 * проверяя не то.
 *
 * Поэтому ищем явно: кнопка калькулятора (у неё уникальная подпись `…: <срок>`)
 * лежит в той же карточке, что и основная кнопка покупки; основная — другая кнопка
 * этой карточки. Она гаснет по тому же правилу продаваемости, что и снятая.
 */
function кнопкаПокупкиСрока(id: string): HTMLButtonElement | null {
  const калькуляторКарточки = document.querySelector<HTMLButtonElement>(`button[aria-label$=": ${id}"]`);
  const карточкаСрока = калькуляторКарточки?.parentElement;
  if (!калькуляторКарточки || !карточкаСрока) return null;
  return (
    Array.from(карточкаСрока.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b !== калькуляторКарточки,
    ) ?? null
  );
}

function блокПриложений(): HTMLElement {
  const блок = document.getElementById("apps");
  expect(блок, "блока «Отдельные приложения» на странице нет — проверки ниже пустые").not.toBeNull();
  return блок!;
}
function карточка(slug: string): HTMLElement {
  const к = блокПриложений().querySelector<HTMLElement>(`[data-app="${slug}"]`);
  expect(к, `карточки приложения ${slug} нет`).not.toBeNull();
  return к!;
}
async function срокПриложений(имя: string) {
  const кнопка = Array.from(блокПриложений().querySelectorAll("button"))
    .find((b) => (b.textContent ?? "").trim().startsWith(`${имя} ·`));
  expect(кнопка, `переключателя срока «${имя}» нет`).toBeTruthy();
  await act(async () => { кнопка!.click(); });
}

/** Все ссылки на все сроки и приложения — «продаётся всё». */
const ВСЕ_ССЫЛКИ = [
  "tier_lite", "tier_medium", "tier_pro", "tier_full", "tier_max",
  ...STANDALONE_APPS.flatMap((a) => ["lite", "medium", "pro", "full", "max"].map((t) => `app_${a.slug}_${t}`)),
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("непокупаемый тариф объясняет себя", () => {
  it("тариф без товара (нет ни в одном списке) — вместо цены и кнопок «Связаться»", async () => {
    // full настроен, а pro НЕТ НИ В ОДНОМ списке — товара не существует.
    // Решение основателя: не серые кнопки, а «Связаться», как у Enterprise.
    ответыСервера(["tier_full"], []);
    await отрисовать();
    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=pro")),
      "у тарифа без товара нет пути «связаться»",
    ).toBe(true);
    expect(
      document.querySelector('button[aria-label$=": pro"]'),
      "у тарифа без товара осталась кнопка калькулятора — она ведёт в 503",
    ).toBeNull();
  });

  it("авария кассы (товар объявлен, но не настроен) — подпись и серая кнопка, а не «Связаться»", async () => {
    // Если переменная товара пропала, тариф существует, и прятать цену было бы ложью.
    // Здесь pro — среди НЕнастроенных: прежнее поведение с объяснением у серой кнопки.
    ответыСервера(["tier_full"], ["tier_pro"]);
    await отрисовать();
    const текст = document.body.textContent ?? "";
    expect(текст.length, "страница не отрисовалась вовсе").toBeGreaterThan(0);
    expect(текст, "подписи о недоступности нет").toMatch(/онлайн|online/i);
    const покупка = кнопкаПокупкиСрока("pro");
    expect(покупка, "кнопки покупки у pro не нашлось — проверка ниже пустая").not.toBeNull();
    expect(покупка?.textContent, "нашлась не та кнопка карточки").toContain("Купить");
    expect(покупка?.disabled, "при аварии кассы кнопка покупки осталась живой").toBe(true);
  });

  it("бесплатный тариф подпись «оформить нельзя» не получает никогда", async () => {
    // Free нет в справочнике товаров по определению. Положительный список без
    // исключения повесил бы на него «оформить онлайн пока нельзя».
    ответыСервера(["tier_full"], []);
    await отрисовать();
    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && h.includes("tier=free")),
      "бесплатный тариф назван непокупаемым",
    ).toBe(false);
  });

  it("калькулятор: у непокупаемого тарифа кнопка оплаты погашена и объяснена", async () => {
    // Калькулятор ведёт в ту же кассу, что и карточки. До 14.09.2026 его кнопка
    // на продаваемость не смотрела вовсе — для непокупаемого тарифа она звала бы в 503.
    ответыСервера(["tier_full"], []);
    await отрисовать();
    const калькулятор = await калькуляторНа("Pro");
    const оплата = кнопкаОплатыКалькулятора(калькулятор);
    expect(оплата, "кнопки оплаты в калькуляторе не нашлось — проверка ниже пустая").toBeTruthy();
    expect(оплата!.disabled, "кнопка оплаты калькулятора зовёт в кассу непокупаемого тарифа").toBe(true);
    expect(
      калькулятор.querySelector('a[href="/pricing/contact?tier=pro"]'),
      "в калькуляторе кнопка погасла молча — ссылки на связь нет",
    ).not.toBeNull();
  });

  it("ошибка ручки расчёта не роняет страницу цен", async () => {
    // Калькулятор принимал любой ответ как расчёт: при 400 {error} страница падала
    // на quote.lines.length. Кривой ответ — «расчёта нет», а не падение /pricing.
    ответыСервера(["tier_full", "tier_pro"], [], true);
    await отрисовать();
    const калькулятор = await калькуляторНа("Pro");
    expect((document.body.textContent ?? "").length, "страница упала на кривом ответе расчёта").toBeGreaterThan(0);
    expect(кнопкаОплатыКалькулятора(калькулятор), "при ошибке расчёта появилась кнопка оплаты с ценой").toBeUndefined();
  });

  it("незнание о продаваемости кнопки НЕ гасит и подпись НЕ вешает", async () => {
    // Самое дорогое направление ошибки: если «поля нет» прочитается как
    // «ничего не продаётся», один сбой ответа остановит ВСЕ продажи.
    ответыСервера(null);
    await отрисовать();
    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && (h.includes("tier=pro") || h.includes("app="))),
      "незнание прочитано как «купить нельзя»",
    ).toBe(false);
    const покупка = кнопкаПокупкиСрока("pro");
    expect(покупка, "кнопки покупки у pro не нашлось — проверка ниже пустая").not.toBeNull();
    expect(покупка?.textContent, "нашлась не та кнопка карточки").toContain("Купить");
    expect(покупка?.disabled, "незнание погасило покупку срока").toBe(false);
    const купитьПриложение = карточка("devhub").querySelector("button");
    expect(купитьПриложение, "кнопки покупки приложения нет — проверка ниже пустая").not.toBeNull();
    expect(купитьПриложение!.disabled, "незнание погасило покупку приложения").toBe(false);
  });

  it("контроль: когда всё продаётся, лишней подписи НЕТ", async () => {
    // Без этого контроля проверка выше проходила бы и от подписи, которая
    // висит на странице ВСЕГДА, а это уже шум на рабочем тарифе.
    ответыСервера(ВСЕ_ССЫЛКИ, []);
    await отрисовать();

    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(
      ссылки.some((h) => h.includes("/pricing/contact") && (h.includes("tier=pro") || h.includes("app="))),
      "подпись о недоступности показана на продаваемом тарифе или приложении",
    ).toBe(false);

    const покупка = кнопкаПокупкиСрока("pro");
    expect(покупка, "кнопки покупки у pro не нашлось — проверка ниже пустая").not.toBeNull();
    expect(покупка?.textContent, "нашлась не та кнопка карточки").toContain("Купить");
    expect(покупка?.disabled, "кнопка покупки погашена у продаваемого тарифа").toBe(false);

    const калькулятор = await калькуляторНа("Pro");
    const оплата = кнопкаОплатыКалькулятора(калькулятор);
    expect(оплата, "кнопки оплаты в калькуляторе не нашлось — проверка ниже пустая").toBeTruthy();
    expect(оплата!.disabled, "кнопка оплаты калькулятора погашена у продаваемого тарифа").toBe(false);
    // И подписи в калькуляторе быть не должно. Без этой строки подпись, висящая
    // ВСЕГДА, проходила бы: мутация «показывать подпись калькулятора без условия»
    // выжила — проверка выше смотрела на ссылку до переключения, когда
    // калькулятор стоял на Medium и ссылка вела на tier=medium.
    expect(
      калькулятор.querySelector('a[href="/pricing/contact?tier=pro"]'),
      "в калькуляторе продаваемого тарифа висит «оформить онлайн нельзя»",
    ).toBeNull();
  });
});

describe("отдельные приложения: цена, покупка и продаваемость — по паре «срок + приложение»", () => {
  it("по нажатию в кассу уходит выбранный срок и именно это приложение", async () => {
    ответыСервера(ВСЕ_ССЫЛКИ, []);
    await отрисовать();
    // Контроль: по умолчанию срок Lite, и цена карточки — база приложения.
    expect(карточка("devhub").textContent ?? "").toContain(`$${termPricePerMonth(200, "lite")}`);

    await срокПриложений("Pro");
    const текст = карточка("devhub").textContent ?? "";
    expect(текст, "цена месяца не пересчиталась на выбранный срок").toContain(`$${termPricePerMonth(200, "pro")}`);
    // Платёж за срок печатается рядом (toLocaleString ставит неразрывный пробел в тысячах).
    expect(текст.replace(/\s/g, "")).toContain(`$${termTotal(200, "pro")}`);

    await act(async () => {
      карточка("devhub").querySelector("button")!.click();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(вКассу.length, "нажатие не дошло до кассы — проверка ниже пустая").toBe(1);
    expect(вКассу[0]).toMatchObject({ tierId: "pro", app: "devhub" });
    expect(вКассу[0].period, "в кассу снова уходит период месяц/год").toBeUndefined();
  });

  it("у приложения без товара на этом сроке — «Связаться» с тем же сроком и приложением", async () => {
    ответыСервера(["tier_full", "tier_pro"], []);
    await отрисовать();
    const к = карточка("cyberchess");
    expect(к.querySelector("button"), "у приложения без товара осталась кнопка покупки — она ведёт в 503").toBeNull();
    const ссылки = Array.from(к.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(ссылки, "у приложения без товара нет пути «связаться» с его сроком").toContain(
      "/pricing/contact?tier=lite&app=cyberchess",
    );
  });

  it("продаваемость смотрится по ссылке ВЫБРАННОГО срока, а не любого", async () => {
    // Lite настроен, Max объявлен, но переменная пропала — авария кассы на одном сроке.
    ответыСервера(["tier_full", "app_cyberchess_lite"], ["app_cyberchess_max"]);
    await отрисовать();
    const наLite = карточка("cyberchess").querySelector("button");
    expect(наLite, "кнопки покупки на Lite нет — проверка ниже пустая").not.toBeNull();
    expect(наLite!.disabled, "продаваемый срок погашен").toBe(false);

    await срокПриложений("Max");
    const наMax = карточка("cyberchess").querySelector("button");
    expect(наMax, "на аварийном сроке пропала кнопка — цена спрятана как у отсутствующего товара").not.toBeNull();
    expect(наMax!.disabled, "на сроке с аварией кассы кнопка покупки осталась живой").toBe(true);
    expect(карточка("cyberchess").textContent ?? "").toMatch(/онлайн|online/i);
  });

  it("строка «пять приложений дороже планеты» печатается ровно тогда, когда это верно", async () => {
    ответыСервера(ВСЕ_ССЫЛКИ, []);
    await отрисовать();
    const сумма = STANDALONE_APPS.reduce((s, a) => s + termTotal(a.baseMonthly, "lite"), 0);
    const планета = termTotal(PLANET_BASE_MONTHLY, "lite");
    const строка = document.querySelector('[data-testid="apps-vs-planet"]');
    expect(Boolean(строка), `сумма приложений ${сумма}, планета ${планета}`).toBe(сумма > планета);
    if (строка) {
      const т = (строка.textContent ?? "").replace(/\s/g, "");
      expect(т, "в строке не та сумма приложений").toContain(`$${сумма}`);
      expect(т, "в строке не та цена планеты").toContain(`$${планета}`);
    }
  });
});
