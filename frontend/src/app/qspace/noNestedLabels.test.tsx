import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { Room } from "./rooms";
import HeatingPanel from "./HeatingPanel";
import VentilationPanel from "./VentilationPanel";
import CoolingPanel from "./CoolingPanel";

/**
 * Вложенных `<label>` в модуле быть не должно.
 *
 * `<label>` внутри `<label>` — недопустимая разметка. Браузер её терпит, но
 * экранный диктор читает подпись не тому органу управления, а клик по
 * внутренней подписи может активировать внешний. Тесты поведения этого не
 * видят: компонент отрисован, кнопки нажимаются, всё «работает».
 *
 * Поймано вычиткой в VentilationPanel: строка помещения была обёрнута в
 * `<label>`, а внутри стоял свой `<label>` у флажка «без окна».
 *
 * Проверяется на ОТРИСОВАННОМ дереве, а не грепом по исходнику: вложенность
 * возникает при сборке из компонентов, и в тексте одного файла её может быть
 * не видно.
 */

const room = (index: number, area: number, perimeter: number): Room =>
  ({ index, area, perimeter, cx: 0, cy: 0 });

const rooms = [room(1, 20, 18), room(2, 12, 14)];

function nestedLabelCount(container: HTMLElement): number {
  return container.querySelectorAll("label label").length;
}

describe("вложенных label в модуле нет", () => {
  it("панель вентиляции", () => {
    const { container } = render(<VentilationPanel rooms={rooms} />);
    expect(nestedLabelCount(container), "label внутри label в панели вентиляции").toBe(0);
  });

  it("панель кондиционирования", () => {
    const { container } = render(<CoolingPanel rooms={rooms} />);
    expect(nestedLabelCount(container), "label внутри label в панели сплитов").toBe(0);
  });

  it("у каждого органа управления панели сплитов есть имя", () => {
    const { container } = render(<CoolingPanel rooms={rooms} />);
    const controls = container.querySelectorAll("select, input, button");
    expect(controls.length, "органов управления не найдено — проверка пуста").toBeGreaterThan(2);
    for (const el of Array.from(controls)) {
      const aria = el.getAttribute("aria-label");
      const inLabel = el.closest("label") !== null;
      const id = el.getAttribute("id");
      const labelled = id ? container.querySelector(`label[for="${id}"]`) !== null : false;
      expect(Boolean(aria) || inLabel || labelled,
        `орган ${el.tagName.toLowerCase()} без имени`).toBe(true);
    }
  });

  it("панель тёплого пола", () => {
    const { container } = render(<HeatingPanel rooms={rooms} />);
    expect(nestedLabelCount(container)).toBe(0);
  });

  it("контроль прибора: вложенность НАХОДИТСЯ, когда она есть", () => {
    // без этого «ноль вложенных» неотличимо от «проверка ничего не смотрит»
    const { container } = render(
      <label>
        снаружи
        <label>
          внутри <input type="checkbox" readOnly checked={false} />
        </label>
      </label>,
    );
    expect(nestedLabelCount(container)).toBe(1);
  });

  it("у каждого органа управления в панелях есть доступное имя", () => {
    // родственная проверка: подпись потеряться не должна и после разъединения
    const { container } = render(<VentilationPanel rooms={rooms} />);
    const controls = container.querySelectorAll("select, input, button");
    expect(controls.length, "органов управления не найдено — проверка пуста").toBeGreaterThan(2);
    for (const el of Array.from(controls)) {
      const aria = el.getAttribute("aria-label");
      const inLabel = el.closest("label") !== null;
      const id = el.getAttribute("id");
      const labelled = id ? container.querySelector(`label[for="${id}"]`) !== null : false;
      expect(
        Boolean(aria) || inLabel || labelled,
        `орган ${el.tagName.toLowerCase()} без имени: диктор прочитает только роль`,
      ).toBe(true);
    }
  });
});
