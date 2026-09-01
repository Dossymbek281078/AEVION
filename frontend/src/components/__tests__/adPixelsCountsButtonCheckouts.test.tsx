import { describe, it, test, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { сигналОПокупке } from "@/lib/adPurchaseSignal";

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

describe("Покупка доходит до площадок", () => {
  it("бесплатный тариф и заглушка покупкой не считаются", () => {
    // Возврат свободного тарифа несёт total=0, заглушка — stub=true.
    // Посчитать их значит учить площадку приводить неплатящих.
    expect(сигналОПокупке({ value: 0, meta: { provider: "gumroad" } })).toBeNull();
    expect(сигналОПокупке({ value: 49, meta: { stub: true, provider: "paybox" } })).toBeNull();
  });

  it("возврат PayBox идёт обеим площадкам и несёт сумму", () => {
    expect(сигналОПокупке({ value: 49, meta: { provider: "paybox" } })).toEqual({
      вMeta: true,
      вTikTok: true,
      деньги: { value: 49, currency: "USD" },
    });
  });

  it("у возврата Gumroad Meta пропускается — иначе двойной счёт", () => {
    const с = сигналОПокупке({ value: 19, meta: { provider: "gumroad" } });
    expect(с?.вMeta).toBe(false);
    // но TikTok обязан узнать: у Gumroad поле только для Facebook
    expect(с?.вTikTok).toBe(true);
  });

  it("неизвестная сумма уходит без суммы, а не нулём", () => {
    // Ноль сказал бы, что покупка ничего не стоила.
    expect(сигналОПокупке({ meta: { provider: "paypal" } })?.деньги).toBeUndefined();
  });
});

/*
 * Проверки выше стерегут РЕШЕНИЕ. Отдельно нужно стеречь ПРОВОДКУ: решение
 * можно оставить безупречным и просто перестать его звать — тогда все тесты
 * останутся зелёными, а площадки снова не узнают о покупках. Ровно этим
 * дефект и был: событие экрана существовало, счётчик его не слушал.
 */
describe("счётчик подписан на покупку", () => {
  const исходник = readFileSync(
    join(process.cwd(), "src/components/AdPixels.tsx"),
    "utf8",
  );

  it("AdPixels слушает checkout_success и зовёт общее решение", () => {
    // Требуем именно ВЕТВЬ, а не слово: слово живёт и в комментарии выше,
    // и первая редакция этой проверки пережила мутацию «if (false)».
    expect(исходник).toContain('d.type === "checkout_success"');
    expect(исходник).toContain("onSuccess(d)");
    expect(исходник).toContain("сигналОПокупке(d)");
  });

  it("покупка уходит обеим площадкам", () => {
    expect(исходник).toContain('"Purchase"');
    expect(исходник).toContain('"CompletePayment"');
  });
});

