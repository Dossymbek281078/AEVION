/**
 * Обращение с экрана отмены приходит помеченным.
 *
 * Человек, дошедший до кассы и передумавший, — единственный, у кого ещё можно
 * узнать причину отказа. Если его письмо приходит неотличимым от любого
 * другого, этот разговор не считается вовсе: в разборе обращений он растворён
 * среди вопросов про доступ и счета.
 *
 * Экран оплаты уже несёт `topic=purchase`; здесь та же метка со своим
 * значением. Форма читает `?topic=` и складывает его в источник обращения, так
 * что доходит метка до нас САМА — без ручного разбора писем.
 *
 * Сторож закрепляет следствие: ссылка ведёт в нашу форму и несёт СВОЮ тему.
 * Оформление и текст кнопки менять можно свободно.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { existsSync } from "node:fs";
import { I18nProvider } from "@/lib/i18n";

const параметры = { value: "" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(параметры.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/cancel",
}));

async function открыть(поиск: string) {
  параметры.value = поиск;
  const m = await import("@/app/pricing/checkout/cancel/page");
  const Страница = m.default as () => JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
}

afterEach(() => cleanup());

describe("обращение с экрана отмены", () => {
  it("ведёт в живую форму и несёт свою тему", async () => {
    await открыть("paybox=1&ref=abc&tier=lite&total=4900");

    const ссылки = Array.from(document.querySelectorAll("a"));
    const вопрос = ссылки.find((a) => (a.getAttribute("href") ?? "").includes("/pricing/contact"));
    expect(вопрос, "с экрана отмены пропала ссылка в поддержку").toBeTruthy();

    const адрес = вопрос?.getAttribute("href") ?? "";
    expect(адрес, "обращение придёт без темы и смешается с прочими").toContain("topic=cancel");

    // Ссылка на несуществующий адрес молчит так же, как мёртвый ящик.
    const безВопроса = адрес.split("?")[0];
    const путь = безВопроса.startsWith("/") ? безВопроса.slice(1) : безВопроса;
    expect(existsSync(`src/app/${путь}/page.tsx`), `страница ${адрес} в продукте отсутствует`).toBe(true);
  }, 60000);

  it("тема отличается от темы экрана оплаты", async () => {
    /*
     * Две метки легко свести к одной копированием, и тогда сторож выше остался
     * бы зелёным, а различать отказ и покупку стало бы нечем — ровно то, ради
     * чего метка и заводилась.
     */
    await открыть("paybox=1&ref=abc&tier=lite&total=4900");
    const адрес =
      Array.from(document.querySelectorAll("a"))
        .map((a) => a.getAttribute("href") ?? "")
        .find((h) => h.includes("/pricing/contact")) ?? "";
    expect(адрес, "экран отмены помечает обращение как покупку").not.toContain("topic=purchase");
  }, 60000);
});
