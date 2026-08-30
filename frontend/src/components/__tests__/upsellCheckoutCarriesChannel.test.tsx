import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

/**
 * Апселл доводит метку канала до САМОЙ ОПЛАТЫ, а не только до нашего события.
 *
 * Найдено 30.08.2026. Обработчик оплаты давно умеет принимать метку — читает
 * url_params[channel] и url_params[utm_source] и кладёт канал в запись о
 * покупке. Не хватало отправителя: кнопка апселла стоит на девяти страницах
 * модулей и уводила на кассу без метки. Про НАЧАТУЮ оплату канал был известен,
 * про ОПЛАЧЕННУЮ — нет.
 *
 * Проверяется адрес, КУДА кнопка уводит, а не наличие вызова в коде.
 */

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

// eslint-disable-next-line import/first
import { UpgradeButton } from "../UpgradeButton";

function goingTo(search: string): string {
  Object.defineProperty(window, "location", { value: { search, href: "" }, writable: true });
  document.body.innerHTML = "";
  render(<UpgradeButton appId="qlearn" />);
  fireEvent.click(screen.getByRole("button"));
  return window.location.href;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("апселл уводит на кассу вместе с меткой канала", () => {
  test("метка из адреса доезжает до кассы", () => {
    const url = goingTo("?c=tg");

    expect(url, "кнопка вообще никуда не увела").toContain("gumroad");
    // Обработчик оплаты читает именно эти два параметра.
    expect(url, "касса не получит канал").toMatch(/[?&]channel=/);
    expect(url, "касса не получит utm_source").toMatch(/[?&]utm_source=/);
  });

  test("тройка utm полная — по неполной Gumroad не заводит отчёт", () => {
    const url = goingTo("?c=tg");

    for (const p of ["utm_source=", "utm_medium=", "utm_campaign="]) {
      expect(url, `в адресе кассы нет ${p}`).toContain(p);
    }
  });

  test("без метки адрес остаётся прежним — пустых параметров не добавляем", () => {
    const url = goingTo("");

    expect(url).toContain("gumroad");
    expect(url).not.toMatch(/[?&]channel=/);
  });

  test("выдуманная метка на кассу не уезжает", () => {
    expect(goingTo("?c=zzzz")).not.toMatch(/[?&]channel=/);
  });
});
