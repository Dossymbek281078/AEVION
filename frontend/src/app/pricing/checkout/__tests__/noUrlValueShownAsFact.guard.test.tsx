import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Значение из адреса не попадает на экран возврата как утверждение.
 *
 * ЗАЧЕМ ОБЩИЙ СТОРОЖ, А НЕ ТРИ ЧАСТНЫХ. 04.09.2026 этот класс нашёлся на одном
 * экране ТРИЖДЫ, и каждый раз вручную:
 *
 *   ?provider=constructor  -> «paid via function Object() { [native code] }»
 *   ?tier=Zolotoy          -> «пробный доступ Zolotoy»
 *   ?total=5000            -> «Сумма: $50» рядом с «оплата принята»
 *
 * Каждый раз я чинил ровно найденное. Четвёртый параметр никто не проверял бы
 * до следующей случайной находки, поэтому здесь проверяются ВСЕ параметры,
 * которые страница читает: в каждый по очереди кладётся метка, и она не должна
 * доехать до текста.
 *
 * ПОЧЕМУ БЕЗ ПОДТВЕРЖДЕНИЯ СЕРВЕРА. Сервер здесь молчит (fetch отклоняется), то
 * есть страница обязана быть в осторожном состоянии: «оплата принята —
 * проверяем доступ». В нём она не знает НИЧЕГО о покупке и не имеет права
 * называть ни тариф, ни сумму, ни кассу.
 *
 * ЧЕСТНОЕ ИСКЛЮЧЕНИЕ ОДНО. Идентификатор платежа (`sale_id`, `session_id`,
 * `ref`) страница показывает намеренно: это то, что человек назовёт в
 * поддержке. Он не утверждение о покупке, а строка для связи — и утаивать её
 * значило бы оставить человека без опоры.
 */

// `_ptxn` — прежнее имя того же идентификатора продажи Gumroad:
// `sp.get("sale_id") ?? sp.get("_ptxn")`. Сторож нашёл его на первом прогоне,
// и это как раз то, ради чего он общий: три предыдущих случая этого класса я
// находил по одному и вручную, а четвёртый параметр никто бы не проверил.
const ПОКАЗЫВАЕМ_НАМЕРЕННО = new Set(["sale_id", "session_id", "ref", "_ptxn"]);

/** Метка нарочно не похожа ни на что осмысленное и не встречается в вёрстке. */
const МЕТКА = "zzmarkerzz";

let query = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("@/lib/track", () => ({ track: () => {} }));
vi.mock("@/lib/pricingI18n", () => ({ usePricingT: () => (k: string) => k }));

// eslint-disable-next-line import/first
import { I18nProvider } from "@/lib/i18n";
// eslint-disable-next-line import/first
import SuccessPage from "../success/page";
// eslint-disable-next-line import/first
import CancelPage from "../cancel/page";

beforeEach(() => {
  // Сервер молчит: страница обязана остаться в осторожном состоянии.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("нет сети")));
  document.body.innerHTML = "";
});
afterEach(() => vi.unstubAllGlobals());

const ЭКРАНЫ = [
  {
    имя: "успех",
    Компонент: SuccessPage,
    параметры: ["_ptxn", "appId", "gumroad", "paybox", "paypal", "period", "provider",
                "sale_id", "session_id", "stub", "tier", "tierId", "total", "trial"],
  },
  {
    имя: "отмена",
    Компонент: CancelPage,
    параметры: ["paybox", "paypal", "provider", "ref", "session_id", "tier", "total"],
  },
];

function текст(Компонент: () => React.ReactElement, q: string): string {
  query = q;
  const { container } = render(
    <I18nProvider>
      <Компонент />
    </I18nProvider>,
  );
  return container.textContent || "";
}

describe("экраны возврата не показывают значение из адреса как факт", () => {
  test("контроль: экраны вообще отрисовываются", () => {
    // Иначе «метки нет в тексте» означало бы «текста нет вовсе».
    for (const { имя, Компонент } of ЭКРАНЫ) {
      expect(текст(Компонент, "").length, `экран «${имя}» пуст`).toBeGreaterThan(40);
    }
  });

  test("контроль: метка вообще способна доехать до экрана", () => {
    // Проба с заранее известным ответом: идентификатор платежа показывается
    // НАМЕРЕННО, и на нём видно, что способ измерения работает.
    expect(
      текст(SuccessPage, `sale_id=${МЕТКА}`),
      "метка не доехала даже там, где её показывают намеренно — сломан способ проверки",
    ).toContain(МЕТКА);
  });

  for (const { имя, Компонент, параметры } of ЭКРАНЫ) {
    for (const п of параметры.filter((x) => !ПОКАЗЫВАЕМ_НАМЕРЕННО.has(x))) {
      test(`${имя}: ?${п}= не попадает в текст`, () => {
        expect(
          текст(Компонент, `${п}=${МЕТКА}`),
          `значение параметра ${п} показано человеку как факт о покупке, ` +
            "хотя сервер покупку не подтверждал",
        ).not.toContain(МЕТКА);
      });
    }
  }
});
