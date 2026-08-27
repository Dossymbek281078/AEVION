/**
 * sendBrevoEmail() (constitutionBrevo.ts, internal) had the same "HTTP 2xx
 * masks an actual failure" shape as the DevHub Brevo routes: it checked only
 * `r.ok` and counted a 2xx-with-no-messageId response as a clean send.
 * Exercised through the two exported callers since the internal function
 * itself isn't exported.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { sendWaitlistConfirm, sendWeeklyDigestEmail, buildWaitlistConfirmEmail } from "../src/lib/constitutionBrevo";

describe("constitutionBrevo — degraded convention", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.BREVO_API_KEY;
    vi.restoreAllMocks();
  });

  test("sendWeeklyDigestEmail counts a 2xx-with-messageId batch as sent", async () => {
    process.env.BREVO_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ messageId: "msg-1" }) })) as unknown as typeof fetch;

    const r = await sendWeeklyDigestEmail([{ email: "a@b.com" }], [], "16 июля 2026");

    expect(r).toEqual({ sent: 1, errors: 0, degraded: 0 });
  });

  test("sendWeeklyDigestEmail: 2xx with no messageId is tracked as degraded, not sent", async () => {
    process.env.BREVO_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = await sendWeeklyDigestEmail([{ email: "a@b.com" }, { email: "c@d.com" }], [], "16 июля 2026");

    expect(r).toEqual({ sent: 0, errors: 0, degraded: 2 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/degraded/i));
  });

  test("sendWeeklyDigestEmail: HTTP error is a hard failure, not degraded", async () => {
    process.env.BREVO_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad request" })) as unknown as typeof fetch;

    const r = await sendWeeklyDigestEmail([{ email: "a@b.com" }], [], "16 июля 2026");

    expect(r).toEqual({ sent: 0, errors: 1, degraded: 0 });
  });

  test("sendWaitlistConfirm warns (not errors) when Brevo response is degraded", async () => {
    process.env.BREVO_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendWaitlistConfirm("a@b.com");

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/degraded/i));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("constitutionBrevo — письмо соответствует источнику подписки", () => {
  // Таблица constitution_waitlist принимает адреса и с главной, и с /go
  // (14.08.2026). До этой правки все получали письмо про Constitution Pro со
  // скидкой на продукт, о котором не просили, и с подписью «вы подписались на
  // aevion.app/constitution/pricing» — неправдой для всех, кроме конституции.

  test("подписка с главной: письмо про ранний доступ, без конституции", () => {
    const p = buildWaitlistConfirmEmail("a@b.com", "home");

    expect(p.subject).not.toMatch(/Constitution/i);
    expect(p.htmlContent).not.toMatch(/Constitution Pro/i);
    expect(p.htmlContent).not.toMatch(/constitution\/pricing/i);
    expect(p.subject).toMatch(/раннего доступа/i);
    expect(p.htmlContent).toContain("главной странице aevion.app");
  });

  test("подписка с /go: письмо называет именно ту страницу", () => {
    const p = buildWaitlistConfirmEmail("a@b.com", "go");

    expect(p.htmlContent).toContain("странице aevion.app/go");
    expect(p.htmlContent).not.toMatch(/Constitution Pro/i);
  });

  test("подписка со страницы конституции остаётся прежней", () => {
    const p = buildWaitlistConfirmEmail("a@b.com", "constitution-pricing");

    expect(p.subject).toMatch(/Constitution Pro/);
    expect(p.htmlContent).toMatch(/30% скидкой/);
  });

  test("источник не указан — прежнее поведение, конституционное письмо", () => {
    const p = buildWaitlistConfirmEmail("a@b.com");

    expect(p.subject).toMatch(/Constitution Pro/);
  });

  test("адрес для отписки подставлен в обе ветки", () => {
    // Секрет задаётся здесь намеренно. С 21.08 ссылка отписки несёт ТОКЕН, и без
    // секрета её не существует вовсе: письмо тогда честно пишет адрес почты вместо
    // ссылки, которая молча не сработает. Замысел этого теста — проверить, что
    // необычный адрес (`a+b@c.com`) кодируется правильно, — поэтому даём секрет и
    // проверяем то же самое на рабочей ссылке.
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars-long";
    for (const src of ["home", "constitution-pricing"]) {
      const p = buildWaitlistConfirmEmail("a+b@c.com", src);
      expect(p.htmlContent).toContain("unsubscribe?email=a%2Bb%40c.com");
      expect(p.htmlContent).toMatch(/&t=[0-9a-f]{32}/);
    }
  });

  test("без секрета письмо даёт живой адрес почты, а не мёртвую ссылку", () => {
    // Обратная сторона того же решения: раньше в письме стояла ссылка на страницу,
    // которой не существует (404). Тишина или нерабочая ссылка здесь хуже, чем
    // просьба написать письмом.
    const saved = process.env.AUTH_JWT_SECRET;
    const savedUnsub = process.env.WAITLIST_UNSUB_SECRET;
    delete process.env.AUTH_JWT_SECRET;
    delete process.env.WAITLIST_UNSUB_SECRET;
    try {
      const p = buildWaitlistConfirmEmail("a+b@c.com", "home");
      expect(p.htmlContent).not.toMatch(/unsubscribe\?email=/);
      expect(p.htmlContent).toMatch(/mailto:/);
    } finally {
      if (saved) process.env.AUTH_JWT_SECRET = saved;
      if (savedUnsub) process.env.WAITLIST_UNSUB_SECRET = savedUnsub;
    }
  });
});

/**
 * До 19.08 sendWaitlistConfirm возвращала void, а вызывающий гасил результат
 * через .catch(() => {}). Провал отправки был снаружи неотличим от задержки
 * почты: человек подписан, письма нет, тревоги нет. Проверяем именно ОТВЕТ.
 */
describe("sendWaitlistConfirm — отвечает, дошло ли", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.BREVO_API_KEY;
    vi.restoreAllMocks();
  });

  test("отказ Brevo даёт false, а не молчание", async () => {
    process.env.BREVO_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 402, text: async () => "quota exceeded" })) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendWaitlistConfirm("a@b.com", "go")).resolves.toBe(false);
  });

  test("успешная отправка даёт true", async () => {
    process.env.BREVO_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ messageId: "msg-9" }) })) as unknown as typeof fetch;

    await expect(sendWaitlistConfirm("a@b.com", "go")).resolves.toBe(true);
  });
});
