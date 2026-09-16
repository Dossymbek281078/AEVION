import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

/**
 * Апселл доводит метку канала до страницы цен — а оттуда до кассы.
 *
 * Найдено 30.08.2026: кнопка апселла стоит на девяти страницах модулей и уводила
 * на кассу без метки. Про НАЧАТУЮ оплату канал был известен, про ОПЛАЧЕННУЮ — нет.
 *
 * 15.09.2026 — новая ценовая политика: баннер продаёт не All-Access на Gumroad
 * (снят), а подписку AEVION на срок, и ведёт к выбору срока на /pricing#tiers.
 * Метка едет короткой ?c= и обязана стоять ДО хеша: всё после `#` браузер
 * серверу не отправляет, и channelNow её бы не увидел.
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
  // Канал живёт в хранилище вкладки (channelNow), поэтому соседний тест с меткой
  // оставляет её следующему. Чистим, чтобы каждая проверка отвечала за себя.
  try {
    sessionStorage.clear();
  } catch {
    // приватный режим — хранилища нет
  }
  document.body.innerHTML = "";
});

describe("апселл уводит к выбору срока вместе с меткой канала", () => {
  test("метка из адреса доезжает, и стоит ДО хеша", () => {
    const url = goingTo("?c=tg");
    expect(url, "кнопка увела не на страницу сроков").toBe("/pricing?c=tg#tiers");
  });

  test("без метки адрес остаётся прежним — пустых параметров не добавляем", () => {
    expect(goingTo("")).toBe("/pricing#tiers");
  });

  test("выдуманная метка не уезжает", () => {
    expect(goingTo("?c=zzzz")).toBe("/pricing#tiers");
  });

  test("в снятый товар Gumroad кнопка больше не ведёт", () => {
    expect(goingTo("?c=tg")).not.toContain("gumroad");
  });

  test("баннер называет цену лестницы, а не снятую", () => {
    document.body.innerHTML = "";
    const { container } = render(<UpgradeButton variant="banner" />);
    const text = container.textContent ?? "";
    expect(text).toContain("от $200/мес");
    expect(text).not.toMatch(/\$59|All-Access/);
  });
});
