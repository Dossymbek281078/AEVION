import { chromium, devices } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
for (const p of ["/acquire", "/partner"]) {
  await page.goto("https://aevion.app" + p, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(1000);
  const beh = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await page.evaluate(() => window.scrollTo({ left: 9999, top: 0, behavior: "instant" }));
  await page.waitForTimeout(600);
  const r1 = await page.evaluate(() => ({ x: Math.round(window.scrollX) }));
  // и настоящим жестом
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.mouse.move(300, 400);
  await page.mouse.wheel(400, 0);
  await page.waitForTimeout(600);
  const r2 = await page.evaluate(() => ({ x: Math.round(window.scrollX) }));
  console.log(`${p.padEnd(11)} scroll-behavior=${beh} | instant→${r1.x}px | колесом→${r2.x}px`);
}
await browser.close();
