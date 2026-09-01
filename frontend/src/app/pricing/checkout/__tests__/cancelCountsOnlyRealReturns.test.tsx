import { describe, test, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { StrictMode } from "react";

/**
 * Отмена оплаты считается только при настоящем возврате из кассы.
 *
 * Замер 31.08.2026: событие `checkout_cancel` уходило БЕЗУСЛОВНО, при каждом
 * открытии `/pricing/checkout/cancel`. Значит доля брошенных оплат завышалась —
 * а по ней судят, работает ли касса.
 *
 * Класс тот же, что нашёлся в этот день на соседней странице успеха, но тише:
 * завышенное число продаж заметят, завышенный отказ выглядит как честная
 * воронка и вопросов не вызывает. Адрес при этом был в карте сайта, то есть
 * открывали его и поисковики.
 *
 * Признак настоящего возврата есть: сюда возвращают ровно две кассы, и каждая
 * помечает себя — `?paybox=1` и `?paypal=1`. Lemon Squeezy свой адрес отмены не
 * задаёт и сюда не возвращает, поэтому её отсутствие — не пропуск.
 *
 * Проверяется ПОВЕДЕНИЕ, а не наличие вызова в исходнике: отметку, которая
 * срабатывает всегда, от правильной по тексту не отличить.
 */

let query = "";

/**
 * Новый объект на каждый вызов — так же, как это делает Next. Один общий объект
 * гасил бы повтор сам, массивом зависимостей, и проверка «перерисовка не
 * добавляет отказов» проходила бы даже без защиты в странице.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

const trackSpy = vi.fn();
vi.mock("@/lib/track", () => ({ track: (p: unknown) => trackSpy(p) }));

vi.mock("@/lib/pricingI18n", () => ({ usePricingT: () => (k: string) => k }));

// eslint-disable-next-line import/first
import CancelPage from "../cancel/page";

beforeEach(() => {
  trackSpy.mockReset();
  query = "";
});

describe("страница отмены считает только настоящие возвраты", () => {
  test("возврат от PayBox отмечается один раз", () => {
    query = "paybox=1&tier=full";
    render(<CancelPage />);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    const p = trackSpy.mock.calls[0][0] as { type: string; tier?: string; meta: Record<string, unknown> };
    expect(p.type).toBe("checkout_cancel");
    expect(p.meta.provider).toBe("paybox");
  });

  test("возврат от PayPal тоже отмечается", () => {
    query = "paypal=1";
    render(<CancelPage />);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect((trackSpy.mock.calls[0][0] as { meta: Record<string, unknown> }).meta.provider).toBe("paypal");
  });

  test("двойной вызов эффекта НЕ добавляет второго отказа", () => {
    // Ради этого защёлка и стоит. React в строгом режиме вызывает эффект
    // ДВАЖДЫ — так разработчик видит несохранённые побочные действия. Без
    // взведения защёлки один отказ человека посчитался бы за два, и доля
    // брошенных оплат выросла бы на ровном месте.
    //
    // Прежняя редакция проверяла «вызвано один раз» на обычной отрисовке и
    // проходила БЕЗ защёлки: условий для повтора она не создавала, то есть
    // утверждала больше, чем мерила. Показала это мутация, а не чтение.
    query = "paybox=1&tier=full";
    render(
      <StrictMode>
        <CancelPage />
      </StrictMode>,
    );
    expect(trackSpy, "двойной вызов эффекта посчитал один отказ за два").toHaveBeenCalledTimes(1);
  });

  test("перерисовка НЕ добавляет второго отказа", () => {
    // Мутация показала, что прежний «отмечается один раз» проходил и БЕЗ
    // защёлки: в прогоне эффект и так вызывается однажды, условия для повтора
    // тест не создавал. То есть проверка утверждала больше, чем мерила.
    //
    // Здесь повтор создаётся честно: перерисовка с НОВЫМ объектом параметров —
    // так же, как это делает Next. Без взведения защёлки один отказ человека
    // посчитался бы за два, и доля брошенных оплат выросла бы на ровном месте.
    query = "paybox=1&tier=full";
    const { rerender } = render(<CancelPage />);
    rerender(<CancelPage />);
    rerender(<CancelPage />);
    expect(trackSpy, "перерисовка добавила отказов").toHaveBeenCalledTimes(1);
  });

  test("голое открытие адреса отказом НЕ считается", () => {
    // Ради этого всё и делалось: человек, открывший адрес из истории или
    // поисковый робот, не должен попадать в долю брошенных оплат.
    query = "";
    render(<CancelPage />);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  test("открытие с посторонним параметром тоже не считается", () => {
    // Признаком считается ИМЕННО метка кассы, а не любой параметр в адресе:
    // иначе ссылка с меткой канала засчитывалась бы как отказ.
    query = "c=tt&utm_source=tiktok";
    render(<CancelPage />);
    expect(trackSpy).not.toHaveBeenCalled();
  });
});
