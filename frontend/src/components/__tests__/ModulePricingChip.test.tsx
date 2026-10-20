// 20.10.2026 (окно «Приложения»): якорь подписки — кнопка оплаты Планеты (/pricing#planet-buy), не верх блока #tiers:
// тарифы приходят после загрузки, и верхний якорь не крутил вовсе — см. lib/products.ts (PRICING_TERMS).
/**
 * Плашка цены на странице модуля называет цены ЛЕСТНИЦЫ СРОКОВ (политика
 * 15.09.2026) и ведёт туда, где их можно оплатить.
 *
 * До 15.09 плашка читала /api/pricing и показывала помесячные тарифы
 * Lite/Medium/Full — этих тарифов больше нет. Теперь:
 *   · одно из пяти приложений → «от $X/мес», «<имя> отдельно», «вся планета от $200/мес»;
 *   · любой другой модуль     → «Входит в подписку AEVION · от $200/мес».
 * Числа — из @/lib/termPricing; снятые цены на плашке появиться не должны.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";
import { STANDALONE_APPS, TERM_TIERS, fromPricePerMonth, termPricePerMonth, planetFromPerMonth } from "@/lib/termPricing";
import { predlagaemOtdelno } from "@/lib/neProdayotsyaOtdelno";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function guest() {
  globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
}

/**
 * Гость, которому касса ОТВЕТИЛА списком продаваемых ссылок.
 * Нужен потому, что «от $X» обязано называть цену, которую можно заплатить:
 * у четырёх приложений длинные сроки в кассе не заведены (28.09.2026).
 */
