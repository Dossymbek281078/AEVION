import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for the shared per-service Sentry capture factory.
 *
 * The factory is gated behind `isSentryActive()` from qsignV2/sentry. We
 * mock both the gate and @sentry/node so we can drive the no-op path and
 * the active path without an actual SENTRY_DSN.
 */

const { sentryMock, isActiveMock } = vi.hoisted(() => ({
  sentryMock: {
    withScope: vi.fn(),
    captureException: vi.fn(),
  },
  isActiveMock: vi.fn(),
}));

vi.mock("@sentry/node", () => sentryMock);
vi.mock("../src/lib/qsignV2/sentry", () => ({
  isSentryActive: () => isActiveMock(),
}));

import { makeServiceCapture } from "../src/lib/sentry/platform";

describe("makeServiceCapture (platform Sentry helper)", () => {
  beforeEach(() => {
    sentryMock.withScope.mockReset();
    sentryMock.captureException.mockReset();
    isActiveMock.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a no-op when Sentry is dormant", () => {
    isActiveMock.mockReturnValue(false);
    const capture = makeServiceCapture("bureau");
    capture(new Error("boom"), { route: "verify/start" });
    expect(sentryMock.withScope).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it("captures + tags service when active", () => {
    isActiveMock.mockReturnValue(true);
    const scope = {
      setTag: vi.fn(),
      setUser: vi.fn(),
      setExtra: vi.fn(),
    };
    sentryMock.withScope.mockImplementation((fn: any) => fn(scope));

    const capture = makeServiceCapture("awards");
    const err = new Error("seasons failed");
    capture(err, { route: "seasons", entityId: "season-1", actorUserId: "u-42", reason: "ratelimit" });

    expect(sentryMock.withScope).toHaveBeenCalledOnce();
    expect(scope.setTag).toHaveBeenCalledWith("service", "awards");
    expect(scope.setTag).toHaveBeenCalledWith("route", "seasons");
    expect(scope.setTag).toHaveBeenCalledWith("entityId", "season-1");
    expect(scope.setUser).toHaveBeenCalledWith({ id: "u-42" });
    expect(scope.setExtra).toHaveBeenCalledWith("reason", "ratelimit");
    expect(sentryMock.captureException).toHaveBeenCalledWith(err);
  });

  it("strips null/undefined extras", () => {
    isActiveMock.mockReturnValue(true);
    const scope = { setTag: vi.fn(), setUser: vi.fn(), setExtra: vi.fn() };
    sentryMock.withScope.mockImplementation((fn: any) => fn(scope));

    const capture = makeServiceCapture("planet");
    capture(new Error("x"), { route: "stats", undef: undefined, nullable: null, real: "value" });

    expect(scope.setExtra).toHaveBeenCalledWith("real", "value");
    expect(scope.setExtra).not.toHaveBeenCalledWith("undef", expect.anything());
    expect(scope.setExtra).not.toHaveBeenCalledWith("nullable", expect.anything());
  });

  it("never throws even if Sentry SDK errors", () => {
    isActiveMock.mockReturnValue(true);
    sentryMock.withScope.mockImplementation(() => {
      throw new Error("sentry SDK exploded");
    });
    const capture = makeServiceCapture("qright");
    expect(() => capture(new Error("primary"), { route: "objects" })).not.toThrow();
  });

  it("does not set actorUserId tag when user is missing", () => {
    isActiveMock.mockReturnValue(true);
    const scope = { setTag: vi.fn(), setUser: vi.fn(), setExtra: vi.fn() };
    sentryMock.withScope.mockImplementation((fn: any) => fn(scope));

    const capture = makeServiceCapture("pipeline");
    capture(new Error("x"), { route: "protect" });

    expect(scope.setUser).not.toHaveBeenCalled();
  });
});
