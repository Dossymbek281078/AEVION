/**
 * Сторож самого помощника: им пользуются шесть проверок, а своего теста у него
 * не было.
 *
 * Опасность у вырезалки комментариев ОДНОСТОРОННЯЯ и тихая: если она съест
 * лишнее, сторож вида «такого не должно быть» перестанет это видеть и
 * останется ЗЕЛЁНЫМ. Красный от неё заметят и починят, зелёный — нет.
 */
import { describe, it, expect } from "vitest";
import { stripComments } from "./sourceCode";

describe("вырезалка комментариев", () => {
  it("убирает строчный и блочный комментарий", () => {
    expect(stripComments("const a = 1; // хвост")).toContain("const a = 1;");
    expect(stripComments("const a = 1; // хвост")).not.toContain("хвост");
    expect(stripComments("/* весь\n блок */ const b = 2;")).toContain("const b = 2;");
    expect(stripComments("/* весь\n блок */ const b = 2;")).not.toContain("весь");
  });

  it("путь-шаблон в комментарии не съедает код ниже", () => {
    // Живой случай 01.09.2026: в шапке страницы стоял путь
    // frontend/src/app/developers/fintech/** — прежняя вырезалка приняла его за
    // открывающую пару и удалила всё до следующего закрытия, вместе с
    // настоящим адресом на странице. Сторож мёртвых адресов молчал.
    const код = ["/** владелец: app/developers/fintech/** */", 'const x = "support@aevion.app";'].join("\n");
    expect(stripComments(код), "код после пути-шаблона исчез").toContain("support@aevion.app");
  });

  it("двойная косая ВНУТРИ строки не обрубает её", () => {
    // href="https://aevion.app/x" обрубалось до href="https:
    const код = 'const u = "https://aevion.app/x";';
    expect(stripComments(код), "адрес в ссылке потерян").toContain("aevion.app/x");
  });

  it("комментарий внутри строки остаётся текстом", () => {
    const код = 'const s = "это /* не */ комментарий";';
    expect(stripComments(код)).toContain("не");
  });

  it("настоящий комментарий после строки всё-таки убирается", () => {
    const код = 'const s = "текст"; // убрать';
    expect(stripComments(код)).toContain("текст");
    expect(stripComments(код)).not.toContain("убрать");
  });
});
