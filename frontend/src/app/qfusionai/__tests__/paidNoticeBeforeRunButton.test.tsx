import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import FusionPlayground from "../components/FusionPlayground";

/**
 * Честное уведомление о платности обязано стоять ДО кнопки «Запустить».
 *
 * Повод (замер 11.10.2026, окно Касса): плейграунд QFusionAI открыт анонимно
 * и зовёт «введите запрос, получите ответ», но ручка POST /api/qfusionai/route
 * отдаёт гостю 402 — человек узнавал о платности только ПОСЛЕ нажатия, из
 * модалки. Остальные платные модули (qai, qnews, qlearn) честны сразу.
 *
 * Правду про саму платность стережёт backend
 * qfusionaiRouteGatesGuestWhenPaywalled.guard (ручка и правда 402). Здесь —
 * второе: что уведомление и ссылка на тарифы вообще есть и не уехали молча
 * при будущей правке. §0-СТОРОЖ: проверяем отрисовку компонента, не текст
 * страницы.
 */
afterEach(cleanup);

describe("уведомление «платно» над кнопкой «Запустить»", () => {
  it("показывает «Платно … входит в подписку» и ссылку /pricing?c=qfusionai", () => {
    const { container } = render(<FusionPlayground />);
    expect(container.textContent).toContain("Платно");
    expect(container.textContent).toContain("подписк");
    const link = container.querySelector('a[href="/pricing?c=qfusionai"]');
    expect(link).not.toBeNull();
    // Контроль: это действительно плейграунд — кнопка запуска на месте.
    expect(container.textContent).toContain("Запустить");
  });

  it("уведомление идёт РАНЬШЕ кнопки «Запустить» в разметке (до, не после)", () => {
    const { container } = render(<FusionPlayground />);
    const text = container.textContent || "";
    const iNotice = text.indexOf("Платно");
    const iButton = text.indexOf("Запустить");
    expect(iNotice).toBeGreaterThanOrEqual(0);
    expect(iButton).toBeGreaterThan(iNotice);
  });
});
