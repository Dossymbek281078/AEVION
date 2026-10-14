import { describe, it, expect, vi } from "vitest";
import { nuzhenPovtor, proveritIPovtorit, sostoyanieResend } from "../src/lib/resendDostavka";

/*
 * 🔴 135б (14.10.2026): «принято Resend» ≠ «дошло». Письмо гостю 00:02 вернулось bounced (SpamCop на IP SES)
 * при guestMailed:true. Через минуту спрашиваем last_event и при bounced/failed шлём то же письмо через Brevo.
 */
const письмо = { to: "guest@example.com", subject: "Your site on AEVION DevHub — coffee-3b67f3", html: "<p>x</p>", text: "x" };
const ответ = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("повтор через Brevo при отскоке Resend", () => {
  it("🔴 bounced → письмо уходит через Brevo тем же адресатом, темой и телом", async () => {
    const brevo = vi.fn(async () => ({ ok: true, messageId: "b1" }));
    const r = await proveritIPovtorit({ id: "01a136a4", pismo: письмо, key: "k", f: ответ({ last_event: "bounced" }), brevo: brevo as never });
    expect(r).toEqual({ lastEvent: "bounced", повтор: true, brevoOk: true });
    expect(brevo).toHaveBeenCalledTimes(1);
    const arg = (brevo.mock.calls[0] as unknown[])[0] as { to: Array<{ email: string }>; subject: string; htmlContent: string; textContent: string };
    expect(arg.to).toEqual([{ email: "guest@example.com" }]);
    expect(arg.subject).toBe(письмо.subject);
    expect(arg.textContent).toBe("x");
  });
  it("failed → тоже повтор; delivered / sent / delivery_delayed → без повтора", async () => {
    const brevo = vi.fn(async () => ({ ok: true }));
    expect((await proveritIPovtorit({ id: "x", pismo: письмо, key: "k", f: ответ({ last_event: "failed" }), brevo: brevo as never })).повтор).toBe(true);
    for (const ev of ["delivered", "sent", "delivery_delayed", "opened"]) {
      const r = await proveritIPovtorit({ id: "x", pismo: письмо, key: "k", f: ответ({ last_event: ev }), brevo: brevo as never });
      expect(r.повтор, ev).toBe(false);
    }
    expect(brevo).toHaveBeenCalledTimes(1);
  });
  it("отказ Brevo не глотается: повтор=true, brevoOk=false", async () => {
    const brevo = vi.fn(async () => ({ ok: false, error: "brevo 402" }));
    const r = await proveritIPovtorit({ id: "x", pismo: письмо, key: "k", f: ответ({ last_event: "bounced" }), brevo: brevo as never });
    expect(r).toEqual({ lastEvent: "bounced", повтор: true, brevoOk: false });
  });
  it("Resend не ответил (HTTP 500) → состояние null, повтора нет (не знаем — не шлём дубль)", async () => {
    expect(await sostoyanieResend("x", "k", ответ({}, false))).toBeNull();
    expect(nuzhenPovtor(null)).toBe(false);
  });
});
