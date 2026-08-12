// Шапка ЛСР: поле либо редактируется, либо честно показано нередактируемым.
//
// На уровнях 4 и 5 шапка получала `onChange={() => {}}` — заглушку. Поля при
// этом остаются УПРАВЛЯЕМЫМИ: у них задан `value`, а обработчик ничего не
// делает. Для студента это выглядит так: поле подсвечивается при фокусе,
// приглашает печатать — и ни один символ не появляется. Ни подсказки, ни
// объяснения; человек решает, что сломалась клавиатура или программа.
//
// «Только для чтения» — законное состояние, но оно должно быть видно.

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LsrFormHeader } from "./LsrFormHeader";
import type { LsrCalc, LsrMeta } from "../lib/types";

const META = { objectName: "Школа №47", contractNo: "12/2026" } as unknown as LsrMeta;
const CALC = {
  sections: [],
  total: 0,
  totalDirect: 0,
  totalOverhead: 0,
  totalProfit: 0,
} as unknown as LsrCalc;

describe("Шапка ЛСР", () => {
  test("в режиме просмотра поля помечены нередактируемыми", () => {
    render(<LsrFormHeader meta={META} calc={CALC} onChange={() => {}} readOnly />);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThan(0);
    // Не «выглядит редактируемым, но молчит», а прямо сказано браузеру и
    // человеку: это поле не для ввода.
    for (const i of inputs) expect(i.readOnly).toBe(true);
  });

  test("в режиме просмотра сказано словами, что документ не редактируется", () => {
    render(<LsrFormHeader meta={META} calc={CALC} onChange={() => {}} readOnly />);

    expect(screen.getByText(/только просмотр/i)).toBeTruthy();
  });

  test("в обычном режиме ввод доходит до обработчика", () => {
    const onChange = vi.fn();
    render(<LsrFormHeader meta={META} calc={CALC} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "Школа №48" } });
    expect(onChange).toHaveBeenCalled();
  });
});
