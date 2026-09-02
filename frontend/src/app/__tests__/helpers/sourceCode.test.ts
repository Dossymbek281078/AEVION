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
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Перенос строки без обратной косой: она теряется на границе инструмента. */
const перенос = String.fromCharCode(10);

describe("две копии не расходятся", () => {
  /*
   * У помощника ДВЕ копии: одна у сайта, одна у бэкенда — наборы тестов
   * раздельные, общего модуля между ними нет.
   *
   * 01.09.2026 я чинил в них ОДИН И ТОТ ЖЕ дефект дважды, потому что копии
   * живут порознь и расходятся молча. Хуже: пока одна половина починена, а
   * другая нет, сторожа одной половины видят код, а другой — нет, и оба
   * зелёные. Здесь это и закрепляем.
   *
   * Сравниваем ТЕЛО функции, а не файл целиком: шапки у копий разные и должны
   * быть разными — каждая объясняет свою историю.
   */
  function телоФункции(путь: string): string {
    // Возврат каретки убираем без регулярки: обратная косая теряется на
    // границе инструмента и превращается в настоящий символ.
    const возврат = String.fromCharCode(13);
    const текст = readFileSync(путь, "utf8").split(возврат).join("");
    const от = текст.indexOf("export function stripComments");
    expect(от, `не нашёл функцию в ${путь}`).toBeGreaterThan(-1);
    const до = текст.indexOf(перенос + "}" + перенос, от);
    expect(до, `не нашёл конец функции в ${путь}`).toBeGreaterThan(от);
    return текст.slice(от, до);
  }

  it("реализация у сайта и у бэкенда одна и та же", () => {
    const сайт = телоФункции(join(process.cwd(), "src/app/__tests__/helpers/sourceCode.ts"));
    const бэкенд = телоФункции(
      join(process.cwd(), "../aevion-globus-backend/tests/helpers/sourceCode.ts"),
    );
    expect(
      бэкенд,
      "копии вырезалки разошлись: одна половина платформы будет видеть код, а другая нет",
    ).toBe(сайт);
  });
});

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