function гостьСоСписком(ссылки: string[]) {
  globalThis.fetch = vi.fn(async (u: unknown) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      return {
        ok: true,
        json: async () => ({ providers: { lemonsqueezy: { sellable: { configured: ссылки } } } }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe("ModulePricingChip — цены лестницы сроков", () => {
  /*
   * 🔴 12.10.2026: перебор идёт по тем приложениям, которые мы ПРЕДЛАГАЕМ
   * отдельно. Бюро из предложения убрано прямым словом основателя (причина — в
   * lib/neProdayotsyaOtdelno.ts), и ждать от его плашки «своей цены» значило бы
   * требовать от кода того, что решено не делать.
   * Знаменатель не прячется: отдельная проверка ниже утверждает, что убрано
   * РОВНО одно приложение, а не половина каталога.
   */
  it("🔴 знаменатель перебора: из каталога убрано ровно одно приложение", () => {
    const предлагаемые = STANDALONE_APPS.filter((a) => predlagaemOtdelno(a.slug));
    // 19.10.2026: один план — отдельно предлагаются только шахматы.
    expect(STANDALONE_APPS.length - предлагаемые.length, "из предложения убрано не восемь приложений").toBe(STANDALONE_APPS.length - 1);
    expect(предлагаемые.map((a) => a.slug)).toEqual(["cyberchess"]);
    expect(предлагаемые.some((a) => a.slug === "ip_bureau")).toBe(false);
  });

  it.each(STANDALONE_APPS.filter((a) => predlagaemOtdelno(a.slug)).map((a) => [a.moduleId, a] as const))(
    "приложение %s: своя цена «от», имя и цена всей планеты",
    (moduleId, app) => {
      guest();
      const { container } = render(<ModulePricingChip moduleId={moduleId} />);
      const text = container.textContent ?? "";
      // Список не пришёл (guest) — называем цену МЕСЯЦА, а не самого
      // длинного срока: незнание не имеет права обещать скидку.
      // 19.10.2026: годовое приложение показывает «$50/год», а не цену месяца.
      expect(text).toContain(app.yearOnlyUsd != null ? `$${app.yearOnlyUsd}/год` : `$${termPricePerMonth(app.baseMonthly, "lite")}`);
      expect(text).toContain(app.name);
      expect(text).toContain(`от $${planetFromPerMonth()}/мес`); // 19.10: своя лесенка плана
      const buy = screen.getByText("Купить").closest("a")!;
      expect(buy.getAttribute("href")).toBe(`/pricing?app=${app.slug}#apps`);
    },
  );

  it("годовое приложение: касса продаёт только max — плашка называет $50/год, не цену месяца", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!; // 19.10: единственное предлагаемое отдельно, годовое
    гостьСоСписком([`app_${app.slug}_max`]);
    const { container } = render(<ModulePricingChip moduleId={app.moduleId} />);
    const месяц = termPricePerMonth(app.baseMonthly, "lite");
    const длинный = fromPricePerMonth(app.baseMonthly);
    // Ждать обязательно: список приходит запросом, и без ожидания проверка
    // видит только начальное значение — то есть проходит по случайности.
    await waitFor(() => expect(container.textContent ?? "").toContain(`$${app.yearOnlyUsd}/год`));
    expect(container.textContent ?? "").not.toContain(`$${месяц}`);
    expect(длинный).toBeLessThan(месяц);
    // Главное утверждение: цены, которую заплатить НЕЛЬЗЯ, на странице нет.
    // Замер 28.09 на живом проде: /qskyway обещал «от $8» при настоящих $16.
    expect(container.textContent ?? "").not.toContain(`$${длинный}/мес`);
  });

  it("КОНТРОЛЬ: даже если касса объявит все сроки, годовое приложение не превращается в лестницу", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!; // 19.10: единственное предлагаемое отдельно, годовое
    гостьСоСписком(TERM_TIERS.map((t) => `app_${app.slug}_${t}`));
    const { container } = render(<ModulePricingChip moduleId={app.moduleId} />);
    // Без этого случая проверка выше проходила бы и на коде «всегда месяц»,
    // то есть не отличала бы починку от новой неправды в другую сторону.
    await waitFor(() =>
      expect(container.textContent ?? "").toContain(`$${app.yearOnlyUsd}/год`),
    );
  });

  it("модуль вне пяти: входит в подписку, отдельной цены нет", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="qlearn" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Входит в подписку AEVION");
    expect(text).toContain(`$${planetFromPerMonth()}`);
    expect(text).not.toContain("отдельно");
    expect(screen.getByText("Купить").closest("a")!.getAttribute("href")).toBe("/pricing#planet-buy");
  });

  /*
   * 🔴 ПЕРЕПИСАНО 12.10.2026 по прямому слову основателя «убрать кнопку бюро».
   *
   * Проверка закрепляла прежнее решение: плашка бюро показывала СВОЮ цену как
   * отдельного товара. Решение изменилось, и причина названа в
   * lib/neProdayotsyaOtdelno.ts: модуль открыт бесплатно (стены нет), а
   * Verified купить нельзя — проверка личности заглушка, провайдер платежей
   * настроен неверно. Продавать в таком виде значит обещать ложь.
   *
   * Поэтому теперь проверяется ПРОТИВОПОЛОЖНОЕ, и это не подгонка под зелёный
   * цвет: имени отдельного товара и его цены на плашке быть НЕ должно, а
   * человек должен видеть, что бюро входит в подписку. Короткий id «bureau»
   * по-прежнему узнаётся — иначе сломался бы экран заплатившего.
   */
  it("🔴 бюро больше не предлагается отдельно: плашка ведёт в подписку, а не в кассу модуля", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="bureau" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Входит в подписку AEVION");
    expect(text, "на плашке осталась отдельная цена бюро").not.toContain("$32");
    expect(text, "бюро всё ещё подаётся как отдельный товар").not.toContain("IP Bureau");
    expect(screen.getByText("Купить").closest("a")!.getAttribute("href")).toBe("/pricing#planet-buy");
  });

  it("снятые цены и имена тарифов на плашке не появляются", () => {
    guest();
    for (const id of ["cyberchess", "qlearn", "devhub"]) {
      const { container } = render(<ModulePricingChip moduleId={id} />);
      const text = container.textContent ?? "";
      expect(text, id).not.toMatch(/\$(19|29|39|49|59|149)(?!\d)|Universe|All-Access/);
      cleanup();
    }
  });

  it("имя приложения не уходит в машинный перевод", () => {
    guest();
    render(<ModulePricingChip moduleId="cyberchess" />);
    const el = screen.getByText(/CyberChess/);
    expect(el.getAttribute("translate")).toBe("no");
  });

  /*
   * 🔴 Слово на кнопке обязано совпадать с тем, что за ней.
   * Замер на проде 07.10.2026: /qright показывал «Buy», ссылка вела на
   * /pricing?app=qright#apps, а там по этому приложению только «Contact us»
   * (среди шести кнопок «Buy» на странице цен QRight нет), и касса отвечает
   * 400 invalid_app. Человек жал «Купить» и попадал в «напишите нам».
   */
  it("нечего купить (список продаваемых пуст) — кнопка зовёт обсудить, а не купить", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!; // 19.10
    гостьСоСписком([]);
    render(<ModulePricingChip moduleId={app.moduleId} />);

    await waitFor(() => {
      expect(
        screen.queryByText("Обсудить доступ"),
        "купить нечего, а кнопка всё ещё обещает покупку",
      ).not.toBeNull();
    });
    expect(
      screen.queryByText("Купить"),
      "«Купить» ведёт на контактную форму — это обещание, которого за кнопкой нет",
    ).toBeNull();
  });

  it("КОНТРОЛЬ: продаваемый срок есть — кнопка снова «Купить»", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!; // 19.10
    гостьСоСписком([`app_${app.slug}_max`]);
    render(<ModulePricingChip moduleId={app.moduleId} />);

    await waitFor(() => {
      expect(
        screen.queryByText("Купить"),
        "продаётся, а кнопка не предлагает купить — проверка перекрыла лишнее",
      ).not.toBeNull();
    });
    expect(screen.queryByText("Обсудить доступ")).toBeNull();
  });
});
