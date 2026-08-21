import { chromium, devices } from "playwright";
const TARGETS = ["/smeta-trainer", "/qmaskcard", "/partner", "/qsocial", "/veilnetx", "/pitch"];
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
console.log("страница          пауза700  пауза2500  пауза2500(2)");
for (const p of TARGETS) {
  const vals = [];
  for (const wait of [700, 2500, 2500]) {
    await page.goto("https://aevion.app" + p, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(wait);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    vals.push(w);
  }
  const stable = vals.every((v) => v === vals[0]);
  console.log(`${p.padEnd(18)}${String(vals[0]).padStart(7)}${String(vals[1]).padStart(10)}${String(vals[2]).padStart(13)}  ${stable ? "" : "← НЕСТАБИЛЬНО"}`);
}
await browser.close();
