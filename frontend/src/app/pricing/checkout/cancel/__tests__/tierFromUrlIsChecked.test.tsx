/**
 * Тариф из адреса проверяется по списку, а не берётся на веру.
 *
 * На экране отмены значение попадает в ТРИ места: адрес кнопки
 * `/pricing/<тариф>`, её подпись и событие учёта. Страницы тарифов живут на
 * динамическом маршруте, поэтому любое значение что-то отрисует — и по
 * подобранной ссылке кнопка возврата вела бы в никуда, на нашем экране
 * печатался бы чужой текст, а в учёт уходил бы мусорный тариф.
 *
 * Проверка нужна на КАЖДОМ источнике, а не только на памяти вкладки: адрес —
 * самый доступный посторонему.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { запомнитьНамерение } from "@/lib/checkoutIntent";

const параметры = { объект: new URLSearchParams("") };
vi.mock("next/navigation", () => ({
  useSearchParams: () => параметры.объект,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/cancel",
}));

async function открыть(поиск: string) {
  параметры.объект = new URLSearchParams(поиск);
  const m = await import("@/app/pricing/checkout/cancel/page");
  const Страница = m.default as () => JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
  return {
    ссылки: Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? ""),
    текст: document.body.textContent ?? "",
  };
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const ЧУЖИЕ = ["evil", "constructor", "../admin", "https://example.test"];

describe("тариф из адреса", () => {
  it.each(ЧУЖИЕ)("«%s» не становится кнопкой возврата", async (значение) => {
    const { ссылки, текст } = await открыть(`paybox=1&tier=${encodeURIComponent(значение)}`);
    expect(текст, "экран пуст — проверять нечего").not.toBe("");
    const ведётТуда = ссылки.some((h) => h.includes(значение));
    expect(ведётТуда, `подобранное значение ${значение} попало в адрес кнопки`).toBe(false);
    expect(текст, `подобранное значение ${значение} напечатано на экране`).not.toContain(значение);
  }, 60000);

  it("настоящий тариф из адреса по-прежнему работает", async () => {
    // Контроль: без него «ничего не показываем» выглядело бы починкой.
    const { ссылки } = await открыть("paybox=1&tier=lite");
    expect(ссылки, "настоящий тариф перестал давать кнопку").toContain("/pricing/lite");
  }, 60000);

  it("память вкладки тоже проверяется", async () => {
    // В память кладём напрямую, минуя запомнитьНамерение: так делает старая
    // запись, оставшаяся от прежней версии кода.
    sessionStorage.setItem(
      "aevion_checkout_intent",
      JSON.stringify({ tier: "evil", ts: Date.now() }),
    );
    const { ссылки } = await открыть("paybox=1");
    expect(ссылки.some((h) => h.includes("evil")), "мусор из памяти попал в кнопку").toBe(false);
  }, 60000);

  it("память с настоящим тарифом работает", async () => {
    запомнитьНамерение("full", "monthly");
    const { ссылки } = await открыть("paybox=1");
    expect(ссылки, "память с настоящим тарифом перестала работать").toContain("/pricing/full");
  }, 60000);
});
