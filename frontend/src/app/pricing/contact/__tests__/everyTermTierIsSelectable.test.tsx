// Каждая ступень лестницы сроков обязана выбираться в форме заявки.
//
// ЗАЧЕМ ИМЕННО ЭТОТ СТОРОЖ. Дефект приходил сюда ДВАЖДЫ одним и тем же путём.
// 04.09.2026: в списке выбора не было `pro` — самый дорогой покупаемый тариф
// нельзя было указать ни руками, ни ссылкой, и заявка приходила обезличенной.
// Тогда имя дописали руками. 15.09.2026 лестница сменилась на сроки, появилась
// ступень `max` ($2 400 за 12 месяцев) — и дефект вернулся тем же местом,
// потому что список был жёстким перечислением, а не порождённым из TERM_TIERS.
//
// Поэтому утверждение здесь привязано к TERM_TIERS, а НЕ к списку имён: сторож,
// перечисляющий ступени сам, пришлось бы править вместе с лестницей — и он
// проспал бы третий заход того же дефекта.
//
// ⚠️ КОНТРАКТ ПОДДЕЛКИ useSearchParams: объект параметров ОДИН на прогон.
// Страница делает useEffect с записью состояния по [sp]; новый URLSearchParams
// на каждый вызов даёт бесконечную перерисовку (эффект → setState → новый
// объект), и render() не возвращается вовсе. Это записано в соседнем тесте
// formIsUsable как стоившее двух прогонов — повторяем контракт, а не удобство.

import { describe, test, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TERM_TIERS } from "@/lib/termPricing";

const ПАРАМЕТРЫ = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useSearchParams: () => ПАРАМЕТРЫ,
}));

// eslint-disable-next-line import/first
import { I18nProvider } from "@/lib/i18n";
// eslint-disable-next-line import/first
import ContactPage from "../page";

const отрисовать = () =>
  render(
    <I18nProvider>
      <ContactPage />
    </I18nProvider>,
  );

describe("форма заявки: выбрать можно любую ступень лестницы", () => {
  test("каждая ступень TERM_TIERS есть среди вариантов выбора", async () => {
    const { container } = отрисовать();
    await waitFor(() => expect(container.querySelector("select")).not.toBeNull());

    // Берём option из всей формы, а не из конкретного select: привязка к порядку
    // полей — хрупкость, за которую здесь уже платили. Ложного прохода это не
    // даёт — значения ступеней латиницей, значения отраслей русскими подписями.
    const варианты = Array.from(container.querySelectorAll("option")).map((o) =>
      (o as HTMLOptionElement).value,
    );

    // Контроль прибора: варианты вообще прочитались. Пустой список дал бы
    // «ни одна ступень не найдена» и читался бы как дефект страницы.
    expect(варианты.length, "контроль: варианты выбора не прочитались").toBeGreaterThan(2);

    for (const t of TERM_TIERS) {
      expect(
        варианты,
        `ступень ${t} нельзя выбрать в форме заявки — заявка придёт без тарифа`,
      ).toContain(t);
    }
  });

  test("контроль: enterprise на месте — список не сузился", async () => {
    const { container } = отрисовать();
    await waitFor(() => expect(container.querySelector("select")).not.toBeNull());
    const варианты = Array.from(container.querySelectorAll("option")).map((o) =>
      (o as HTMLOptionElement).value,
    );
    // Enterprise — самый дорогой вход. Сторож на полноту обязан ловить и
    // сужение списка, иначе «починка» могла бы выбросить его вместе с жёстким
    // перечислением, и форма потеряла бы корпоративные заявки.
    expect(варианты).toContain("enterprise");
  });
});
