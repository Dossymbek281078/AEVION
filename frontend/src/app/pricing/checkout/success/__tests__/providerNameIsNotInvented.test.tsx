/**
 * Название кассы на экране оплаты не выдумывается из адреса.
 *
 * `PROCESSOR_LABEL[provider] ?? null` выглядит аккуратной страховкой, но `??`
 * отсеивает только null и undefined: `PROCESSOR_LABEL["constructor"]` — функция
 * Object, и она проходит дальше как «название кассы».
 *
 * Замер соседнего окна 04.09 ОТРИСОВКОЙ, с `?provider=constructor`:
 *
 *   paid via function Object() { [native code] } · secure
 *   check your email — a receipt from function Object() { [native code] }
 *   manage your subscription — in your function Object() { [native code] }
 *
 * Три раза на экране, который человек видит сразу после списания денег.
 *
 * ЧТЕНИЕМ КОДА ЭТО НЕ ВИДНО — потому и проверяем отрисовкой. Рядом со строкой
 * даже стоял комментарий «выдуманное имя хуже отсутствующего»: обещание было
 * верным, а код его не исполнял.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

const параметры = { объект: new URLSearchParams("") };
vi.mock("next/navigation", () => ({
  useSearchParams: () => параметры.объект,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));

async function текстПри(поиск: string) {
  параметры.объект = new URLSearchParams(поиск);
  const m = await import("@/app/pricing/checkout/success/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
  return document.body.textContent ?? "";
}

afterEach(() => cleanup());

const СЛУЖЕБНЫЕ = ["constructor", "__proto__", "toString", "valueOf"];

describe("название кассы на экране оплаты", () => {
  it.each(СЛУЖЕБНЫЕ)("«%s» не становится названием кассы", async (имя) => {
    const текст = await текстПри(`provider=${имя}&ref=abc&tier=lite&total=4900`);
    expect(текст, "экран пуст — проверять нечего").not.toBe("");
    expect(текст, "на экран уехало внутреннее представление функции").not.toContain("native code");
    expect(текст, `служебное имя ${имя} показано как касса`).not.toContain(имя);
  }, 60000);

  it("настоящая касса по-прежнему называется", async () => {
    /*
     * Контроль обязателен: без него «ничего не показываем» выглядело бы
     * починкой, а на деле мы могли просто перестать называть кассу вообще.
     */
    const текст = await текстПри("provider=paybox&ref=abc&tier=lite&total=4900");
    expect(текст, "настоящая касса перестала называться").toContain("PayBox");
  }, 60000);
});
