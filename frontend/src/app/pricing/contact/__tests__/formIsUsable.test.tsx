import { describe, test, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * Форма связи действительно работает — потому что теперь она ЕДИНСТВЕННЫЙ
 * канал поддержки.
 *
 * ЗАЧЕМ. За 01–02.09.2026 с денежных страниц убраны все адреса на домене
 * `aevion.app`: у домена нет записи MX, письма туда не доходят вовсе. Взамен
 * поставлены ссылки сюда — семь штук, включая возврат денег, экран ПОСЛЕ
 * ОПЛАТЫ и заявку на бесплатный план для вузов.
 *
 * То есть цена поломки этой страницы выросла ровно на столько, на сколько
 * упала цена мёртвых ящиков. Раньше сломанная форма означала «есть ещё
 * почта»; теперь она означает, что человеку не дозвониться никак.
 *
 * У страницы не было НИ ОДНОГО теста — проверено перед написанием.
 *
 * ГРАНИЦА. Здесь проверяется, что форма отрисовалась и её поля доступны
 * человеку и читалке. Отправка не проверяется: она уходит на живой сервер,
 * а проверка, которой нужен сервер, не запускается никогда.
 */

/**
 * Объект параметров ОДИН на весь прогон, и это не мелочь.
 *
 * Страница делает `useEffect(..., [sp])` с записью состояния (строка 55).
 * Если отдавать новый `URLSearchParams` на каждый вызов — как это делает
 * соседний тест страницы отмены, и там ПРАВИЛЬНО, потому что он проверяет
 * защёлку, — здесь получается бесконечная перерисовка: новый объект →
 * эффект → setState → новый объект. `render()` не возвращается вовсе.
 *
 * Я на этом потерял два прогона и чуть не записал в дефекты страницы то,
 * что создал мок. В Next `useSearchParams()` стабилен между отрисовками, и
 * подделка обязана повторять этот контракт, а не удобство теста.
 */
const ПАРАМЕТРЫ = new URLSearchParams("topic=refund");

vi.mock("next/navigation", () => ({
  useSearchParams: () => ПАРАМЕТРЫ,
}));

// eslint-disable-next-line import/first
import { I18nProvider } from "@/lib/i18n";

describe("форма связи пригодна к использованию", () => {
  test("поля и кнопка на месте, у каждого поля есть имя", async () => {
    const { default: Страница } = await import("../page");
    const { container } = render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );

    await waitFor(
      () => expect(container.querySelectorAll("input, textarea, select").length).toBeGreaterThan(0),
      { timeout: 15000 },
    );

    const поля = [...container.querySelectorAll("input, textarea, select")];
    // Контроль: полей действительно несколько. С одним-двумя проверка ниже
    // была бы почти пустой и зелёной при разобранной форме.
    expect(поля.length, "форма отрисовала подозрительно мало полей").toBeGreaterThanOrEqual(4);

    const кнопки = [...container.querySelectorAll("button")];
    expect(кнопки.length, "на форме нет ни одной кнопки — отправить нечем").toBeGreaterThan(0);

    /**
     * Имя поля для читалки. Placeholder именем НЕ считается: он исчезает при
     * вводе, то есть поле становится безымянным ровно тогда, когда в нём
     * работают.
     */
    const безымянные = поля.filter((поле) => {
      const el = поле as HTMLElement;
      if (el.getAttribute("aria-label")) return false;
      if (el.getAttribute("aria-labelledby")) return false;
      if (el.getAttribute("type") === "hidden") return false;
      const id = el.getAttribute("id");
      if (id && container.querySelector(`label[for="${id}"]`)) return false;
      if (el.closest("label")) return false;
      return true;
    });

    expect(
      безымянные.map((п) => (п as HTMLElement).getAttribute("name") ?? (п as HTMLElement).tagName),
      "у этих полей нет имени для читалки: человек со скринридером не поймёт, " +
        "что вводить, а это единственный способ до нас достучаться",
    ).toEqual([]);
  }, 60000);
});
