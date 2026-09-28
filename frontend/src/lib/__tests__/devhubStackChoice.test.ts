import { describe, test, expect } from "vitest";
import { stackForIdea, даннымНуженСервер } from "../devhubStackChoice";

// На этой функции держится главное обещание входа: «опиши — получишь живой
// адрес». Замер на проде 28.09: static → адрес 200 за 45–88 с; react и next →
// публикация «ok», адрес 404 и через 155 с (Pages ничего не собирает).
// Поэтому вход обязан создавать static для ЛЮБОЙ идеи, включая те, что раньше
// уходили в react.
describe("выбор стека из идеи главного входа", () => {
  test("страничные идеи — static (как было)", () => {
    expect(stackForIdea("лендинг кофейни с меню и формой брони")).toBe("static");
    expect(stackForIdea("портфолио фотографа с галереей и тёмной темой")).toBe("static");
    expect(stackForIdea("landing page for a coffee shop")).toBe("static");
  });

  test("идеи с данными — тоже static: react отдавал 404", () => {
    expect(stackForIdea("трекер задач с базой данных и статусами")).toBe("static");
    expect(stackForIdea("лендинг с базой клиентов")).toBe("static");
    expect(stackForIdea("игра в крестики-нолики")).toBe("static");
    expect(stackForIdea("")).toBe("static");
  });

  test("признак «нужен сервер» сохранён для подписи на экране", () => {
    expect(даннымНуженСервер("трекер задач с базой данных")).toBe(true);
    expect(даннымНуженСервер("магазин с оплатой и корзиной")).toBe(true);
    expect(даннымНуженСервер("портфолио фотографа с галереей")).toBe(false);
  });
});
