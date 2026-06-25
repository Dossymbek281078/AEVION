import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PaywallError,
  fetchOrPaywall,
  apiFetchOrPaywall,
  tierLabel,
  type PaywallPayload,
} from "../paywall";

const VALID_402: PaywallPayload = {
  error: "upgrade_required",
  module: "qcoreai",
  plan: "free",
  requiredTiers: ["medium", "full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  message: "Модуль «qcoreai» доступен на тарифах: medium, full, enterprise.",
};

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("PaywallError", () => {
  it("carries the payload and uses message as Error.message", () => {
    const e = new PaywallError(VALID_402);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PaywallError");
    expect(e.message).toBe(VALID_402.message);
    expect(e.payload).toEqual(VALID_402);
  });
});

describe("tierLabel", () => {
  it("maps canonical tiers to human labels", () => {
    expect(tierLabel("free")).toBe("Free");
    expect(tierLabel("lite")).toBe("Lite");
    expect(tierLabel("medium")).toBe("Medium");
    expect(tierLabel("full")).toBe("Full");
    expect(tierLabel("enterprise")).toBe("Enterprise");
  });
});

describe("fetchOrPaywall", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns {data} on 200", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(200, { hello: "world" }),
    );
    const r = await fetchOrPaywall<{ hello: string }>("/api/test");
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data.hello).toBe("world");
  });

  it("returns {paywall} on 402 with valid payload", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(402, VALID_402),
    );
    const r = await fetchOrPaywall("/api/qcoreai/chat");
    expect("paywall" in r).toBe(true);
    if ("paywall" in r) expect(r.paywall.module).toBe("qcoreai");
  });

  it("throws on 402 with malformed body (treats as generic error)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(402, { unrelated: true }),
    );
    await expect(fetchOrPaywall("/api/test")).rejects.toThrow(/HTTP 402/);
  });

  it("throws on non-2xx, non-402 statuses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(500, { error: "boom" }),
    );
    await expect(fetchOrPaywall("/api/test")).rejects.toThrow(/HTTP 500/);
  });
});

describe("apiFetchOrPaywall", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on 200", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(200, { ok: true }),
    );
    const data = await apiFetchOrPaywall<{ ok: boolean }>("/api/test");
    expect(data.ok).toBe(true);
  });

  it("throws PaywallError on 402 with valid payload", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(402, VALID_402),
    );
    await expect(apiFetchOrPaywall("/api/qcoreai/chat")).rejects.toBeInstanceOf(
      PaywallError,
    );
  });

  it("PaywallError carries the original payload through", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(402, VALID_402),
    );
    let caught: PaywallError | null = null;
    try {
      await apiFetchOrPaywall("/api/qcoreai/chat");
    } catch (e) {
      if (e instanceof PaywallError) caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught?.payload.requiredTiers).toEqual([
      "medium",
      "full",
      "enterprise",
    ]);
  });

  it("throws plain Error on non-paywall failures", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(401, { error: "unauthorized" }),
    );
    await expect(apiFetchOrPaywall("/api/test")).rejects.toThrow(/HTTP 401/);
  });
});
