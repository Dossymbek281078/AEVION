import type { BrowserContext, Page } from "@playwright/test";

/**
 * Measure a first visit the way a stranger's phone experiences it.
 *
 * Written after three "cold" runs of the same build reported dead windows of
 * 17.0s, 9.9s and 0.8s. The culprit was the service worker: it answers from its
 * own cache, and `Network.setCacheDisabled` — which only governs the HTTP cache
 * — does not touch it. Any timing taken without unregistering it first measures
 * the worker's cache, not the page.
 *
 * `alive` is the moment React has hydrated: it stamps `__reactFiber$` keys onto
 * host nodes as it does so, which is true of any page and needs no cooperation
 * from the app.
 */
export interface ColdLoad {
  /** ms until the browser painted something */
  painted: number;
  /** ms until React had hydrated, or -1 if it never did within the budget */
  alive: number;
  /** the window where the page looks ready and answers nothing */
  dead: number;
}

/** A mid-range phone: six times slower CPU, 1.6 Mbps, 150 ms of latency. */
export const MID_RANGE_PHONE = {
  cpuThrottle: 6,
  latency: 150,
  downloadThroughput: 1.6e6 / 8,
  uploadThroughput: 750e3 / 8,
};

export async function clearServiceWorkers(page: Page, origin: string): Promise<number> {
  await page.goto(origin, { waitUntil: "domcontentloaded" }).catch(() => {});
  return page.evaluate(async () => {
    let removed = 0;
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) { await r.unregister(); removed++; }
    }
    if ("caches" in window) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
    return removed;
  });
}

export async function measureColdLoad(
  page: Page,
  context: BrowserContext,
  url: string,
  opts: { origin: string; budgetMs?: number } = { origin: "http://127.0.0.1:3100" },
): Promise<ColdLoad> {
  const budget = opts.budgetMs ?? 40_000;

  await clearServiceWorkers(page, opts.origin);
  await context.clearCookies();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: MID_RANGE_PHONE.cpuThrottle });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: MID_RANGE_PHONE.latency,
    downloadThroughput: MID_RANGE_PHONE.downloadThroughput,
    uploadThroughput: MID_RANGE_PHONE.uploadThroughput,
  });

  const started = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const painted = Date.now() - started;

  let alive = -1;
  while (Date.now() - started < budget) {
    const hydrated = await page
      .evaluate(() => {
        const el = document.querySelector("main *, body > div *");
        return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber$"));
      })
      .catch(() => false);
    if (hydrated) { alive = Date.now() - started; break; }
    await page.waitForTimeout(100);
  }

  // Leave the throttling off so a caller's later steps run at normal speed.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });

  return { painted, alive, dead: alive < 0 ? -1 : alive - painted };
}
