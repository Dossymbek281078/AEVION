import { describe, test, expect } from "vitest";
import { похожеНаПробу, просятПробы } from "../src/lib/probeRows";

/**
 * Наши пробы не считаются людьми в листе ожидания.
 *
 * Повод 06.10.2026: после проверки живости Brevo на проде осталась строка
 * `yahiin1978+probe-brevo@gmail.com`, `source: probe-brevo-0610`. Отписка у
 * поставщика её не трогает — она про рассылку, а не про наш учёт. А лист
 * ожидания — это цифра, по которой судят о спросе: одна наша строка в нём
 * врёт ровно так же, как выдуманная.
 *
 * Признак здесь ОБЩИЙ (`lib/probeRows`) — тот же, которым рассылка уже
 * отсеивает пробные адреса. Тест стережёт именно это: что признак ловит
 * обе формы пометки и не трогает живых людей.
 */

/** Как считает ручка: проба, если помечен адрес ИЛИ метка источника. */
const этоПроба = (r: { email: string; source?: string }) =>
  похожеНаПробу({ ref: r.email, title: r.source });

describe("лист ожидания: наши пробы не люди", () => {
  test("та самая строка из прода опознаётся как проба", () => {
    expect(этоПроба({ email: "yahiin1978+probe-brevo@gmail.com", source: "probe-brevo-0610" })).toBe(true);
  });

  test("помечен только источник — всё равно проба", () => {
    expect(этоПроба({ email: "someone@gmail.com", source: "probe-brevo-0610" })).toBe(true);
  });

  test("помечен только адрес — всё равно проба", () => {
    expect(этоПроба({ email: "smoke-c2@aevion.app", source: "landing" })).toBe(true);
  });

  test("🔴 живой человек НЕ отсекается", () => {
    // Контроль в обратную сторону. Признак, который считает пробой всё
    // подряд, молча обнулил бы лист ожидания — это хуже, чем лишняя строка.
    expect(этоПроба({ email: "test@company.com", source: "landing" })).toBe(false);
    expect(этоПроба({ email: "probert@gmail.com", source: "ig" })).toBe(false);
    expect(этоПроба({ email: "anna.petrova@mail.ru", source: "" })).toBe(false);
  });

  test("счёт и скрытое считаются из одного списка", () => {
    const строки = [
      { email: "human1@gmail.com", source: "landing" },
      { email: "yahiin1978+probe-brevo@gmail.com", source: "probe-brevo-0610" },
      { email: "human2@mail.ru", source: "ig" },
      { email: "smoke-c2@aevion.app", source: "landing" },
    ];
    const живые = строки.filter((r) => !этоПроба(r));
    const скрыто = строки.length - живые.length;
    expect(живые.length).toBe(2);
    expect(скрыто, "скрытое обязано называться числом, а не исчезать").toBe(2);
    expect(живые.length + скрыто).toBe(строки.length);
  });

  test("?includeProbes=1 возвращает пробы обратно — для наших же проверок", () => {
    expect(просятПробы({ includeProbes: "1" })).toBe(true);
    expect(просятПробы({})).toBe(false);
  });
});
