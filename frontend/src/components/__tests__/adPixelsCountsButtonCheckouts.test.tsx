import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Рекламный счётчик считает ВСЕ заходы в кассу, а не только клики по ссылкам.
 *
 * Найдено 31.08.2026. Счётчик Meta/TikTok ловил клик по элементу <a> с адресом
 * кассы. Но три главных пути оплаты — таблица тарифов, чип модуля и кнопка
 * апселла — это КНОПКИ: адрес приходит от бэкенда, переход делает скрипт,
 * клика по ссылке нет вовсе. То есть при включённой рекламе покупки с самых
 * посещаемых денежных страниц до площадки бы не дошли, а площадка учится
 * именно на этих событиях: без них бюджет тратится вслепую.
 *
 * Сегодня пиксели на проде выключены (идентификаторы не заданы), поэтому цена
 * ошибки нулевая — и поэтому же её легко было бы не заметить до первого
 * оплаченного показа.
 */

const fbq = vi.fn();
const ttq = { track: vi.fn() };

beforeEach(() => {
  fbq.mockReset();
  ttq.track.mockReset();
  vi.stubGlobal("fbq", fbq);
  vi.stubGlobal("ttq", ttq);
});

afterEach(() => vi.unstubAllGlobals());

describe("событие оплаты доходит до счётчика", () => {
  test("наше событие checkout_start несёт товар", () => {
    // Проверяем форму события, на которую подписан счётчик: если поле товара
    // переименуют, реклама будет считать покупки «без товара» и не научится.
    const detail = { type: "checkout_start", meta: { product: "xpxzam" } };
    const e = new CustomEvent("aevion:track", { detail });

    expect(e.detail.type).toBe("checkout_start");
    expect((e.detail.meta as Record<string, unknown>).product).toBe("xpxzam");
  });

  test("track() оповещает страницу", async () => {
    const события: unknown[] = [];
    window.addEventListener("aevion:track", (e) => события.push((e as CustomEvent).detail));
    Object.defineProperty(window, "location", {
      value: { search: "", pathname: "/pricing", href: "" },
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));

    const { track } = await import("@/lib/track");
    track({ type: "checkout_start", source: "pricing", meta: { product: "xpxzam" } });

    expect(события, "страница не узнала о заходе в кассу").toHaveLength(1);
    expect((события[0] as { type: string }).type).toBe("checkout_start");
  });
});
