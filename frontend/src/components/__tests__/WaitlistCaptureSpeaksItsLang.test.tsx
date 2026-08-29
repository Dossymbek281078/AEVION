import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { WaitlistCapture } from "../WaitlistCapture";

/**
 * Форма подписки стоит на ШЕСТИ страницах, из них две английские
 * (/en/go, /en/longevity). Язык переключал только часть текстов: подсказка
 * поля и «Отправляем…» шли из словаря, а заголовок, описание, обещание и
 * подпись кнопки оставались русскими литералами в умолчаниях свойств.
 *
 * Человек на английской странице видел СМЕСЬ — это хуже, чем целиком по-русски:
 * выглядит как поломка, а не как «сайт на другом языке».
 *
 * Грепом класс не находится: в исходнике страницы этих текстов нет вовсе,
 * они приходят из умолчаний компонента. Виден только у отрисованной страницы.
 */

const CYRILLIC = /[А-Яа-яЁё]/;

function textOf(container: HTMLElement): string {
  // ВАЖНО: не только текст между тегами. Подпись кнопки, подсказка поля и
  // всплывающие тексты живут в атрибутах, и сторож «по textContent» их не видит.
  const attrs: string[] = [];
  container.querySelectorAll("*").forEach((el) => {
    for (const name of ["placeholder", "aria-label", "title", "alt", "value"]) {
      const v = el.getAttribute(name);
      if (v) attrs.push(v);
    }
  });
  return [container.textContent ?? "", ...attrs].join(" | ");
}

describe("форма подписки говорит на языке страницы", () => {
  it("по-английски — ни одного русского слова", () => {
    const { container } = render(<WaitlistCapture source="en-go" lang="en" />);
    const text = textOf(container);
    const hits = text.split(" | ").filter((part) => CYRILLIC.test(part));
    expect(
      hits,
      "на английской странице человек видит русский текст — смесь языков",
    ).toEqual([]);
    cleanup();
  });

  it("контроль: по-русски русский текст ЕСТЬ", () => {
    const { container } = render(<WaitlistCapture source="go" lang="ru" />);
    expect(
      CYRILLIC.test(textOf(container)),
      "русская страница осталась без русского текста — правка сломала основной путь",
    ).toBe(true);
    cleanup();
  });

  it("явная подпись от страницы сильнее словаря", () => {
    const { container } = render(
      <WaitlistCapture source="en-go" lang="en" buttonLabel="Join the waitlist" />,
    );
    expect(textOf(container)).toContain("Join the waitlist");
    cleanup();
  });
});
