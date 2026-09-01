import { describe, test, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Отметка «покупка завершена» на странице возврата: ставится ровно один раз и
 * только при успехе.
 *
 * Проверяется ПОВЕДЕНИЕ, а не наличие вызова в исходнике. Расположение
 * стережёт everyPaymentReturnIsCounted.guard.test.ts, но он не отличит отметку,
 * которая срабатывает на каждой перерисовке, от правильной: обе выглядят
 * одинаково. А страницы возврата перерисовываются (загрузка данных о платеже,
 * смена языка), и повторное событие завысило бы число продаж — то есть
 * испортило бы ровно ту цифру, ради точности которой отметка и ставится.
 */

let query = "";

/**
 * Новый объект на КАЖДЫЙ вызов — так же, как это делает Next.
 *
 * Первая версия мока держала один объект и переиспользовала его. Тогда массив
 * зависимостей `useEffect` сам гасил повтор, и проверка «перерисовка не
 * добавляет продажи» проходила ДАЖЕ БЕЗ защиты в компоненте: мутация выжила.
 * Настоящий риск ровно в обратном — ссылка меняется, эффект запускается снова
 * и продажа считается дважды.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

const trackSpy = vi.fn();
vi.mock("@/lib/track", () => ({ track: (p: unknown) => trackSpy(p) }));

// eslint-disable-next-line import/first
import { PurchaseReturnTracker } from "../PurchaseReturnTracker";

beforeEach(() => {
  trackSpy.mockReset();
  query = "";
});

describe("отметка возврата после оплаты", () => {
  test("несёт тариф, сумму и поля страницы", () => {
    // Заведено 31.08.2026 по замечанию соседнего окна: оно не заменило свой
    // учёт на этот компонент, потому что тот не умел `tier`, `value` и
    // `period`, а событие без них не отвечает на вопрос, ЧТО покупают.
    // Инструмент, который беднее места применения, обходят — и правильно.
    query = "paid=1";
    render(
      <PurchaseReturnTracker
        source="pricing"
        provider="lemonsqueezy"
        successParam="paid"
        tier="full"
        value={49}
        meta={{ period: "annual", variant: "hero-b" }}
      />,
    );
    expect(trackSpy).toHaveBeenCalledTimes(1);
    const p = trackSpy.mock.calls[0][0] as {
      tier?: string; value?: number; meta: Record<string, unknown>;
    };
    expect(p.tier).toBe("full");
    expect(p.value).toBe(49);
    expect(p.meta.period).toBe("annual");
    expect(p.meta.variant).toBe("hero-b");
    // Общие поля никуда не делись — иначе «добавил своё» означало бы
    // «затёр чужое».
    expect(p.meta.provider).toBe("lemonsqueezy");
  });

  test("без tier и value этих полей в событии НЕТ", () => {
    // Пустое поле хуже отсутствующего: `tier: undefined` в воронке читается
    // как «тариф неизвестен», а не как «страница его не знает».
    query = "paid=1";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />);
    const p = trackSpy.mock.calls[0][0] as Record<string, unknown>;
    expect("tier" in p, "поле tier появилось само").toBe(false);
    expect("value" in p, "поле value появилось само").toBe(false);
  });

  test("successValue=\"*\" отмечает при ЛЮБОМ непустом значении", () => {
    // Заведено 31.08.2026 ради /qpaynet/deposit/success: провайдер возвращает
    // туда `?cid=<uuid>`, то есть признак успеха ЕСТЬ, но он не равен
    // фиксированной строке. До этого страница работала без признака вовсе и
    // отмечала покупку при любом заходе — считались посещения, а не покупки.
    query = "cid=7f3a1c2e-0000-4444-8888-abcdefabcdef";
    render(<PurchaseReturnTracker source="qpaynet-deposit" provider="qpaynet" successParam="cid" successValue="*" />);
    expect(trackSpy).toHaveBeenCalledTimes(1);
  });

  test("successValue=\"*\" МОЛЧИТ, когда параметра нет", () => {
    // Обратная сторона, ради которой всё и делалось: голое открытие адреса
    // покупкой не считается. Без этой проверки предыдущая была бы зелёной и
    // при отметке, которая срабатывает всегда.
    query = "";
    render(<PurchaseReturnTracker source="qpaynet-deposit" provider="qpaynet" successParam="cid" successValue="*" />);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  test("successValue=\"*\" молчит и на пустом значении", () => {
    // `?cid=` без значения — это не успех, а обрезанный адрес.
    query = "cid=";
    render(<PurchaseReturnTracker source="qpaynet-deposit" provider="qpaynet" successParam="cid" successValue="*" />);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  test("при успехе отмечает покупку один раз", () => {
    query = "paid=1&reference=ref-9";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    const payload = trackSpy.mock.calls[0][0] as {
      type: string;
      source: string;
      meta: Record<string, unknown>;
    };
    expect(payload.type).toBe("checkout_success");
    expect(payload.source).toBe("bureau");
    expect(payload.meta.provider).toBe("stripe");
    expect(payload.meta.reference).toBe("ref-9");
  });

  test("перерисовка НЕ добавляет второй продажи", () => {
    query = "paid=1";
    const view = render(
      <PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />,
    );
    view.rerender(
      <PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />,
    );
    view.rerender(
      <PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />,
    );
    expect(trackSpy).toHaveBeenCalledTimes(1);
  });

  test("отказ оплаты покупкой не считается", () => {
    query = "paid=0";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  test("без параметра успеха сам факт возврата считается покупкой", () => {
    // Так устроен /qpaynet/deposit/success: провайдер ведёт туда только после
    // оплаты, отдельного признака в адресе нет.
    query = "cid=chk-3";
    render(<PurchaseReturnTracker source="qpaynet-deposit" provider="qpaynet" />);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    const payload = trackSpy.mock.calls[0][0] as { meta: Record<string, unknown> };
    expect(payload.meta.checkoutId).toBe("chk-3");
  });
});

describe("заглушка не считается настоящей покупкой", () => {
  /**
   * 🔴 Находка соседнего окна, 01.09.2026: здесь стояло `stub === "1"`, а адрес
   * заглушки строится как `?stub=true&tier=free`. То есть для НАСТОЯЩЕЙ
   * заглушки признак был false, и тестовая покупка уходила в воронку как
   * настоящая — а оттуда в сводку выручки и в рекламные пиксели, где выглядит
   * успехом и уводит бюджет.
   */
  test("stub=true помечается заглушкой", () => {
    query = "paid=1&stub=true";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />);
    const p = trackSpy.mock.calls.at(-1)?.[0] as { meta: Record<string, unknown> };
    expect(p.meta.stub, "настоящая заглушка учтена как настоящая покупка").toBe(true);
  });

  test("stub=1 тоже помечается — прежнее написание не сломано", () => {
    query = "paid=1&stub=1";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />);
    const p = trackSpy.mock.calls.at(-1)?.[0] as { meta: Record<string, unknown> };
    expect(p.meta.stub).toBe(true);
  });

  test("без пометки покупка считается настоящей", () => {
    // Контроль: иначе «всё заглушка» прошло бы так же зелено.
    query = "paid=1";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />);
    const p = trackSpy.mock.calls.at(-1)?.[0] as { meta: Record<string, unknown> };
    expect(p.meta.stub, "настоящая покупка помечена заглушкой").toBe(false);
  });
});
