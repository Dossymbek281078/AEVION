import { chromium, devices } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
for (const p of ["/", "/veilnetx", "/qchaingov"]) {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    await page.goto("https://aevion.app" + p, { waitUntil: "load", timeout: 30000 });
    // читаем ширину каждые 300мс в течение 3 секунд — видим ДИНАМИКУ, а не точку
    const series = await page.evaluate(async () => {
      const out = [];
      for (let k = 0; k < 10; k++) {
        out.push(document.documentElement.scrollWidth);
        await new Promise((r) => setTimeout(r, 300));
      }
      return out;
    });
    runs.push(series);
  }
  console.log(`\n${p}`);
  for (const s of runs) console.log("   " + s.join(" "));
}
await browser.close();
