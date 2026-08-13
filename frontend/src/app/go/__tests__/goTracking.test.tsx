import { describe, test, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * `/go` — страница, на которую ведёт ссылка в шапке профиля. До 13.08.2026
 * замера на ней не было вовсе: после раздачи роликов нельзя было ответить даже
 * на вопрос «приходил ли кто-нибудь», потому что продажа — сигнал слишком
 * поздний и слишком редкий.
 */

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@/lib/track", () => ({ track: trackMock }));

// eslint-disable-next-line import/first
import { GoPageTracking } from "../_track";

function eventsOfType(type: string) {
  return trackMock.mock.calls.map((c) => c[0]).filter((e) => e.type === type);
}

beforeEach(() => {
  trackMock.mockReset();
  document.body.innerHTML = "";
});

describe("замер на странице-хабе /go", () => {
  test("посещение засчитывается один раз и несёт канал", () => {
    render(<GoPageTracking channel="tiktok" />);

    const views = eventsOfType("page_view");
    expect(views).toHaveLength(1);
    expect(views[0].source).toBe("go");
    expect(views[0].meta.channel).toBe("tiktok");
  });

  test("без метки канал пишется как direct, а не теряется", () => {
    render(<GoPageTracking channel={null} />);

    expect(eventsOfType("page_view")[0].meta.channel).toBe("direct");
  });

  test("клик по ссылке оплаты засчитывается с товаром", () => {
    render(<GoPageTracking channel="tiktok" />);
    const a = document.createElement("a");
    a.setAttribute("href", "https://aevion.gumroad.com/l/tmuyxw?channel=tiktok");
    document.body.appendChild(a);

    a.click();

    const clicks = eventsOfType("cta_click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].meta.product).toBe("tmuyxw");
    expect(clicks[0].meta.channel).toBe("tiktok");
  });

  test("внутренние переходы в намерение купить НЕ засчитываются", () => {
    render(<GoPageTracking channel="tiktok" />);
    const a = document.createElement("a");
    a.setAttribute("href", "/longevity?c=tt");
    document.body.appendChild(a);

    a.click();

    expect(eventsOfType("cta_click")).toHaveLength(0);
  });

  test("клик по вложенному элементу внутри ссылки тоже считается", () => {
    render(<GoPageTracking channel="tiktok" />);
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
});
