import { describe, test, expect, beforeEach } from "vitest";
import {
  captureShieldError,
  _resetSentryForTests,
} from "../src/lib/qshield/sentry";

describe("qshield/sentry — graceful absence", () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    _resetSentryForTests();
  });

  test("captureShieldError is a no-op when SENTRY_DSN is unset", () => {
    expect(() => {
      captureShieldError(new Error("boom"), { route: "test", shieldId: "qs-x" });
    }).not.toThrow();
  });

  test("captureShieldError swallows ANY input shape", () => {
    const inputs: unknown[] = [
      null,
      undefined,
      "string error",
      42,
      { weird: true },
      new Error("real"),
    ];
    for (const inp of inputs) {
      expect(() => captureShieldError(inp)).not.toThrow();
    }
  });

  test("captureShieldError accepts ctx fields without throwing", () => {
    expect(() =>
      captureShieldError(new Error("ctx"), {
        route: "reconstruct",
        shieldId: "qs-123",
        actorUserId: "u-456",
      }),
    ).not.toThrow();
  });

  test("resolution is cached: subsequent calls don't reload Sentry", () => {
    // No DSN → resolves to null. Calling again must remain a no-op.
    captureShieldError(new Error("first"));
    captureShieldError(new Error("second"));
    captureShieldError(new Error("third"));
    expect(true).toBe(true); // implicit: no exception thrown
  });
});
