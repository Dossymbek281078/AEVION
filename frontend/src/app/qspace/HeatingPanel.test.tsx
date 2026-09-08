import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Room } from "./rooms";
import HeatingPanel from "./HeatingPanel";

const room = (index: number, area: number, perimeter: number): Room =>
  ({ index, area, perimeter, cx: 0, cy: 0 });

describe("панель тёплого пола", () => {
  it("без помещений говорит, что считать нечего, а не показывает нули", () => {
    render(<HeatingPanel rooms={[]} />);
    expect(screen.getByText(/считать нечего/)).toBeTruthy();
  });

  it("показывает метры трубы по каждому помещению и итог", () => {
    // Комнаты взяты небольшие намеренно: при 15 см шага комната больше ~14 м²
    // требует двух контуров, и её номер попадает ЕЩЁ и в предупреждение —
    // тогда getByText находит два совпадения и падает на моей же неточности.
    render(<HeatingPanel rooms={[room(1, 10, 13), room(2, 8, 11)]} />);
    expect(screen.getByText(/Помещение 1/)).toBeTruthy();
    expect(screen.getByText(/Помещение 2/)).toBeTruthy();
    expect(screen.getByText(/Всего трубы/)).toBeTruthy();
  });

  it("смена шага МЕНЯЕТ числа — кнопки не декоративные", () => {
    const { container } = render(<HeatingPanel rooms={[room(1, 20, 18)]} />);
    const before = container.textContent ?? "";
    fireEvent.click(screen.getByRole("button", { name: "10 см" }));
    const after = container.textContent ?? "";
    expect(after).not.toBe(before);
    // при вдвое меньшем шаге трубы должно стать больше
    const num = (t: string) => Number(/(\d+) м(?!²)/.exec(t)?.[1] ?? 0);
    expect(num(after)).toBeGreaterThan(num(before));
  });

  it("подпись объясняет выбранный шаг, а не повторяет число", () => {
    render(<HeatingPanel rooms={[room(1, 20, 18)]} />);
    expect(screen.getByText(/обычная жилая комната/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "10 см" }));
    expect(screen.getByText(/санузел/)).toBeTruthy();
  });

  it("граница расчёта написана на экране, а не только в коде", () => {
    render(<HeatingPanel rooms={[room(1, 20, 18)]} />);
    expect(screen.getByText(/не гидравлический расчёт/)).toBeTruthy();
  });

  it("длинный контур даёт предупреждение прямо в панели", () => {
    render(<HeatingPanel rooms={[room(1, 40, 26)]} />);
    expect(screen.getByText(/не влезает в один контур/)).toBeTruthy();
  });
});
