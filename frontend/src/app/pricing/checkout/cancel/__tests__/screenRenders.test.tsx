/**
 * Экран «оплата отменена» отрисовывается — и предлагает выход.
 *
 * Симметричен экрану успеха, и проверялся так же только чтением исходника.
 * Разница в цене ошибки: сюда человек попадает, УЖЕ передумав или сорвавшись, и
 * пустая либо упавшая страница здесь — последнее, что он видит. Выходы (вернуться
 * к тарифу, написать нам) должны быть на месте.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
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
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
}

afterEach(() => cleanup());

describe("экран отмены при отказе сервера", () => {
  it("не показывает внутренностей", async () => {
    // Тот же вопрос, что к экрану успеха: сюда человек попадает уже сорвавшись,
    // и технические подробности здесь читаются как «у них всё сломано».
    vi.stubGlobal("fetch", async () => {
      throw new Error("Failed to parse URL from /api-backend/api/pricing");
    });
    await открыть("paybox=1&tier=lite");
    const текст = document.body.textContent ?? "";
    expect(текст, "экран пуст при отказе сервера").not.toBe("");
    for (const внутреннее of ["/api-backend", "/api/", "npm run", "localhost", "Failed to parse"]) {
      expect(текст, `на экране внутренности: ${внутреннее}`).not.toContain(внутреннее);
    }
    vi.unstubAllGlobals();
  }, 60000);
});

describe("экран отмены отрисовывается", () => {
  it("настоящая отмена PayBox: страница живая", async () => {
    await открыть("paybox=1&tier=lite");
    expect(document.body.textContent, "страница не отрисовалась").not.toBe("");
  }, 60000);

  it("выход со страницы есть — человек не в тупике", async () => {
    await открыть("paypal=1&tier=medium");
    const ссылки = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(ссылки.length, "на странице отмены не осталось ни одной ссылки").toBeGreaterThan(0);
    // Утверждаем ДВА разных выхода, а не «хоть один». Ссылок на тарифы на
    // странице четыре, и проверка «хоть одна» переживала удаление любой из них —
    // то есть почти ничего не стерегла. Человеку здесь нужны обе возможности:
    // вернуться к покупке и написать нам, если сорвалось не по его вине.
    expect(
      ссылки.some((h) => (h ?? "").startsWith("/pricing")),
      "нет пути назад к тарифам",
    ).toBe(true);
    expect(
      ссылки.some((h) => (h ?? "").includes("/pricing/contact")),
      "нет способа написать нам — человек в тупике, если оплата сорвалась не по его вине",
    ).toBe(true);
  }, 60000);

  it("голый заход не падает", async () => {
    await открыть("");
    expect(document.body.textContent).not.toBe("");
  }, 60000);
});
