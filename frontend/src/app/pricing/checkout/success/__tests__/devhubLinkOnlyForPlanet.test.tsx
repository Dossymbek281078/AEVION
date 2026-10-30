import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * Шаг «Подключить покупку в DevHub» — ТОЛЬКО покупателю «Планеты».
 *
 * 30.10.2026: DevHub продаётся только планом «Планета», и его покупатель
 * возвращается с appId=platform. Первая правка показывала шаг всей ветке
 * `appId === "platform"`, а appId по умолчанию — "platform": без параметра
 * возвращаются бюро Verified (bureau.ts createIntent без successAppId) и
 * приложение со своим вариантом LS — им предлагали бы подключать DevHub
 * (вычитка Продукта 30.10). Явный признак: appId=platform или ref=tier_*.
 */

let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k }), useI18nOptional: () => null }));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));

// eslint-disable-next-line import/first
import Success from "../page";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: async () => ({ plan: "free" }) } as unknown as Response));
});
afterEach(() => vi.unstubAllGlobals());

async function шагDevHubЕсть(query: string): Promise<boolean> {
  params = new URLSearchParams(query);
  const { container } = render(<Success />);
  await waitFor(() => expect(container.textContent).toContain("checkoutSuccess.whatsNext"));
  return container.querySelector('a[href="/devhub/link"]') !== null;
}

describe("после оплаты: шаг DevHub только у «Планеты»", () => {
  test("appId=platform → есть", async () => {
    expect(await шагDevHubЕсть("appId=platform&provider=lemonsqueezy")).toBe(true);
  });
  test("ref=tier_medium без appId → есть", async () => {
    expect(await шагDevHubЕсть("ref=tier_medium&provider=lemonsqueezy")).toBe(true);
  });
  test("без appId и без ref (бюро Verified) → нет", async () => {
    expect(await шагDevHubЕсть("provider=lemonsqueezy")).toBe(false);
  });
  test("appId=cyberchess → нет", async () => {
    expect(await шагDevHubЕсть("appId=cyberchess&provider=lemonsqueezy")).toBe(false);
  });
  test("контроль: appId=devhub (старый товар) → есть, как и раньше", async () => {
    expect(await шагDevHubЕсть("appId=devhub&provider=lemonsqueezy")).toBe(true);
  });
});
