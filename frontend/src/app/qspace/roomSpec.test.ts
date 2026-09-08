import { describe, expect, it } from "vitest";
import type { Room } from "./rooms";
import { roomSpec, roomSpecText } from "./roomSpec";

const room = (index: number, area: number, perimeter: number): Room =>
  ({ index, area, perimeter, cx: 0, cy: 0 });

describe("спецификация по комнатам", () => {
  const rooms = [room(1, 20, 18), room(2, 12, 14)];

  it("покрытие пола — площадь плюс ровно 5 % на подрезку", () => {
    const s = roomSpec(rooms, 2.7);
    expect(s.lines[0].flooring).toBeCloseTo(21, 9);
    expect(s.lines[1].flooring).toBeCloseTo(12.6, 9);
  });

  it("площадь стен — периметр × высоту, и высота действительно влияет", () => {
    expect(roomSpec(rooms, 2.7).lines[0].wallArea).toBeCloseTo(18 * 2.7, 9);
    // при потолке 2.56 (после ремонта) стен меньше ровно пропорционально
    expect(roomSpec(rooms, 2.56).lines[0].wallArea).toBeCloseTo(18 * 2.56, 9);
  });

  it("краска = площадь стен × 0.12 л/м² × 2 слоя", () => {
    const s = roomSpec(rooms, 2.7);
    expect(s.lines[0].paint).toBeCloseTo(18 * 2.7 * 0.24, 9);
  });

  it("плинтус — периметр минус двери, и никогда не отрицательный", () => {
    expect(roomSpec(rooms, 2.7, 0).lines[0].skirting).toBe(18);
    expect(roomSpec(rooms, 2.7, 0.9).lines[0].skirting).toBeCloseTo(17.1, 9);
    // нелепый ввод не даёт отрицательного плинтуса
    expect(roomSpec([room(1, 4, 2)], 2.7, 99).lines[0].skirting).toBe(0);
  });

  it("итоги — сумма строк, а не отдельно посчитанное число", () => {
    const s = roomSpec(rooms, 2.7);
    expect(s.totals.area).toBeCloseTo(32, 9);
    expect(s.totals.flooring).toBeCloseTo(s.lines[0].flooring + s.lines[1].flooring, 9);
    expect(s.totals.paint).toBeCloseTo(s.lines[0].paint + s.lines[1].paint, 9);
  });

  it("пустой список комнат даёт нули, а не падение", () => {
    const s = roomSpec([], 2.7);
    expect(s.lines).toEqual([]);
    expect(s.totals.area).toBe(0);
    expect(s.totals.paint).toBe(0);
  });

  it("текст для подрядчика содержит числа и НАЗЫВАЕТ допущения", () => {
    const t = roomSpecText(roomSpec(rooms, 2.7), "Демо: квартира 8 × 6 м");
    expect(t).toContain("Помещение 1");
    expect(t).toContain("20.0 м²");
    expect(t).toContain("Демо: квартира");
    expect(t).toContain("ИТОГО");
    // границы обязаны быть в тексте: он уйдёт человеку без нашей страницы
    expect(t).toMatch(/без вычета окон и дверей/);
    expect(t).toMatch(/не проектная документация|черновик для закупки/);
  });

  it("текст меняется вместе с числами — он не заготовка", () => {
    const a = roomSpecText(roomSpec([room(1, 20, 18)], 2.7), "план");
    const b = roomSpecText(roomSpec([room(1, 30, 22)], 2.7), "план");
    expect(a).not.toBe(b);
    expect(b).toContain("30.0 м²");
  });
});
