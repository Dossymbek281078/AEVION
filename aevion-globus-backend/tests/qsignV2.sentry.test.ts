import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests Sentry wrapper behavior across two states:
 *   1) SENTRY_DSN unset → all calls are no-ops, returns false from init.
 *   2) SENTRY_DSN set → init returns true, captureException reaches Sentry.
 *
 * Module is reloaded per-test via vi.resetModules() so the internal `active`
 * flag and the mocked Sentry SDK don't leak across cases.
 */

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((cb: (s: any) => void) => {
    const scope = { setExtra: vi.fn(), setTag: vi.fn() };
    cb(scope);
    return scope;
  }),
  flush: vi.fn().mockResolvedValue(true),
}));

vi.mock("@sentry/node", () => sentryMocks);

describe("qsignV2 sentry wrapper", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    sentryMocks.init.mockClear();
    sentryMocks.captureException.mockClear();
    sentryMocks.withScope.mockClear();
    sentryMocks.flush.mockClear();
  });

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it("initSentry returns false when SENTRY_DSN is unset", async () => {
    delete process.env.SENTRY_DSN;
    const m = await import("../src/lib/qsignV2/sentry");
    expect(m.initSentry()).toBe(false);
    expect(m.isSentryActive()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("initSentry returns false on empty/whitespace DSN", async () => {
    process.env.SENTRY_DSN = "   ";
    const m = await import("../src/lib/qsignV2/sentry");
    expect(m.initSentry()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("captureException is a no-op when dormant", async () => {
    delete process.env.SENTRY_DSN;
    const m = await import("../src/lib/qsignV2/sentry");
    m.captureException(new Error("boom"), { foo: "bar" });
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
    expect(sentryMocks.withScope).not.toHaveBeenCalled();
  });

  it("flushSentry is a no-op when dormant", async () => {
    delete process.env.SENTRY_DSN;
    const m = await import("../src/lib/qsignV2/sentry");
    await m.flushSentry(100);
    expect(sentryMocks.flush).not.toHaveBeenCalled();
  });

  it("initSentry returns true and calls Sentry.init once when DSN is set", async () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/0";
    const m = await import("../src/lib/qsignV2/sentry");
    expect(m.initSentry()).toBe(true);
    expect(m.isSentryActive()).toBe(true);
    // idempotent
    expect(m.initSentry()).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);

    const cfg = sentryMocks.init.mock.calls[0][0];
    expect(cfg.dsn).toBe("https://abc@o0.ingest.sentry.io/0");
    expect(cfg.tracesSampleRate).toBe(0);
    expect(cfg.initialScope.tags.service).toBe("qsign-v2");
  });

  it("captureException forwards err + tags requestId/errorCode when active", async () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/0";
    const m = await import("../src/lib/qsignV2/sentry");
    m.initSentry();

    const err = new Error("db down");
    m.captureException(err, {
      requestId: "abc-123",
      errorCode: "sign_failed",
      method: "POST",
      path: "/api/qsign/v2/sign",
      ignored: undefined,
    });

    expect(sentryMocks.withScope).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(err);

    const scope = sentryMocks.withScope.mock.results[0].value;
    expect(scope.setTag).toHaveBeenCalledWith("requestId", "abc-123");
    expect(scope.setTag).toHaveBeenCalledWith("errorCode", "sign_failed");
    // undefined values shouldn't be forwarded
    const extraKeys = scope.setExtra.mock.calls.map((c: any[]) => c[0]);
    expect(extraKeys).not.toContain("ignored");
    expect(extraKeys).toContain("requestId");
    expect(extraKeys).toContain("errorCode");
  });

  it("respects SENTRY_TRACES_SAMPLE_RATE override", async () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/0";
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0.25";
    const m = await import("../src/lib/qsignV2/sentry");
    m.initSentry();
    const cfg = sentryMocks.init.mock.calls[0][0];
    expect(cfg.tracesSampleRate).toBe(0.25);
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
  });
});
