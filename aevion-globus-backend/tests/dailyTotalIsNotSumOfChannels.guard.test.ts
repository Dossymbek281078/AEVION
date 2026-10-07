import { describe, it, expect } from "vitest";
import { разрезВоронки } from "../src/routes/events";

/*
 * 🔴 Сторож на УТВЕРЖДЕНИЕ, а не на наличие поля.
 *
 * Предыдущий сторож этой сводки (`dailyDigestAnswersTheHandle`) проверял, что
 * поля `визиты`/`доЦен` ЕСТЬ в теле ответа. Это верно и это наш же урок, но
 * наличие поля ничего не говорит о значении: первая версия сводки собирала
 * итог суммой по каналам и была бы зелёной — расхождение с воронкой на том же
 * дне (визиты 438 против 431, до цен 60 против 81) нашла приёмка ЧТЕНИЕМ кода,
 * а не прогоном. Здесь мутация «считать итог суммой по каналам» краснеет.
 */
const визит = (sid: string, канал: string | undefined, path = "/") => ({
  type: "page_view" as const,
  path,
  sid,
  meta: канал ? { channel: канал } : {},
});

describe("итог дня — одна вещь, а не сумма разрезов", () => {
  it("человек с двумя метками — один визит в итоге и два в сумме по каналам", () => {
    const р = разрезВоронки([визит("s1", "youtube"), визит("s1", "instagram")]);
    const суммаПоКаналам = Object.values(р.byChannel).reduce((а, к) => а + к.visits, 0);

    expect(р.total.visits).toBe(1);
    // Контроль ОБРАТНОЙ стороны: сумма по каналам действительно даёт два —
    // то есть расхождение реально, а не придумано, и итог считается иначе.
    expect(суммаПоКаналам).toBe(2);
  });

  it("визит с незнакомой меткой попадает в итог, хотя канал «unknown»", () => {
    const р = разрезВоронки([визит("s9", "совсем-чужая-метка")]);
    expect(р.total.visits).toBe(1);
  });

  it("визит вовсе без метки попадает в итог", () => {
    const р = разрезВоронки([визит("s7", undefined)]);
    expect(р.total.visits).toBe(1);
  });

  it("до цен считается сессиями: два просмотра одной сессии — один", () => {
    const р = разрезВоронки([
      визит("s2", "youtube", "/pricing"),
      визит("s2", "youtube", "/pricing"),
      визит("s3", "youtube", "/pricing"),
    ]);
    expect(р.total.pricing).toBe(2);
  });

  it("наши заходы помечены в итоге и вычитаются до живого числа", () => {
    const р = разрезВоронки(
      [визит("s4", "probe-окно", "/pricing"), визит("s5", "youtube", "/pricing")],
      new Set(["s4"]),
      new Set(["s4"]),
    );
    expect(р.total.pricing).toBe(2);
    expect(р.total.pricingOurs).toBe(1);
    expect(р.total.pricing - р.total.pricingOurs).toBe(1);
  });

  it("страница «спасибо» не считается оплатой", () => {
    const р = разрезВоронки([
      { type: "checkout_success", path: "/thank-you", sid: "s6", meta: {} },
    ]);
    expect(р.total.thankYouOpened).toBe(1);
    expect(р.total.paid).toBe(0);
  });

  it("событие без sid не теряется", () => {
    const р = разрезВоронки([
      { type: "page_view", path: "/pricing", sid: undefined, meta: {} },
    ]);
    expect(р.total.visits).toBe(1);
    expect(р.total.pricing).toBe(1);
  });

  it("единица названа словами — иначе число сложат с числом другой единицы", () => {
    const р = разрезВоронки([визит("s8", "youtube")]);
    expect(р.totalUnits).toMatch(/уникальные сессии/);
  });
});
