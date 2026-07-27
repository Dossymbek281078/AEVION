import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { FanDiscountPanel } from "@/components/FanDiscountPanel";

/**
 * Два регресс-теста на дефекты, которые нашлись ТОЛЬКО живым прогоном
 * 2026-07-26 (ни `tsc`, ни бэкенд-тесты их не видели).
 *
 * Главный из них — ТУПИК: при разовой ошибке базы `/fan/me` возвращает
 * `appsSource: "unavailable"`, панель показывала «Уровень веера 1 · со скидкой 0
 * модулей» и при этом ПРЯТАЛА ручной выбор (он скрывается, когда веер пришёл с
 * сервера). Покупатель с купленными модулями оставался без веера и без единого
 * способа его увидеть. Правило, которое сторожит этот файл: неполные данные
 * никогда не выдаются за пустой веер, витрина с ручным выбором остаётся.
 */

const PREVIEW = {
  items: [
    { module: "qcontract", listMonthly: 19, ring1: ["qsign", "qright"], ring2Count: 1, ring3Count: 20, ring1SavingMonthly: 5.4 },
    { module: "qsign", listMonthly: 9, ring1: ["qcontract"], ring2Count: 1, ring3Count: 20, ring1SavingMonthly: 5.7 },
  ],
  total: 2,
};

function fanMe(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    level: 2,
    ownedPaid: ["cyberchess", "aevion-ip-bureau"],
    windowDays: 14,
    validUntil: "2026-08-09T12:00:00.000Z",
    ringRatios: { "1": 0.35, "2": 0.2, "3": 0 },
    offers: [
      {
        module: "qcontract", ring: 1, anchor: "aevion-ip-bureau",
        reason: "один контур с aevion-ip-bureau", listMonthly: 19,
        discountPercent: 35, priceMonthly: 12.35, savingMonthly: 6.65,
        availability: "beta", cogsCapped: false,
      },
    ],
    summary: { ring1: 1, ring2: 0, ring3: 20, discounted: 1, maxSavingMonthly: 6.65 },
    appsSource: "db",
    notes: [],
    ...overrides,
  };
}

/** Ответы подставляем по URL — компонент дёргает два разных эндпоинта. */
function mockFetch(handlers: { preview?: unknown; me?: unknown | (() => unknown) }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/fan/preview")
      ? handlers.preview
      : typeof handlers.me === "function"
        ? (handlers.me as () => unknown)()
        : handlers.me;
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => body } as Response;
  });
}

function renderPanel() {
  // Компонент берёт копирайт через usePricingT → нужен I18nProvider.
  // Провайдер стартует с "en", поэтому строки проверяем по английскому словарю.
  return render(
    <I18nProvider>
      <FanDiscountPanel currency="USD" />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem("aevion_auth_token", "test-token");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("FanDiscountPanel", () => {
  it("показывает веер покупателя с сервера и прячет ручной выбор", async () => {
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me: fanMe() }));
    renderPanel();

    await waitFor(() => expect(screen.getByText(/Fan level 2/)).toBeTruthy());
    expect(screen.getByText(/qcontract/)).toBeTruthy();
    // Ручной подбор не нужен: мы знаем, что у человека куплено.
    expect(screen.queryByText(/what do you already own/i)).toBeNull();
  });

  it("🔴 неполные данные НЕ выдаются за пустой веер — ручная витрина остаётся", async () => {
    // Регрессия 2026-07-26: панель залипала в «уровень 1 · 0 модулей» и прятала
    // чипы, оставляя покупателя без единого пути к скидке.
    const unavailable = () => ({ ...fanMe(), appsSource: "unavailable", status: "inactive", level: 1, ownedPaid: [], offers: [], summary: { ring1: 0, ring2: 0, ring3: 0, discounted: 0, maxSavingMonthly: 0 } });
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me: unavailable }));
    renderPanel();

    // Ручной выбор ДОЛЖЕН быть доступен — это единственный оставшийся путь.
    await waitFor(() => expect(screen.getByText(/what do you already own/i)).toBeTruthy());
    // И рядом обязана стоять оговорка: это ПРИКИДКА, а не его скидка. Без неё
    // панель обещала бы то, чего на счёте не будет — чекаут с 2026-07-26 не
    // верит отметкам на странице, владение он проверяет у себя.
    expect(screen.getByText(/This is a preview/i)).toBeTruthy();
    // И мы не утверждаем «скидок нет».
    expect(screen.queryByText(/0 modules discounted/)).toBeNull();
  });

  it("повторяет запрос своего веера, если первый ответ пришёл неполным", async () => {
    let call = 0;
    const me = () => {
      call += 1;
      return call === 1
        ? { ...fanMe(), appsSource: "unavailable", status: "inactive", level: 1, ownedPaid: [], offers: [], summary: { ring1: 0, ring2: 0, ring3: 0, discounted: 0, maxSavingMonthly: 0 } }
        : fanMe();
    };
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me }));
    renderPanel();

    await waitFor(() => expect(screen.getByText(/Fan level 2/)).toBeTruthy(), { timeout: 4000 });
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it("гостю без токена показывается витрина «что будет, если купить»", async () => {
    localStorage.clear();
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW }));
    renderPanel();

    await waitFor(() => expect(screen.getByText(/what do you already own/i)).toBeTruthy());
    expect(screen.getByText(/qcontract/)).toBeTruthy();
  });
});

/**
 * Обратный отсчёт окна — механика удержания, а не украшение.
 *
 * До 2026-07-27 панель рисовала только серую дату закрытия: «до 09.08» за
 * одиннадцать дней и за один выглядели одинаково. У Higgsfield, с которого
 * механика снята, держит именно видимый дедлайн.
 *
 * Число берётся из серверного `daysLeft` — клиент дат не вычитает, иначе
 * разойдётся с сервером на границе суток.
 */
describe("FanDiscountPanel — дедлайн окна", () => {
  it("🔴 последние дни выделены, а не растворены в серой строке", async () => {
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me: fanMe({ daysLeft: 2 }) }));
    renderPanel();
    const el = await screen.findByText(/closes in 2 days/i);
    // Именно выделение: тревожный цвет и жирность, иначе смысла в счётчике нет.
    const style = (el.closest("span") as HTMLElement).style;
    expect(style.fontWeight).toBe("800");
    expect(style.color).toBe("rgb(180, 83, 9)");
  });

  it("✅ когда времени много — обычная строка, без ложной срочности", async () => {
    // Без этой половины проверка выше проходила бы и при «всегда тревожно».
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me: fanMe({ daysLeft: 11 }) }));
    renderPanel();
    const el = await screen.findByText(/closes in 11 days/i);
    const style = (el.closest("span") as HTMLElement).style;
    expect(style.fontWeight).toBe("500");
    expect(style.color).not.toBe("rgb(180, 83, 9)");
  });

  it("последний день назван словами, а не «через 0 дн.»", async () => {
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me: fanMe({ daysLeft: 0 }) }));
    renderPanel();
    expect(await screen.findByText(/closes today/i)).toBeTruthy();
  });

  it("сервер не прислал daysLeft — откатываемся на дату, а не показываем NaN", async () => {
    vi.stubGlobal("fetch", mockFetch({ preview: PREVIEW, me: fanMe() }));
    renderPanel();
    expect(await screen.findByText(/open until/i)).toBeTruthy();
  });
});
