/**
 * Вопрос после оплаты должен вести туда, где ответят.
 *
 * Соседнее окно нашло на этом экране пункт «Вопросы? Пишите на support@aevion.app».
 * У домена нет MX-записи: письмо не доходит и отбивки не приходит. Для человека,
 * который только что заплатил, это выглядит как молчание в ответ на первый же
 * вопрос — худшая минута для такого впечатления.
 *
 * Сторож закрепляет СЛЕДСТВИЕ, а не текст: пункт ведёт ссылкой в адрес, который
 * у нас действительно существует, и несёт тему покупки. Формулировку и язык
 * менять можно свободно, канал — нет.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { existsSync } from "node:fs";
import { I18nProvider } from "@/lib/i18n";

const параметры = { value: "" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(параметры.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));

async function открыть(поиск: string) {
  параметры.value = поиск;
  const m = await import("@/app/pricing/checkout/success/page");
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

describe("канал для вопроса после оплаты", () => {
  it("ведёт ссылкой в существующий адрес и несёт тему покупки", async () => {
    await открыть("paybox=1&ref=abc&tier=lite&total=4900");

    const ссылки = Array.from(document.querySelectorAll("a"));
    const вопрос = ссылки.find((a) => (a.getAttribute("href") ?? "").includes("/pricing/contact"));
    expect(вопрос, "пункт про вопросы перестал быть ссылкой на нашу форму").toBeTruthy();

    const адрес = вопрос?.getAttribute("href") ?? "";
    // Тема нужна, чтобы обращение попало к нам помеченным как «покупка»:
    // разбирать такие письма и считать их по каналам иначе нечем.
    expect(адрес, "потеряна тема покупки").toContain("topic=purchase");

    // Ссылка на несуществующий адрес молчит так же, как мёртвый ящик.
    const безВопроса = адрес.split("?")[0];
    const путь = безВопроса.startsWith("/") ? безВопроса.slice(1) : безВопроса;
    expect(
      existsSync(`src/app/${путь}/page.tsx`),
      `страница ${адрес} в продукте отсутствует`,
    ).toBe(true);
  }, 60000);

  it("не отправляет заплатившего человека на адрес без доставки", async () => {
    await открыть("paybox=1&ref=abc&tier=lite&total=4900");
    const текст = document.body.textContent ?? "";
    expect(текст, "экран пуст").not.toBe("");
    expect(текст, "на экране снова почтовый адрес без MX").not.toContain("support@aevion.app");
  }, 60000);
});
