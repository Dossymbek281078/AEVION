import { describe, test, expect, beforeAll } from "vitest";
import { buildPlanetConsentEmail, PLANET_MAIL_LINK } from "../src/lib/planetConsentMail";
import { verifyMarketingToken } from "../src/lib/marketingConsent";
import { PLANET_TERM_PRICE, CHESS_YEARLY_USD } from "../src/data/pricing";

const EMAIL = "x@aevion.test";

describe("planetConsentMail", () => {
  beforeAll(() => {
    process.env.WAITLIST_UNSUB_SECRET = "test-secret-0123456789abcdef";
  });

  test("в тексте и html рабочая ссылка отписки с валидным токеном", () => {
    const m = buildPlanetConsentEmail(EMAIL);
    for (const body of [m.textContent!, m.htmlContent]) {
      const url = body.match(/https:\/\/api\.aevion\.app\/api\/auth\/marketing\/unsubscribe\?[^\s"<]+/)?.[0];
      expect(url).toBeTruthy();
      const u = new URL(url!);
      expect(u.searchParams.get("email")).toBe(EMAIL);
      expect(verifyMarketingToken(EMAIL, u.searchParams.get("t"))).toBe(true);
    }
  });

  test("цены совпадают с источником /api/pricing, метка ссылки mail-planet", () => {
    const m = buildPlanetConsentEmail(EMAIL);
    expect(PLANET_MAIL_LINK).toContain("?c=mail-planet");
    expect(m.textContent).toContain(`$${PLANET_TERM_PRICE.lite} за месяц`);
    expect(m.textContent).toContain(`$${PLANET_TERM_PRICE.max} в месяц`);
    expect(m.textContent).toContain(`$${CHESS_YEARLY_USD} в год`);
    expect(m.subject).toContain(`$${PLANET_TERM_PRICE.lite}`);
    expect(m.textContent).toContain(PLANET_MAIL_LINK);
    expect(m.to).toEqual([{ email: EMAIL }]);
  });

  test("нет секрета отписки — письмо не строится", () => {
    const a = process.env.WAITLIST_UNSUB_SECRET;
    const b = process.env.AUTH_JWT_SECRET;
    delete process.env.WAITLIST_UNSUB_SECRET;
    delete process.env.AUTH_JWT_SECRET;
    try {
      expect(() => buildPlanetConsentEmail(EMAIL)).toThrow();
    } finally {
      process.env.WAITLIST_UNSUB_SECRET = a;
      if (b !== undefined) process.env.AUTH_JWT_SECRET = b;
    }
  });
});
