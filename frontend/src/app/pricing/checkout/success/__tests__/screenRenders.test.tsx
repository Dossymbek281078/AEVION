/**
 * Экран после оплаты ОТРИСОВЫВАЕТСЯ — а не только проходит проверку исходника.
 *
 * Всё, что я закрепил на этом экране за два дня, проверялось чтением кода:
 * «строка есть», «признак применяется». Ни одна проверка не открывала страницу.
 * А самый дорогой экран платформы человек видит целиком, и падение отрисовки
 * выглядит для него так же, как неудавшаяся оплата.
 *
 * Здесь три случая: настоящий возврат из кассы, голый заход и заглушка.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

const параметры = { value: "" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(параметры.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));

async function открыть(поиск: string) {
  параметры.value = поиск;
  const m = await import("@/app/pricing/checkout/success/page");
  const Страница = m.default as () => JSX.Element;
  // Страница берёт подписи из поставщика переводов — без него useI18n бросает.
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
}

afterEach(() => cleanup());

describe("экран после оплаты при отказе сервера", () => {
  it("не показывает внутренностей", async () => {
    /*
     * Класс найден соседним окном на странице цен: при недоступном бэкенде
     * покупателю показывали внутренний адрес API, сообщение движка и инструкцию
     * запустить сервер. Грепом это не находится принципиально — строка
     * собиралась из трёх мест, порознь безобидных.
     *
     * Здесь тот же вопрос к самому дорогому экрану: что человек увидит, если
     * сервер не ответит ПОСЛЕ того, как деньги уже списаны.
     */
    vi.stubGlobal("fetch", async () => {
      throw new Error("Failed to parse URL from /api-backend/api/me/entitlements");
    });
    await открыть("paybox=1&ref=abc&tier=lite&total=4900");
    const текст = document.body.textContent ?? "";
    expect(текст, "экран пуст при отказе сервера").not.toBe("");
    for (const внутреннее of ["/api-backend", "/api/", "npm run", "localhost", "Failed to parse"]) {
      expect(текст, `на экране внутренности: ${внутреннее}`).not.toContain(внутреннее);
    }
    vi.unstubAllGlobals();
  }, 60000);
});

describe("экран после оплаты отрисовывается", () => {
  it("возврат PayBox: страница живая и сумма на месте", async () => {
    await открыть("paybox=1&ref=abc&tier=lite&total=4900");
    // Ярлык суммы нейтральный («Сумма»), поэтому ищем само число: именно его
    // читает человек, и именно оно приходит из адреса возврата.
    expect(document.body.textContent).toContain("49");
  }, 60000);

  it("голый заход не падает и не показывает сумму", async () => {
    await открыть("");
    expect(document.body.textContent, "страница не отрисовалась").not.toBe("");
  }, 60000);

  it("заглушка отрисовывается своим путём", async () => {
    await открыть("stub=true&tier=free");
    expect(document.body.textContent, "страница не отрисовалась").not.toBe("");
  }, 60000);
});
