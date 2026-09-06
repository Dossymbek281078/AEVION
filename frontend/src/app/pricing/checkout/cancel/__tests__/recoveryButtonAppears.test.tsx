/**
 * Кнопка «вернуться к тарифу» появляется у того, кто отказался от оплаты.
 *
 * Кассы возвращают человека на `/pricing/checkout/cancel?paybox=1` — только с
 * меткой кассы. Тарифа в адресе нет, а кнопка рисовалась лишь при нём. Замер с
 * контролем 02.09.2026:
 *
 *   ?paybox=1             → /pricing, /pricing/contact, /pricing
 *   ?paybox=1&tier=lite   → те же ПЛЮС /pricing/lite      ← контроль
 *
 * То есть единственная кнопка, ведущая обратно к покупке, существовала в коде и
 * не появлялась в проде НИКОГДА — ровно у того человека, которого ещё можно
 * вернуть. Заодно события отказа уходили без тарифа.
 *
 * Чинится с ДВУХ сторон, и здесь проверяется та, что не зависит от касс: наша
 * страница цен знает тариф в момент входа в кассу и запоминает его.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { запомнитьНамерение } from "@/lib/checkoutIntent";

const параметры = { объект: new URLSearchParams("") };
vi.mock("next/navigation", () => ({
  useSearchParams: () => параметры.объект,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/cancel",
}));

async function ссылкиПри(поиск: string) {
  параметры.объект = new URLSearchParams(поиск);
  const m = await import("@/app/pricing/checkout/cancel/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
  return Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("возврат к тарифу после отказа", () => {
  it("появляется по памяти вкладки, когда касса тариф не передала", async () => {
    запомнитьНамерение("lite", "monthly");
    // Ровно тот адрес, который присылает PayBox: одна метка кассы.
    const ссылки = await ссылкиПри("paybox=1");
    expect(ссылки, "кнопка возврата к тарифу не появилась").toContain("/pricing/lite");
  }, 60000);

  it("без памяти и без адреса кнопки нет — наугад не ведём", async () => {
    /*
     * Отрицательный контроль. Подставить тариф наугад было бы хуже отсутствия
     * кнопки: человек попадёт не туда, куда собирался, и решит, что мы путаем
     * его покупку.
     */
    const ссылки = await ссылкиПри("paybox=1");
    expect(ссылки.some((h) => h.startsWith("/pricing/") && h !== "/pricing/contact?topic=cancel"),
      "кнопка появилась без всяких оснований").toBe(false);
  }, 60000);

  it("адрес побеждает память", async () => {
    // Память — про последнюю попытку вкладки, адрес — про ИМЕННО эту оплату.
    запомнитьНамерение("lite", "monthly");
    const ссылки = await ссылкиПри("paybox=1&tier=full");
    expect(ссылки, "адрес не победил память").toContain("/pricing/full");
    expect(ссылки, "память перебила адрес").not.toContain("/pricing/lite");
  }, 60000);
});
