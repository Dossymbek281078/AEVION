import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PaywallError,
  fetchOrPaywall,
  apiFetchOrPaywall,
  tierLabel,
  formatTiers,
  triggerPaywall,
  installPaywallInterceptor,
  PAYWALL_EVENT,
  type PaywallPayload,
  type PaywallEventDetail,
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

  it("служебное имя не превращается в подпись тарифа", () => {
    // Тип обещает CanonicalTier, но во время исполнения значение приходит из
    // ответа сервера. У обычного объекта `constructor` разрешается в
    // наследство и даёт ФУНКЦИЮ — истинную, поэтому страховка `?? t` её не
    // отсекает, и на экран уходит «function Object() { [native code] }».
    for (const имя of ["constructor", "toString", "__proto__", "valueOf"]) {
      const v = tierLabel(имя as never);
      expect(typeof v, `подпись тарифа ${имя} оказалась ${typeof v}`).toBe("string");
      expect(v.toLowerCase(), "в подпись попало внутреннее значение").not.toContain("native code");
    }
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

  it("returns {data:null} on 402 with malformed body (caller renders normally, no paywall)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(402, { unrelated: true }),
    );
    const r = await fetchOrPaywall("/api/test");
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data).toBeNull();
  });

  it("returns {data:null} when the backend is unreachable (fetch REJECTS, not a status)", async () => {
    // Единственный путь, который раньше проходил мимо разбора статусов: при
    // недоступном бэкенде fetch не возвращает ответ, а бросает. Исключение
    // улетало наверх, и страница отдавала 500 — замерено на собранном
    // приложении: /qrenew и /longevity падали, пока /apps, /shop и /pricing
    // рендерились. Политика та же, что для 5xx: не гейт, данных нет.
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );
    const r = await fetchOrPaywall("/api/qrenew/health");
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data).toBeNull();
  });

  it("returns {data:null} on non-2xx, non-402 statuses (transient errors don't throw — page renders empty)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(500, { error: "boom" }),
    );
    const r = await fetchOrPaywall("/api/test");
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data).toBeNull();
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

describe("formatTiers", () => {
  it("strips free and joins with /", () => {
    expect(formatTiers(["medium", "full", "enterprise"])).toBe("Medium / Full / Enterprise");
    expect(formatTiers(["free", "lite", "full"])).toBe("Lite / Full");
    expect(formatTiers(["free"])).toBe("");
  });
});

describe("triggerPaywall + PAYWALL_EVENT", () => {
  it("dispatches PAYWALL_EVENT with payload as detail", () => {
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    triggerPaywall(VALID_402);
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallPayload>;
    expect(evt.detail.module).toBe("qcoreai");
    expect(evt.detail.requiredTiers).toEqual(["medium", "full", "enterprise"]);
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });
});

describe("installPaywallInterceptor", () => {
  let origFetch: typeof fetch;
  beforeEach(() => {
    origFetch = window.fetch;
    // Reset the "already installed" marker so each test runs install fresh.
    delete (window as unknown as Record<symbol, unknown>)[Symbol.for("aevion.paywall.fetchPatched")];
  });
  afterEach(() => {
    window.fetch = origFetch;
  });

  function makeResponse(status: number, body: unknown): Response {
    const json = JSON.stringify(body);
    return new Response(json, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("is idempotent — second call does not double-wrap", () => {
    installPaywallInterceptor();
    const patched = window.fetch;
    installPaywallInterceptor();
    expect(window.fetch).toBe(patched);
  });

  it("passes 200 responses through unchanged + does not fire PAYWALL_EVENT", async () => {
    window.fetch = vi.fn().mockResolvedValue(makeResponse(200, { ok: true }));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    const res = await window.fetch("/api/anything");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });

  it("fires PAYWALL_EVENT on a valid 402 upgrade_required body — and the body is still readable by the caller", async () => {
    window.fetch = vi.fn().mockResolvedValue(makeResponse(402, VALID_402));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    const res = await window.fetch("/api/qcoreai/chat");
    // The clone-pattern keeps the original response body readable.
    const body = await res.json();
    expect(body.error).toBe("upgrade_required");
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallPayload>;
    expect(evt.detail.module).toBe("qcoreai");
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });

  // Регрессия: на /multichat-engine health-полоса опрашивала платную ручку
  // раз в 30 секунд. Каждый 402 поднимал модалку заново, и гость не мог
  // пользоваться бесплатным демо. Модалка отличает фон от действия по этому
  // флагу, поэтому перехватчик обязан его проставлять — и снимать ДО
  // запроса, иначе медленный ответ на клик выглядел бы фоновым.
  it("помечает 402 из фонового запроса как userInitiated:false", async () => {
    Object.defineProperty(navigator, "userActivation", {
      value: { isActive: false },
      configurable: true,
    });
    window.fetch = vi.fn().mockResolvedValue(makeResponse(402, VALID_402));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    await window.fetch("/api/multichat/provider-status");
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallEventDetail>;
    expect(evt.detail.userInitiated).toBe(false);
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
    delete (navigator as unknown as Record<string, unknown>).userActivation;
  });

  it("помечает 402 после жеста пользователя как userInitiated:true", async () => {
    Object.defineProperty(navigator, "userActivation", {
      value: { isActive: true },
      configurable: true,
    });
    window.fetch = vi.fn().mockResolvedValue(makeResponse(402, VALID_402));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    await window.fetch("/api/multichat/council");
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallEventDetail>;
    expect(evt.detail.userInitiated).toBe(true);
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
    delete (navigator as unknown as Record<string, unknown>).userActivation;
  });

  // Браузер без userActivation (Safari, Firefox) не должен молча проглатывать
  // платную стену: без сигнала считаем запрос пользовательским.
  it("без userActivation считает запрос пользовательским", async () => {
    delete (navigator as unknown as Record<string, unknown>).userActivation;
    window.fetch = vi.fn().mockResolvedValue(makeResponse(402, VALID_402));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    await window.fetch("/api/qcoreai/chat");
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallEventDetail>;
    expect(evt.detail.userInitiated).toBe(true);
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });

  it("does NOT fire PAYWALL_EVENT on a 402 with a non-upgrade body", async () => {
    window.fetch = vi.fn().mockResolvedValue(makeResponse(402, { error: "billing_required" }));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    await window.fetch("/api/other");
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });
});
