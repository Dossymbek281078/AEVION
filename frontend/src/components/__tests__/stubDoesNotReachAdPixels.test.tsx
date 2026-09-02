import { describe, test, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { сигналОПокупке } from "@/lib/adPurchaseSignal";

/**
 * Тестовая покупка не доходит до рекламных кабинетов.
 *
 * ЗАЧЕМ ИМЕННО СТЫК. Обе половины по отдельности исправны и проверены:
 * компонент возврата кладёт признак заглушки в meta, а признак покупки для
 * пикселей отбрасывает всё, у чего `meta.stub === true`. Между ними — ЗНАЧЕНИЕ,
 * и 01.09.2026 оно расходилось: компонент искал `stub === "1"`, а адрес
 * заглушки строится как `?stub=true`, поэтому для НАСТОЯЩЕЙ заглушки в meta
 * уходило `stub: false`.
 *
 * Следствие денежное и тихое: выдуманная покупка уходила в Meta и TikTok, где
 * выглядит успехом и учит кабинет искать похожих людей. Бюджет тратится на
 * тех, кто не платит, а отчёт при этом красивый.
 *
 * Поэтому здесь не проверяется ни одна половина отдельно — проверяется, что
 * выход первой годится входу второй.
 */

let query = "";
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

/** Что компонент отправил в воронку — то же, что получат пиксели. */
function отправленное() {
  return trackSpy.mock.calls.at(-1)?.[0] as {
    value?: number;
    meta?: Record<string, unknown>;
  };
}

describe("заглушка не доходит до рекламных кабинетов", () => {
  test("возврат заглушки НЕ даёт сигнала пикселям", () => {
    query = "paid=1&stub=true";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" value={19} />);
    expect(
      сигналОПокупке(отправленное()),
      "выдуманная покупка ушла бы в Meta и TikTok — кабинет начал бы искать неплатящих",
    ).toBeNull();
  });

  test("контроль: настоящая покупка сигнал ДАЁТ", () => {
    // Без этого «заглушка не проходит» означало бы «не проходит ничего», и
    // проверка выше подтверждала бы сама себя.
    query = "paid=1";
    render(<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" value={19} />);
    const сигнал = сигналОПокупке(отправленное());
    expect(сигнал, "настоящая покупка не дошла до пикселей").not.toBeNull();
    expect(сигнал?.деньги?.value, "сумма покупки потерялась на стыке").toBe(19);
  });

  test("возврат Gumroad не дублирует Purchase в Meta", () => {
    // Граница, записанная в самом признаке: Gumroad шлёт Purchase сам, и наш
    // поверх дал бы двойной счёт. TikTok шлём всегда — у Gumroad поле только
    // для Facebook.
    query = "paid=1";
    render(<PurchaseReturnTracker source="bureau" provider="gumroad" successParam="paid" value={19} />);
    const сигнал = сигналОПокупке(отправленное());
    expect(сигнал?.вMeta, "двойной счёт покупки в Meta").toBe(false);
    expect(сигнал?.вTikTok).toBe(true);
  });
});
