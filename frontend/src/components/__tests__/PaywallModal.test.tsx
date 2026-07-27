import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { PaywallModal } from "../PaywallModal";
import { PAYWALL_EVENT, type PaywallEventDetail } from "@/lib/paywall";

// Рендер React в jsdom при полном параллельном прогоне выходил за дефолтные
// 5с (замер: 5614 мс) и ронял файл ложной краснотой. Тяжёлому тесту — свой
// явный таймаут; на скорость одиночного прогона это не влияет.
vi.setConfig({ testTimeout: 20_000 });

/**
 * Регрессия 2026-07-27, найдена на живом проде.
 *
 * `/multichat-engine` опрашивал платную ручку `provider-status` раз в
 * 30 секунд. Каждый 402 поднимал модалку тарифа заново — поверх бесплатного
 * гостевого демо, ради которого модуль и открывали без входа. Пользователь
 * закрывал её и получал обратно через полминуты.
 *
 * Первопричину чиним на странице (гость туда просто не ходит), но здесь —
 * общая защита: любой другой модуль с интервальным опросом за стеной
 * повторил бы ровно тот же баг.
 */

const BASE: PaywallEventDetail = {
  error: "upgrade_required",
  module: "multichat-engine",
  plan: "free",
  requiredTiers: ["medium", "full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  message: "Модуль «multichat-engine» доступен на тарифах: medium, full, enterprise.",
};

function fire(detail: PaywallEventDetail) {
  act(() => {
    window.dispatchEvent(new CustomEvent<PaywallEventDetail>(PAYWALL_EVENT, { detail }));
  });
}

function isOpen(): boolean {
  return screen.queryByRole("dialog") !== null;
}

function closeModal() {
  act(() => {
    screen.getByLabelText("Закрыть").click();
  });
}

afterEach(cleanup);

describe("PaywallModal — повторное всплытие", () => {
  it("фоновый 402 показывает стену в первый раз", () => {
    render(<PaywallModal />);
    fire({ ...BASE, userInitiated: false });
    // Не подавляем первое появление: иначе платный модуль молча отдавал бы
    // пустой экран без объяснения, почему он пуст.
    expect(isOpen()).toBe(true);
  });

  it("после закрытия фоновый опрос НЕ возвращает стену", () => {
    render(<PaywallModal />);
    fire({ ...BASE, userInitiated: false });
    closeModal();
    expect(isOpen()).toBe(false);
    fire({ ...BASE, userInitiated: false }); // следующий тик опроса
    expect(isOpen()).toBe(false);
  });

  it("после закрытия действие пользователя стену возвращает", () => {
    render(<PaywallModal />);
    fire({ ...BASE, userInitiated: false });
    closeModal();
    // Пользователь нажал платную кнопку — здесь стена и объясняет отказ.
    fire({ ...BASE, userInitiated: true });
    expect(isOpen()).toBe(true);
  });

  it("подавление адресное: другой модуль не наследует закрытие", () => {
    render(<PaywallModal />);
    fire({ ...BASE, userInitiated: false });
    closeModal();
    fire({ ...BASE, module: "qcoreai", userInitiated: false });
    expect(isOpen()).toBe(true);
  });

  it("событие без флага (старые вызовы triggerPaywall) показывается всегда", () => {
    render(<PaywallModal />);
    fire({ ...BASE });
    closeModal();
    fire({ ...BASE });
    expect(isOpen()).toBe(true);
  });
});
