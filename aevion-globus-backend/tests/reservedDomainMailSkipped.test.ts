import { describe, test, expect, afterEach, vi } from "vitest";
import { адресНаТестовомДомене } from "../src/lib/reservedEmailDomain";

describe("адресНаТестовомДомене", () => {
  test.each(["a@example.com", "a@sub.example.org", "a@a.test", "a@x.invalid", "ls-smoke-1@test.aevion.dev", "a@example.net", "a@foo.localhost"])("%s → true", (e) => {
    expect(адресНаТестовомДомене(e)).toBe(true);
  });
  test.each(["a@gmail.com", "a@aevion.app", "a@example.com.kz", "nodomain", ""])("%s → false", (e) => {
    expect(адресНаТестовомДомене(e)).toBe(false);
  });
});

describe("sendEmail и тестовый домен", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
  });

  test("example.com: fetch не вызван, skipped, учтён пропуск, не отправка и не неудача", async () => {
    process.env.RESEND_API_KEY = "test-key";
    vi.resetModules();
    const f = vi.fn();
    globalThis.fetch = f as unknown as typeof fetch;
    const { sendEmail } = await import("../src/routes/provisioning");
    const { статусОтправки } = await import("../src/lib/build/emailOutcomes");
    const r = await sendEmail({ to: "x@example.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(f).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("reserved domain");
    const s = статусОтправки();
    expect(s.пропущено).toBe(1);
    expect(s.отправлено).toBe(0);
    expect(s.неудач).toBe(0);
  });

  test("обычный адрес: Resend вызывается", async () => {
    process.env.RESEND_API_KEY = "test-key";
    vi.resetModules();
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: "e1" }) }));
    globalThis.fetch = f as unknown as typeof fetch;
    const { sendEmail } = await import("../src/routes/provisioning");
    const r = await sendEmail({ to: "x@gmail.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.id).toBe("e1");
    expect(r.skipped).toBeUndefined();
  });

  test("sendBrevoEmail на example.com: fetch не вызван", async () => {
    process.env.BREVO_API_KEY = "k";
    vi.resetModules();
    const f = vi.fn();
    globalThis.fetch = f as unknown as typeof fetch;
    const { sendBrevoEmail } = await import("../src/lib/constitutionBrevo");
    const r = await sendBrevoEmail({ to: [{ email: "x@example.com" }], subject: "s", htmlContent: "<p>h</p>" });
    delete process.env.BREVO_API_KEY;
    expect(f).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, skipped: "reserved domain" });
  });
});
