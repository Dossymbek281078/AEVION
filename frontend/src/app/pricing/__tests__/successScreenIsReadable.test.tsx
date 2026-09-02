import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * УСПЕШНЫЙ экран страницы цен читается человеком, а не машиной.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ ЭКРАНА ОТКАЗА. Сосед по файлу
 * (`failureScreenHasNoInternals`) проверяет, что человек не видит наших
 * внутренностей, когда бэкенд молчит. Здесь обратный случай: бэкенд ответил,
 * данные пришли — и надо, чтобы на экране оказались ЦЕНЫ, а не следы работы
 * машины: `undefined` вместо суммы, `NaN` вместо скидки, непереведённый ключ
 * словаря вместо подписи.
 *
 * Такие дефекты рождаются при ИСПОЛНЕНИИ и в исходнике невидимы: `{price}`
 * выглядит одинаково и когда цена есть, и когда её нет. Ни один греп их не
 * найдёт, а тесты компонентов проходят на своих аккуратных пропсах.
 *
 * ДАННЫЕ НАСТОЯЩИЕ. Фикстуры сняты с прода 02.09.2026 (`api.aevion.app`):
 * 6 тарифов, 43 модуля, 3 набора, 4 валюты. Свои выдуманные данные тут были
 * бы хуже отсутствия теста: они описывают то, что я СЧИТАЮ правдой, и
 * зелёный цвет на них ничего не значит. Проверено на секреты и адреса —
 * чисто, шаблон при этом рабочий (на соседнем файле он адреса находит).
 *
 * ГРАНИЦА. Данные — срез одного дня. Тест утверждает «на ЭТИХ данных экран
 * читается», а не «на любых». Форма ответа изменится — фикстуру надо снять
 * заново, и падение здесь означает именно это.
 */

import pricing from "./__fixtures__/pricing.json";
import checkoutHealthz from "./__fixtures__/checkoutHealthz.json";
import promo from "./__fixtures__/promo.json";
import testimonials from "./__fixtures__/testimonials.json";
import trust from "./__fixtures__/trust.json";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

// eslint-disable-next-line import/first
import { I18nProvider } from "@/lib/i18n";

/** Ответы прода по адресу. Порядок важен: длинные пути раньше коротких. */
const ОТВЕТЫ: Array<[string, unknown]> = [
  ["/api/pricing/checkout/healthz", checkoutHealthz],
  ["/api/pricing/testimonials", testimonials],
  ["/api/pricing/promo", promo],
  ["/api/pricing/trust", trust],
  ["/api/pricing", pricing],
];

beforeEach(() => {
  vi.stubGlobal("fetch", (input: unknown) => {
    const url = String(input);
    const пара = ОТВЕТЫ.find(([путь]) => url.includes(путь));
    if (!пара) return Promise.reject(new Error("в тесте нет ответа для " + url));
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(пара[1]),
      text: () => Promise.resolve(JSON.stringify(пара[1])),
    } as unknown as Response);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Ключи словаря, которые страница СОБИРАЕТСЯ показать.
 *
 * Берём их из исходника самой страницы, а не угадываем по форме текста.
 * Первая редакция искала «слово с точкой» в готовом тексте и оказалась
 * негодной с обеих сторон: сперва ловила стыки предложений («…account.12
 * modules», «…click.IP address»), а после отсева по форме перестала ловить
 * настоящий случай — в `textContent` соседние узлы склеиваются без пробела,
 * потерянный ключ приезжает внутри «Monthlyperiod.annualPropal», и правило
 * «часть не начинается с заглавной» его убивало. Поймано мутацией.
 *
 * Оба переводчика при промахе возвращают САМ КЛЮЧ:
 *
 *     pricingI18n.ts:1020   dict[lang]?.[key] ?? dict.en?.[key] ?? key
 *     i18n.tsx:128          tbl[lang]?.[key] || tbl["en"]?.[key] || key
 *
 * Падения нет: экран печатает `period.annual` вместо «Annual (-16%)».
 * Так выглядит потеря ключа при переносе словаря — а перенос у нас идёт.
 */
function ключиИзИсходника(): string[] {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"),
    "utf8",
  );
  const найдено = new Set<string>();
  for (const вызов of ["tp(" + JSON.stringify("").slice(0, 1), "t(" + JSON.stringify("").slice(0, 1)]) {
    let i = 0;
    for (;;) {
      const j = src.indexOf(вызов, i);
      if (j < 0) break;
      const k = src.indexOf(JSON.stringify("").slice(0, 1), j + вызов.length);
      i = j + вызов.length;
      if (k < 0) continue;
      const ключ = src.slice(j + вызов.length, k);
      if (ключ.length >= 6 && ключ.includes(".") && /^[a-z][A-Za-z0-9.]*$/.test(ключ)) {
        найдено.add(ключ);
      }
      i = k;
    }
  }
  return [...найдено];
}

describe("успешный экран страницы цен", () => {
  test("показывает цены, а не следы работы машины", async () => {
    const { default: Страница } = await import("../page");
    const { container } = render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );

    // Контроль: данные доехали и экран УСПЕШНЫЙ, а не отказной. Без этого
    // проверки ниже прошли бы на экране «Загружаем цены…», где машинных
    // следов нет по причине отсутствия чего бы то ни было.
    await waitFor(
      () => expect(container.textContent ?? "").toContain("Enterprise"),
      { timeout: 15000 },
    );
    const текст = container.textContent ?? "";
    expect(текст.length, "экран подозрительно пуст").toBeGreaterThan(2000);

    for (const след of ["undefined", "NaN", "[object Object]", "Infinity"]) {
      expect(текст, `на экране цен видно «${след}» — это след работы машины, а не цена`)
        .not.toContain(след);
    }

    const ключи = ключиИзИсходника();
    expect(ключи.length, "разбор не нашёл в странице ни одного ключа — проверка была бы пустой")
      .toBeGreaterThan(20);
    const видимые = ключи.filter((к) => текст.includes(к));
    expect(видимые, `на экране показан САМ КЛЮЧ вместо подписи: ${видимые.join(", ")}`)
      .toEqual([]);
  }, 60000);
});
