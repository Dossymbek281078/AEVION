/**
 * sendBrevoEmail() (constitutionBrevo.ts, internal) had the same "HTTP 2xx
 * masks an actual failure" shape as the DevHub Brevo routes: it checked only
 * `r.ok` and counted a 2xx-with-no-messageId response as a clean send.
 * Exercised through the two exported callers since the internal function
 * itself isn't exported.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { sendWaitlistConfirm, sendWeeklyDigestEmail } from "../src/lib/constitutionBrevo";

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
