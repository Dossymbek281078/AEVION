import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { STANDALONE_APPS, standaloneApp, termPricePerMonth } from "@/lib/termPricing";

/**
 * ХОЛОДНЫЙ ПОСЕТИТЕЛЬ ВИДИТ ЦЕНУ И КНОПКУ — в первом экране, без метки в адресе.
 *
 * Повод. Замер 29.09.2026 живым браузером на 390 px: пришедший на /pricing без
 * ?module= не видел в первом экране НИ ОДНОЙ цены. Первое похожее на деньги —
 * виджет экономии ИИ ($1.60) на 1.1 экрана; первая цена тарифа — $400/мес на
 * 2.4 экрана; самое дешёвое, что можно купить, — на 8.9 экрана при длине
 * страницы 23.5 экрана. Воронка за 14 дней: до цен дошли 22 человека, кнопку
 * покупки не нажал ни один.
 *
 * Карточка входа в коде БЫЛА, но показывалась только пришедшим с /cyberchess и
 * подобных. Этот сторож держит то, что она показывается и БЕЗ метки.
 *
 * Чего он намеренно НЕ проверяет: положение на экране в пикселях. Стенд не
 * раскладывает страницу, координаты в нём выдуманные. Положение меряется
 * браузером на проде; здесь — только наличие цены и кнопки у холодного входа.
 */

function ответыСервера() {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      const h = { ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true } } };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: [],
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
  return document.body.textContent ?? "";
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("холодный посетитель /pricing", () => {
  it("видит название входа, его цену и кнопку покупки", async () => {
    ответыСервера();
    const текст = await отрисовать();

    // Вход по умолчанию — CyberChess: у него свой вариант в кассе, и касса
    // честна ($24 и «$24.00 billed every month»), тогда как у более дешёвого
    // QSkyway касса 29.09 писала «$400.00 billed every month» при сумме $16.
    const вход = standaloneApp("cyberchess");
    expect(вход, "cyberchess пропал из STANDALONE_APPS — вход по умолчанию не продаётся").toBeTruthy();

    // 🔴 Проверяем ИМЕННО карточку входа, а не совпадение слов на странице.
    // Первая версия этого сторожа искала «CyberChess» и «24» в тексте всей
    // страницы — и оставалась зелёной с УБРАННОЙ карточкой: те же слова стоят
    // ниже, в блоке отдельных приложений (8.9 экрана вниз). Мутация это
    // поймала, проверка переписана на признак карточки.
    const карточка = document.querySelector('[data-hero-entry="cold"]');
    expect(карточка, "карточки входа для холодного посетителя нет вовсе").not.toBeNull();
    const вКарточке = (карточка?.textContent || "").trim();

    expect(вКарточке, "в карточке входа нет названия").toContain(вход!.name);

    // Цену берём из ТОГО ЖЕ источника, что и карточка: иначе сторож начнёт
    // охранять собственное число, а не то, что видит человек.
    const цена = termPricePerMonth(вход!.baseMonthly, "lite");
    expect(
      вКарточке.includes(String(цена)),
      `в карточке входа нет цены ${цена} — холодный посетитель снова без цены`,
    ).toBe(true);

    const кнопкаВКарточке = [...(карточка?.querySelectorAll("button") ?? [])]
      .map((b) => (b.textContent || "").trim())
      .find((подпись) => подпись.includes(вход!.name));
    expect(кнопкаВКарточке, "в карточке входа нет кнопки покупки").toBeTruthy();

    // И порядок: кнопка покупки в карточке входа идёт в документе РАНЬШЕ
    // кнопок блока приложений — иначе «показали» превратится в «показали внизу».
    const всеКнопки = [...document.querySelectorAll("button")];
    const перваяСИменем = всеКнопки.findIndex((b) => (b.textContent || "").includes(вход!.name));
    const вКарточкеИндекс = всеКнопки.findIndex((b) => карточка!.contains(b) && (b.textContent || "").includes(вход!.name));
    expect(
      вКарточкеИндекс >= 0 && вКарточкеИндекс === перваяСИменем,
      "кнопка входа не первая: человек доберётся до неё только прокруткой",
    ).toBe(true);
  }, 120000);

  it("КОНТРОЛЬ: вход по умолчанию — из списка продаваемых отдельно", async () => {
    // Если завтра входом сделают модуль, который отдельно НЕ продаётся,
    // карточка покажет «входит в любой тариф» и кнопки покупки не будет —
    // проверка выше покраснеет. Здесь называем причину прямо.
    const слаги = STANDALONE_APPS.map((a) => a.slug);
    expect(слаги, "cyberchess больше не продаётся отдельно — переставьте вход").toContain("cyberchess");
  });

  it("КОНТРОЛЬ: прибор различает присутствие и отсутствие", async () => {
    ответыСервера();
    const текст = await отрисовать();
    // Выдуманное имя не должно находиться: иначе toContain находит что угодно
    // и первая проверка зелёная по построению.
    expect(текст).not.toContain("QNesuschestvuyuschiy");
  }, 120000);
});
