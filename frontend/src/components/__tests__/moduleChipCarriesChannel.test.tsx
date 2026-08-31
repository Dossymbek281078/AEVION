import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";

/**
 * Кнопка «Купить» на странице модуля доводит метку канала до кассы.
 *
 * Найдено 31.08.2026 обходом пути покупателя в браузере — не грепом. Это ТРЕТИЙ
 * путь оплаты, мимо обоих, что чинились накануне: он не строит адрес сам, а
 * получает готовый от бэкенда и уходит по нему как есть. На проде кнопка вела
 * в LemonSqueezy без метки, хотя вебхук читает custom_data.channel с 19.08.
 *
 * Проверяется АДРЕС, по которому уходит браузер.
 */

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

const CHECKOUT = "https://aevion.lemonsqueezy.com/checkout?custom=1";
const fetchMock = vi.fn();

// eslint-disable-next-line import/first
import ModulePricingChip from "../ModulePricingChip";

function at(search: string) {
  Object.defineProperty(window, "location", {
    value: { search, href: "", pathname: "/qlearn" },
    writable: true,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  // Первый запрос — цены тарифов, второй — создание кассы.
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          String(url).includes("checkout/session")
            ? { url: CHECKOUT }
            : {
                // Форма как у настоящего /api/pricing: чип не отрисуется,
                // если поля названы иначе, и тест молча проверит пустоту.
                tiers: [{ id: "lite", priceMonthly: 19 }],
                currencies: { USD: { rate: 1, symbol: "$", label: "USD" } },
              },
        ),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  document.body.innerHTML = "";
  at("");
});

afterEach(() => vi.unstubAllGlobals());

async function clickBuy() {
  render(<ModulePricingChip moduleId="qlearn" />);
  const btn = await screen.findByText(/купить/i);
  fireEvent.click(btn);
  await waitFor(() => expect(window.location.href).not.toBe(""));
  return window.location.href;
}

describe("касса модуля получает метку канала", () => {
  test("метка из адреса доезжает до кассы", async () => {
    at("?c=tg");

    const url = await clickBuy();

    expect(url, "браузер вообще никуда не ушёл").toContain("lemonsqueezy");
    // Именно это поле читает вебхук LemonSqueezy.
    expect(url, "касса не получит канал").toContain("checkout[custom][channel]=");
  });

  test("без метки адрес кассы остаётся прежним", async () => {
    const url = await clickBuy();

    expect(url).toBe(CHECKOUT);
  });

  test("выдуманная метка на кассу не уезжает", async () => {
    at("?c=zzzz");

    expect(await clickBuy()).toBe(CHECKOUT);
  });
});
