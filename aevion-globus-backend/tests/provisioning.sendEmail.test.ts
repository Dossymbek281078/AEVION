/**
 * sendEmail() (provisioning.ts) is the shared welcome/receipt-email sender
 * behind provisionSubscription() — the single activation funnel for every
 * paid tier (Gumroad, LemonSqueezy, Paddle, Paybox, PayPal, stub-checkout).
 *
 * It used to check only `r.ok` on the Resend call and report ok:true even
 * when the response had no `id` (Resend's documented success shape) —
 * the same "HTTP 2xx masks an actual failure" bug found in DevHub today.
 * `RESEND_API_KEY` is read at module load time, so each scenario needs a
 * fresh module instance via vi.resetModules() + dynamic import.
 */
import { describe, test, expect, afterEach, vi } from "vitest";

describe("provisioning.sendEmail — degraded convention", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
  });

  test("stub mode (no RESEND_API_KEY) returns ok without hitting the network", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendEmail } = await import("../src/routes/provisioning");
    const r = await sendEmail({ to: "x@y.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("stub");
  });

  test("real mode with a message id → ok, not degraded", async () => {
    process.env.RESEND_API_KEY = "test-key";
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: "email_123" }) })) as unknown as typeof fetch;
    const { sendEmail } = await import("../src/routes/provisioning");
    const r = await sendEmail({ to: "x@y.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(r.ok).toBe(true);
    expect(r.id).toBe("email_123");
    expect(r.degraded).toBeUndefined();
  });

  test("2xx with no message id → ok:true, degraded:true — not a silent success", async () => {
    process.env.RESEND_API_KEY = "test-key";
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    const { sendEmail } = await import("../src/routes/provisioning");
    const r = await sendEmail({ to: "x@y.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(r.ok).toBe(true);
    expect(r.degraded).toBe(true);
    expect(r.degradedReason).toMatch(/message id/);
    expect(r.id).toBeUndefined();
  });

  test("HTTP error → ok:false, not degraded", async () => {
    process.env.RESEND_API_KEY = "test-key";
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ message: "invalid from address" }) })) as unknown as typeof fetch;
    const { sendEmail } = await import("../src/routes/provisioning");
    const r = await sendEmail({ to: "x@y.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid from address");
    expect(r.degraded).toBeUndefined();
  });
});
