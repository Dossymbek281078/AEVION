import { describe, test, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Замер посадочных страниц. До 13.08.2026 из страниц, куда ведут ссылки,
 * считала только `/pricing`: ролики на YouTube ведут на `/qrenew` и
 * `/qmelanin`, а там не считалось ничего. То есть даже имеющиеся просмотры
 * приходили вслепую — нельзя было сказать ни сколько человек дошло, ни
 * нажал ли кто-нибудь «купить».
 */

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@/lib/track", () => ({ track: trackMock }));

// eslint-disable-next-line import/first
import { PageTracking } from "../PageTracking";

function eventsOfType(type: string) {
  return trackMock.mock.calls.map((c) => c[0]).filter((e) => e.type === type);
}

function at(url: string) {
  window.history.replaceState({}, "", url);
}

beforeEach(() => {
  trackMock.mockReset();
  document.body.innerHTML = "";
  at("/");
});

describe("замер посадочной страницы", () => {
  test("посещение засчитывается один раз и несёт страницу с каналом", () => {
    at("/qmelanin?c=tt");

    render(<PageTracking page="qmelanin" />);

    const views = eventsOfType("page_view");
    expect(views).toHaveLength(1);
    expect(views[0].source).toBe("qmelanin");
    expect(views[0].meta.channel).toBe("tt");
  });

  test("без метки канал пишется как direct, а не теряется", () => {
    at("/qrenew");

    render(<PageTracking page="qrenew" />);

    expect(eventsOfType("page_view")[0].meta.channel).toBe("direct");
  });

  test("клик по ссылке оплаты засчитывается с товаром и страницей", () => {
    at("/shop?c=tt");
    render(<PageTracking page="shop" />);
    const a = document.createElement("a");
    a.setAttribute("href", "https://aevion.gumroad.com/l/tmuyxw?channel=tt");
    document.body.appendChild(a);

    a.click();

    const clicks = eventsOfType("cta_click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].source).toBe("shop");
    expect(clicks[0].meta.product).toBe("tmuyxw");
    expect(clicks[0].meta.channel).toBe("tt");
  });

  test("внутренние переходы в намерение купить НЕ засчитываются", () => {
    render(<PageTracking page="go" />);
    const a = document.createElement("a");
    a.setAttribute("href", "/longevity?c=tt");
    document.body.appendChild(a);

    a.click();

    expect(eventsOfType("cta_click")).toHaveLength(0);
  });

  test("клик по вложенному элементу внутри ссылки тоже считается", () => {
    render(<PageTracking page="apps" />);
    const a = document.createElement("a");
    a.setAttribute("href", "https://aevion.lemonsqueezy.com/checkout/buy/91c430c8-74f8-46f2-9499-816c93533ef4");
    const span = document.createElement("span");
    a.appendChild(span);
    document.body.appendChild(a);

    span.click();

    const clicks = eventsOfType("cta_click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].meta.product).toBe("91c430c8-74f8-46f2-9499-816c93533ef4");
  });

  test("две страницы шлют разный source — иначе сводка склеит их в одну", () => {
    render(<PageTracking page="qrenew" />);
    render(<PageTracking page="qmelanin" />);

    expect(eventsOfType("page_view").map((e) => e.source).sort()).toEqual(["qmelanin", "qrenew"]);
  });
});
