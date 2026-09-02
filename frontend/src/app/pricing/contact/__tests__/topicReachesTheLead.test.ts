/**
 * Тема обращения из адреса доезжает до записи.
 *
 * Письмо о покупке ведёт на форму с `?topic=purchase`, соседние страницы — со
 * своими темами. Без чтения параметра все обращения выглядят одинаково, и
 * письмо ТОГО, КТО УЖЕ ЗАПЛАТИЛ, теряется среди прочих — а это человек,
 * которому мы уже должны.
 *
 * Отдельного поля не заводим: `source` уже сохраняется сервером в записи
 * обращения. Второе поле про то же самое разъехалось бы с ним.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../../__tests__/helpers/sourceCode";

const страница = stripComments(
  readFileSync(join(process.cwd(), "src/app/pricing/contact/page.tsx"), "utf8"),
);

describe("тема обращения", () => {
  it("страница читает параметр темы", () => {
    expect(страница).toContain('sp.get("topic")');
  });

  it("тема уезжает в source, а не в новое поле", () => {
    expect(страница, "тема не попала в source").toContain("`pricing/contact:${темаИзАдреса}`");
    expect(страница, "без темы source остаётся прежним").toContain('"pricing/contact"');
  });

  it("значение из адреса не принимается как есть", () => {
    // Параметр приходит из чужой ссылки. Без очистки в запись обращения уедет
    // что угодно — в том числе разметка и переводы строк.
    expect(страница, "нет очистки значения").toContain("replace(/[^a-z-]/g");
    expect(страница, "нет ограничения длины").toContain("slice(0, 20)");
  });
});
