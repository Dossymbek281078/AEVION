import { describe, it, expect, vi } from "vitest";
import { activatable } from "../activatable";

const key = (k: string) => {
  const prevented = { done: false };
  return {
    e: { key: k, preventDefault: () => { prevented.done = true; } } as never,
    prevented,
  };
};

describe("activatable", () => {
  it("даёт роль и место в обходе по Tab", () => {
    const p = activatable(() => {});
    expect(p.role).toBe("button");
    expect(p.tabIndex).toBe(0);
  });

  it("срабатывает мышью", () => {
    const fn = vi.fn();
    activatable(fn).onClick();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("срабатывает на Enter", () => {
    const fn = vi.fn();
    const { e } = key("Enter");
    activatable(fn).onKeyDown(e);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("срабатывает на ПРОБЕЛ — его забывают чаще всего", () => {
    // В репозитории 121 место обрабатывает Enter и только 4 — пробел.
    // У настоящей кнопки пробел работает всегда, поэтому без него
    // поведение выглядит сломанным именно для тех, кто ходит клавиатурой.
    const fn = vi.fn();
    const { e } = key(" ");
    activatable(fn).onKeyDown(e);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("отменяет прокрутку по пробелу, иначе нажатие уедет с экраном", () => {
    const { e, prevented } = key(" ");
    activatable(() => {}).onKeyDown(e);
    expect(prevented.done, "preventDefault не вызван — страница прокрутится").toBe(true);
  });

  it("не срабатывает на посторонних клавишах", () => {
    const fn = vi.fn();
    for (const k of ["Tab", "Escape", "a", "ArrowDown", "Shift"]) {
      activatable(fn).onKeyDown(key(k).e);
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it("подписывает элемент, когда своего текста внутри нет", () => {
    expect(activatable(() => {}, "Применить шаблон")["aria-label"]).toBe("Применить шаблон");
    expect(activatable(() => {})).not.toHaveProperty("aria-label");
  });
});
