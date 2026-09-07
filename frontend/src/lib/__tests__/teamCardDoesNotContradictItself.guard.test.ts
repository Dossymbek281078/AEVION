import { describe, expect, it } from "vitest";
import { SUBSCRIPTIONS } from "../products";

/**
 * Карточка Constitution Team не противоречит сама себе.
 *
 * ЗАЧЕМ. Замер живой витрины 07.09.2026: desc Team ($49) дословно копировал
 * desc Pro ($9) ВМЕСТЕ с перечнем возможностей Pro, а includes той же
 * карточки честно говорил «Состав пакета не описан продавцом». Покупатель
 * видел два ответа об одном (класс платформы «два наших ответа об одном
 * предмете расходятся») и разумно купить Team не мог.
 *
 * Правило: ПОКА includes Team говорит «не описан», desc не имеет права
 * обещать состав — ни своим текстом, ни копией чужого. Когда основатель
 * определит состав Team, оба поля меняются вместе, и этот сторож — тоже.
 */
describe("карточка Team не спорит сама с собой", () => {
  const team = SUBSCRIPTIONS.find((p) => p.id === "wjvquw");
  const pro = SUBSCRIPTIONS.find((p) => p.id === "pyiaz");

  it("обе карточки существуют — иначе проверки пусты", () => {
    expect(team, "Team (wjvquw) пропал из подписок").toBeTruthy();
    expect(pro, "Pro (pyiaz) пропал из подписок").toBeTruthy();
  });

  it("пока состав «не описан», desc не перечисляет возможности", () => {
    const неОписан = (team!.includes ?? []).some((s) => /не описан/i.test(s));
    if (!неОписан) return; // состав определили — противоречие исчезло по-настоящему
    for (const фича of pro!.includes ?? []) {
      expect(
        team!.desc,
        `desc Team обещает «${фича}», а includes говорит «состав не описан»`,
      ).not.toContain(фича);
    }
  });

  it("desc Team не является копией desc Pro при пятикратной разнице цены", () => {
    expect(
      team!.desc === pro!.desc,
      "Team за $49 описан дословно как Pro за $9 — за что доплата?",
    ).toBe(false);
  });
});
