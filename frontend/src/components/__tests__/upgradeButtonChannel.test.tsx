import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

/**
 * Апселл на All-Access должен доносить метку канала до события оплаты.
 *
 * Найдено 30.08.2026 сравнением двух наших же кнопок. Соседняя кнопка покупки
 * (BuyLink) кладёт канал в событие checkout_start, и пять страниц из шести его
 * передают. Кнопка апселла, которая стоит на девяти страницах модулей, слала
 * то же событие БЕЗ канала. Событие приходило, отчёт видел «начали оплату» —
 * и не мог сказать, какой канал этот апселл принёс.
 *
 * Тест смотрит на СОДЕРЖИМОЕ события, а не на наличие кода в файле: проверка
 * грепом здесь зелена и на сломанном коде, потому что слово channel в файле
 * встречается в пояснении.
 */

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@/lib/track", () => ({ track: trackMock }));
// Переход на кассу в тесте не нужен и в jsdom не поддержан.
vi.mock("@/lib/gumroad", () => ({ gumroadCheckoutUrl: () => "https://example.test/checkout" }));

// eslint-disable-next-line import/first
import { UpgradeButton } from "../UpgradeButton";
// eslint-disable-next-line import/first
import { BuyLink } from "../BuyLink";

function at(url: string) {
  window.history.replaceState({}, "", url);
}

function starts() {
  return trackMock.mock.calls.map((c) => c[0]).filter((e) => e.type === "checkout_start");
}

beforeEach(() => {
  trackMock.mockReset();
  document.body.innerHTML = "";
  at("/");
  // jsdom запрещает присваивание location.href — подменяем, чтобы клик не падал.
  Object.defineProperty(window, "location", {
    value: { ...window.location, search: window.location.search, href: "" },
    writable: true,
  });
});

describe("апселл доносит метку канала до кассы", () => {
  test("метка из адреса попадает в событие оплаты", () => {
    at("/qlearn?c=tg");
    Object.defineProperty(window, "location", { value: { search: "?c=tg", href: "" }, writable: true });

    render(<UpgradeButton appId="qlearn" />);
    fireEvent.click(screen.getByRole("button"));

    const e = starts();
    expect(e, "событие начала оплаты не отправлено вовсе").toHaveLength(1);
    expect(e[0].meta?.channel, "канал не доехал до события оплаты").toBeTruthy();
  });

  test("без метки поле не появляется — пустое значение хуже отсутствия", () => {
    Object.defineProperty(window, "location", { value: { search: "", href: "" }, writable: true });

    render(<UpgradeButton appId="qlearn" />);
    fireEvent.click(screen.getByRole("button"));

    const e = starts();
    expect(e).toHaveLength(1);
    expect(Object.keys(e[0].meta ?? {})).not.toContain("channel");
  });

  test("выдуманная метка не принимается — иначе отчёт наполнится мусором", () => {
    Object.defineProperty(window, "location", { value: { search: "?c=zzzz", href: "" }, writable: true });

    render(<UpgradeButton appId="qlearn" />);
    fireEvent.click(screen.getByRole("button"));

    expect(Object.keys(starts()[0].meta ?? {})).not.toContain("channel");
  });
});

describe("кнопка покупки берёт метку сама, если страница её не передала", () => {
  // Так устроена /qrenew, куда ведут ролики: кнопку рисует клиентский
  // компонент, и получить ?c= на сервере он не может.
  test("метка из адреса подхватывается без участия страницы", () => {
    Object.defineProperty(window, "location", { value: { search: "?c=yt", href: "" }, writable: true });

    render(
      <BuyLink href="https://example.test/x" source="qrenew" priceUsd={19}>
        Купить
      </BuyLink>,
    );
    fireEvent.click(screen.getByText("Купить"));

    const e = starts();
    expect(e).toHaveLength(1);
    expect(e[0].meta?.channel, "метка не подхватилась из адреса").toBeTruthy();
  });

  test("метка от страницы старше найденной в адресе", () => {
    Object.defineProperty(window, "location", { value: { search: "?c=yt", href: "" }, writable: true });

    render(
      <BuyLink href="https://example.test/x" source="go" priceUsd={19} channel="Telegram">
        Купить
      </BuyLink>,
    );
    fireEvent.click(screen.getByText("Купить"));

    expect(starts()[0].meta?.channel).toBe("Telegram");
  });
});
