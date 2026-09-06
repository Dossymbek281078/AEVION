import { describe, test, expect } from "vitest";
import { welcomeHtml, welcomeText, type Subscription } from "../src/routes/provisioning";

/**
 * Сторож: письмо называет дату окончания ИЗ ПОДПИСКИ, а не пересчитанную.
 *
 * ЧТО БЫЛО (замер 03.09.2026). И HTML, и текстовое письмо считали дату сами:
 * `Date.now() + trialDays * 86400000`. Это второй источник правды об одном
 * факте, и он опасен двумя способами:
 *   • письмо, перерисованное позже (повтор, дайджест), назовёт дату ПОЗЖЕ той,
 *     что enforce-ят ворота, — человеку сказали неправду;
 *   • изменят правило срока — письмо молча продолжит считать по-старому.
 *     Ровно это случилось бы в тот же день: месячный срок переехал на календарь.
 *
 * Проверяется РАЗЛИЧАЮЩИЙ случай: в подписке стоит дата, заведомо далёкая от
 * «сейчас + trialDays». Совпадающие даты ничего бы не доказали.
 */
function подписка(поля: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_test",
    ts: new Date().toISOString(),
    email: "buyer@example.test",
    tierId: "medium",
    period: "monthly",
    seats: 1,
    modules: [],
    trialDays: 7,
    validUntil: "2030-06-15T10:00:00.000Z",
    amountUsd: 49,
    source: "test",
    ...поля,
  } as Subscription;
}

const ожидаемая = new Date("2030-06-15T10:00:00.000Z").toLocaleDateString("ru-RU");

describe("письмо берёт дату из подписки", () => {
  test("HTML-письмо показывает дату из поля validUntil", () => {
    expect(
      welcomeHtml(подписка()),
      `в письме нет даты ${ожидаемая} — значит она пересчитана, а не взята из подписки`
    ).toContain(ожидаемая);
  });

  test("текстовое письмо показывает ту же дату", () => {
    expect(welcomeText(подписка()), `текстовое письмо разошлось с HTML`).toContain(ожидаемая);
  });

  test("КОНТРОЛЬ: без пробного периода блок даты не показывается вовсе", () => {
    // Иначе «дата есть» удовлетворялось бы письмом, которое печатает её всегда.
    const без = подписка({ trialDays: 0 });
    expect(welcomeHtml(без)).not.toContain(ожидаемая);
    expect(welcomeText(без)).not.toContain(ожидаемая);
  });

  test("КОНТРОЛЬ: битая дата в подписке не роняет письмо", () => {
    // У старых записей поля может не быть или оно может быть мусором.
    const битая = подписка({ validUntil: "не-дата" });
    expect(() => welcomeHtml(битая)).not.toThrow();
    expect(() => welcomeText(битая)).not.toThrow();
  });
});
