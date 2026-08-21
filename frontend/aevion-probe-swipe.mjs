import { chromium, devices } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
for (const p of ["/partner", "/studio", "/go"]) {
  await page.goto("https://aevion.app" + p, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const before = window.scrollX;
    window.scrollTo(9999, 0);
    const after = window.scrollX;
    window.scrollTo(0, 0);
    return { before, after, maxScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(`${p.padEnd(12)} сдвиг вбок=${r.after}px (запас ${r.maxScroll}px) → ${r.after > 0 ? "ПРОКРУЧИВАЕТСЯ пальцем" : "не прокручивается"}`);
}
await browser.close();
