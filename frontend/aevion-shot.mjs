import { chromium, devices } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
await page.goto("https://aevion.app/acquire", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(1200);
const box = await page.evaluate(() => {
  for (const el of document.querySelectorAll("div")) {
    if (el.children.length === 0 && (el.textContent||"").trim() === "yahiin1978@gmail.com") {
      const b = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + b.top - 200);
      return true;
    }
  }
  return false;
});
await page.waitForTimeout(600);
await page.screenshot({ path: "C:/Users/user/AppData/Local/Temp/claude/C--Users-user/eec0c089-dd92-47fe-a2d5-b861de243ea9/scratchpad/acquire-phone.png" });
console.log("нашёл почту и прокрутил:", box);
await browser.close();
