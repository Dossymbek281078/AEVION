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

describe("площадь под встроенной мебелью доезжает до расчёта", () => {
  // Проверяется ПРОВОДКА, а не расчёт: у heatingPlan этот параметр был с
  // самого начала и объяснён комментарием, но панель его не передавала.
  // Тест на самой функции такой дефект не видит — она-то работает.
  const rooms = [room(1, 10, 13), room(2, 8, 11)];
  const totalPipe = (c: HTMLElement) =>
    Number(/Всего трубы\s*(\d+)/.exec(c.textContent ?? "")?.[1] ?? NaN);

  it("панель с мебелью показывает МЕНЬШЕ трубы, чем без неё", () => {
    const { container: без } = render(<HeatingPanel rooms={rooms} />);
    const a = totalPipe(без);
    const { container: с } = render(
      <HeatingPanel rooms={rooms} blockedAreaByRoom={{ 1: 3, 2: 2 }} />,
    );
    const b = totalPipe(с);
    expect(Number.isFinite(a) && Number.isFinite(b), "не нашёл итог трубы на экране").toBe(true);
    expect(b, "мебель не повлияла на экран — параметр до расчёта не доехал").toBeLessThan(a);
  });

  it("контроль: пустой список мебели ничего не меняет", () => {
    // без этого «меньше» неотличимо от «панель просто выдаёт разное»
    const { container: x } = render(<HeatingPanel rooms={rooms} />);
    const { container: y } = render(<HeatingPanel rooms={rooms} blockedAreaByRoom={{}} />);
    expect(totalPipe(y)).toBe(totalPipe(x));
  });
});

describe("подсказка не просит вычитать то, что уже вычтено", () => {
  // Прежде подсказка говорила «эту площадь вычтите сами» всегда. Правда до
  // того, как модуль научился вычитать её сам, и вредная ложь после:
  // послушавшись, человек вычел бы дважды и купил меньше трубы.
  const rooms = [room(1, 10, 13), room(2, 8, 11)];

  it("когда мебель учтена — говорит, что вычитать не нужно", () => {
    const { container } = render(
      <HeatingPanel rooms={rooms} blockedAreaByRoom={{ 1: 3, 2: 2 }} />);
    const t = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(t, "подсказка не называет, сколько уже вычтено").toMatch(/уже вычтено/);
    expect(t, "подсказка всё ещё просит вычесть вручную").not.toMatch(/вычтите сами/);
    expect(t, "не названо само число вычтенного").toMatch(/5\.0 м²/);
  });

  it("когда мебели нет — зовёт расставить, а не вычитать руками", () => {
    const { container } = render(<HeatingPanel rooms={rooms} />);
    const t = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(t).toMatch(/вычтется сама/);
    expect(t).not.toMatch(/уже вычтено/);
  });
});
