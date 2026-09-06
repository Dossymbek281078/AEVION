import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { WaitlistCapture } from "@/components/WaitlistCapture";

/**
 * Форма сбора адресов говорит на языке страницы, даже когда проп не передан.
 *
 * Замер 02.09.2026 отрисовкой прода: на английской /go в поле почты стояло
 * «вы@почта.рф». Переводы в компоненте БЫЛИ — дефект жил в умолчании: проп lang
 * не передавали шесть страниц из девяти, а умолчание было русским.
 *
 * Проверяем следствие (что видит человек), а не форму (наличие словаря): второе
 * было бы зелёным и на сломанном коде, потому что английские строки на месте.
 */

const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;

function видимоеИАтрибуты(el: HTMLElement): string {
  const части: string[] = [el.textContent ?? ""];
  el.querySelectorAll("*").forEach((n) => {
    for (const a of ["placeholder", "aria-label", "title", "alt"]) {
      const v = n.getAttribute(a);
      if (v) части.push(v);
    }
  });
  return части.join(" | ");
}

describe("форма раннего доступа говорит на языке страницы", () => {
  it("проп сильнее словаря — английская страница получает английские подписи", () => {
    const { container } = render(
      <I18nProvider><WaitlistCapture source="test" lang="en" /></I18nProvider>,
    );
    const текст = видимоеИАтрибуты(container);
    const русское = текст.split("|").map((s) => s.trim()).filter((s) => КИРИЛЛИЦА.test(s));
    expect(русское, "английская форма показывает русский текст").toEqual([]);
  });

  it("контроль: проверка УМЕЕТ увидеть кириллицу", () => {
    const { container } = render(
      <I18nProvider><WaitlistCapture source="test" lang="ru" /></I18nProvider>,
    );
    expect(
      КИРИЛЛИЦА.test(видимоеИАтрибуты(container)),
      "контроль: русская форма не дала ни одного русского слова — прибор слеп",
    ).toBe(true);
  });

  it("форма вообще что-то рисует — иначе пустота прошла бы как успех", () => {
    const { container } = render(
      <I18nProvider><WaitlistCapture source="test" lang="en" /></I18nProvider>,
    );
    expect(
      (container.querySelectorAll("input").length, container.textContent ?? "").trim().length,
      "форма пуста",
    ).toBeGreaterThan(10);
  });

  it("поле почты имеет подсказку, и она не русская при lang=en", () => {
    const { container } = render(
      <I18nProvider><WaitlistCapture source="test" lang="en" /></I18nProvider>,
    );
    const поле = container.querySelector('input[type="email"], input[name="email"], input');
    expect(поле, "поля ввода нет вовсе").not.toBeNull();
    const ph = поле?.getAttribute("placeholder") ?? "";
    expect(ph.length, "у поля почты нет подсказки").toBeGreaterThan(0);
    expect(КИРИЛЛИЦА.test(ph), `подсказка по-русски: ${ph}`).toBe(false);
  });
});
