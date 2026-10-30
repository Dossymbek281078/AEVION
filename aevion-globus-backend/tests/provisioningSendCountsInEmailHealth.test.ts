import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * ПИСЬМО, УШЕДШЕЕ ЧЕРЕЗ provisioning.sendEmail, ВИДНО В /api/auth/email/healthz.
 *
 * Замер прода 30.10.2026 12:28Z: два письма (гостю DevHub и копия нам) реально
 * дошли, а healthz показывал «отправка.отправлено: 0» — у provisioning был
 * СВОЙ учёт с тем же именем записатьИсход, а healthz читал общий
 * lib/build/emailOutcomes. Два учёта одного факта → прибор врал, и окно
 * Приложений полчаса искало несуществующий отказ транспорта.
 */

const снимок = process.env.RESEND_API_KEY;
beforeEach(() => { process.env.RESEND_API_KEY = "re_test_key_for_counter"; });
afterEach(() => {
  if (снимок === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = снимок;
  vi.unstubAllGlobals();
});

describe("provisioning.sendEmail считается в общем учёте почты", () => {
  test("успех Resend → отправлено +1", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: "re_msg_1" }) })));
    const { sendEmail } = await import("../src/routes/provisioning");
    const { статусОтправки } = await import("../src/lib/build/emailOutcomes");
    const до = статусОтправки().отправлено;
    const r = await sendEmail({ to: "smoke-prilozh@example.com", subject: "t", html: "<p>t</p>", text: "t" } as never);
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("real");
    expect(статусОтправки().отправлено).toBe(до + 1);
  });

  test("отказ Resend → неудач +1, отправлено без изменений", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ message: "bad address" }) })));
    const { sendEmail } = await import("../src/routes/provisioning");
    const { статусОтправки } = await import("../src/lib/build/emailOutcomes");
    const до = статусОтправки();
    const r = await sendEmail({ to: "smoke-prilozh@example.com", subject: "t", html: "<p>t</p>", text: "t" } as never);
    expect(r.ok).toBe(false);
    expect(статусОтправки().неудач).toBe(до.неудач + 1);
    expect(статусОтправки().отправлено).toBe(до.отправлено);
  });
});
