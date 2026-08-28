import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LongevityTool } from "../_tool";

/**
 * Проверка того, чего НЕ видит тест логики: работает ли кнопка.
 *
 * `tool.test.ts` проверяет функцию сравнения — она может быть безупречной, а
 * человек всё равно не получит ответа: не сработает обработчик, не обновится
 * состояние, результат не отрисуется. Ровно этот разрыв и есть «truth stops at
 * the API boundary» в миниатюре: значение посчитано, но до экрана не доехало.
 *
 * Браузером это проверить не удалось (он занят соседней сессией), и это к
 * лучшему: тест с настоящим рендером запускается всегда, а не когда свободен
 * браузер.
 */
describe("калькулятор: путь человека", () => {
  it("ввод вне диапазона → отклонение названо и объяснено", async () => {
    const user = userEvent.setup();
    render(<LongevityTool />);

    // Витамин D 35 при цели 40–60 — ниже нормы.
    await user.type(screen.getByLabelText("Vitamin D (25-OH)"), "35");
    await user.click(screen.getByRole("button", { name: /check my numbers/i }));

    expect(screen.getByText(/1 of 1 value you entered is outside target/i)).toBeTruthy();
    expect(screen.getByText(/below target/i)).toBeTruthy();
    // Диапазон назван рядом с вердиктом: без него «below target» не
    // проверяемо человеком. Ищем именно в строке результата — «40–60» есть и
    // в подписи поля, и первая версия теста падала на этой двусмысленности.
    expect(screen.getByText(/below target \(40–60\)/)).toBeTruthy();
  });

  it("ввод в диапазоне → говорит «в норме», а не молчит", async () => {
    const user = userEvent.setup();
    render(<LongevityTool />);

    await user.type(screen.getByLabelText("ApoB"), "70");
    await user.click(screen.getByRole("button", { name: /check my numbers/i }));

    expect(screen.getByText(/within target/i)).toBeTruthy();
  });

  it("пустая форма → честное «нечего проверять», а не «всё в норме»", async () => {
    // Самая опасная ветка: молчаливое превращение пропуска в норму — это то,
    // как отчёт становится успокаивающим и неверным.
    const user = userEvent.setup();
    render(<LongevityTool />);

    await user.click(screen.getByRole("button", { name: /check my numbers/i }));

    expect(screen.getByText(/nothing to check yet/i)).toBeTruthy();
    expect(screen.queryByText(/within target/i)).toBeNull();
  });

  it("считает только заполненное: знаменатель равен числу введённых значений", async () => {
    const user = userEvent.setup();
    render(<LongevityTool />);

    await user.type(screen.getByLabelText("Vitamin D (25-OH)"), "35"); // вне
    await user.type(screen.getByLabelText("ApoB"), "70"); // в норме
    await user.click(screen.getByRole("button", { name: /check my numbers/i }));

    // Одиннадцать полей в форме, но введено два — и знаменатель обязан быть 2,
    // а не 11. Иначе человек прочтёт «1 из 11» и решит, что у него почти всё
    // хорошо, хотя он проверил всего два маркера.
    expect(screen.getByText(/1 of 2 values you entered is outside target/i)).toBeTruthy();
  });

  it("до нажатия кнопки результата нет", async () => {
    const user = userEvent.setup();
    render(<LongevityTool />);

    await user.type(screen.getByLabelText("hs-CRP"), "5");

    expect(screen.queryByText(/outside target/i)).toBeNull();
    expect(screen.queryByText(/within target/i)).toBeNull();
  });
});
