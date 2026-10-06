import { describe, it, expect } from "vitest";
import { разрезВоронки } from "../src/routes/events";

/**
 * Пометка «наше» обязана стоять у ВИЗИТОВ и у «дошли до цен», а не только у
 * начатых оплат. И единица у обоих — уникальные сессии.
 *
 * Замер 06.10.2026: наши собственные заходы с боевой меткой `?c=ig` раздули
 * Instagram до «70 % дошли до цен». Пометка «наше» в разрезах была только у
 * `checkoutStart`, поэтому отличить наш заход от зрителя было нечем, и канал
 * выглядел самым густым на платформе.
 *
 * Вторая половина — единица: до этой правки `visits` считал сессии, а
 * `pricing` рядом в том же объекте — каждый просмотр. Человек, открывший цены
 * трижды, давал «1 визит и 3 до цен», то есть долю больше 100 %.
 */
const просмотр = (channel: string, path: string, sid: string) => ({
  type: "page_view" as const,
  path,
  sid,
  meta: { channel },
});

describe("пометка «наше» и единица у визитов и цен", () => {
  it("🔴 наш заход помечен в visitsOurs и pricingOurs, живой — нет", () => {
    const наши = new Set(["s-наш"]);
    const р = разрезВоронки(
      [
        просмотр("instagram", "/go?c=probe-okno", "s-наш"),
        просмотр("instagram", "/pricing", "s-наш"),
        просмотр("instagram", "/go?c=ig", "s-живой"),
        просмотр("instagram", "/pricing", "s-живой"),
      ],
      наши,
    );
    const и = р.byChannel["instagram"];
    expect(и.visits, "обе сессии обязаны быть посчитаны").toBe(2);
    expect(и.visitsOurs, "наш заход не помечен").toBe(1);
    expect(и.visits - и.visitsOurs, "живой заход потерян").toBe(1);
    expect(и.pricing).toBe(2);
    expect(и.pricingOurs, "наш проход до цен не помечен").toBe(1);
  });

  it("🔴 «дошли до цен» считается по СЕССИЯМ, а не по просмотрам", () => {
    const р = разрезВоронки([
      просмотр("instagram", "/go?c=ig", "s1"),
      просмотр("instagram", "/pricing", "s1"),
      просмотр("instagram", "/pricing#apps", "s1"),
      просмотр("instagram", "/pricing?app=cyberchess", "s1"),
    ]);
    const и = р.byChannel["instagram"];
    expect(и.visits).toBe(1);
    expect(и.pricing, "три просмотра одной сессии посчитаны трижды").toBe(1);
  });

  it("разрез по постам помечает наше той же меркой", () => {
    const наши = new Set(["sp"]);
    const р = разрезВоронки(
      [
        {
          type: "page_view" as const,
          path: "/cyberchess?c=probe-okno",
          sid: "sp",
          meta: { channel: "instagram", post: "post3" },
        },
        {
          type: "page_view" as const,
          path: "/pricing",
          sid: "sp",
          meta: { channel: "instagram", post: "post3" },
        },
      ],
      наши,
    );
    const п = р.byPost["instagram/post3"];
    expect(п.visits).toBe(1);
    expect(п.visitsOurs).toBe(1);
    expect(п.pricing).toBe(1);
    expect(п.pricingOurs).toBe(1);
  });

  it("разрез по страницам входа помечает наши сессии", () => {
    const наши = new Set(["se"]);
    const р = разрезВоронки(
      [
        просмотр("instagram", "/go?c=probe-okno", "se"),
        просмотр("instagram", "/pricing", "se"),
        просмотр("instagram", "/go?c=ig", "sl"),
      ],
      наши,
    );
    const строка = р.byEntryPage["instagram|/go"];
    expect(строка.сессий).toBe(2);
    expect(строка.сессийНаших, "наш вход не помечен").toBe(1);
    expect(строка.доЦенНаших, "наш проход до цен не помечен").toBe(1);
  });

  it("КОНТРОЛЬ: без наших сессий пометки пустые, а числа на месте", () => {
    const р = разрезВоронки([
      просмотр("instagram", "/go?c=ig", "a"),
      просмотр("instagram", "/pricing", "a"),
    ]);
    const и = р.byChannel["instagram"];
    expect(и.visits).toBe(1);
    expect(и.visitsOurs, "живой заход объявлен нашим").toBe(0);
    expect(и.pricingOurs, "живой проход до цен объявлен нашим").toBe(0);
  });

  it("КОНТРОЛЬ: проба окна ?probe= тоже считается нашим заходом", () => {
    const р = разрезВоронки([просмотр("youtube", "/cyberchess?c=yt&probe=okno", "sw")], new Set(), new Set(["sw"]));
    const ю = р.byChannel["youtube"];
    expect(ю.visits).toBe(1);
    expect(ю.visitsOurs, "проверочный заход окна не помечен нашим").toBe(1);
  });
});
