import { describe, test, expect } from "vitest";
import { stackForIdea } from "../devhubStackChoice";

// На этой функции держится обещание витрины: «правьте кликами» работает
// только на static, и страничные идеи обязаны туда попадать. Примеры ниже —
// ровно те три, что витрина предлагает как кнопки, плюс краевые случаи.
describe("выбор стека из идеи главного входа", () => {
  test("примеры с витрины попадают куда обещано", () => {
    expect(stackForIdea("лендинг кофейни с меню и формой брони")).toBe("static");
    expect(stackForIdea("портфолио фотографа с галереей и тёмной темой")).toBe("static");
    expect(stackForIdea("трекер задач с базой данных и статусами")).toBe("react");
  });

  test("«с базой» без слова «данных» — тоже приложение (регрессия баз[ае])", () => {
    expect(stackForIdea("лендинг с базой клиентов")).toBe("react");
  });

  test("идея без страничных слов — react по умолчанию", () => {
    expect(stackForIdea("игра в крестики-нолики")).toBe("react");
  });

  test("страничные слова по-английски работают", () => {
    expect(stackForIdea("landing page for a coffee shop")).toBe("static");
  });
});
