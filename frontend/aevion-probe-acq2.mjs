import { chromium, devices } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
await page.goto("https://aevion.app/acquire", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(1000);
const r = await page.evaluate(() => {
  const de = document.documentElement;
  window.scrollTo(9999, 0); const sx = window.scrollX; window.scrollTo(0, 0);
  const bodyOX = getComputedStyle(document.body).overflowX;
  const htmlOX = getComputedStyle(de).overflowX;
  // видна ли почта целиком в пределах экрана
  let mail = null;
  for (const el of document.querySelectorAll("div")) {
    if (el.children.length === 0 && (el.textContent || "").trim() === "yahiin1978@gmail.com") {
      const b = el.getBoundingClientRect();
      mail = { left: Math.round(b.left), right: Math.round(b.right), vw: de.clientWidth };
      break;
    }
  }
  return { scrollX: sx, scrollW: de.scrollWidth, vw: de.clientWidth, bodyOX, htmlOX, mail };
});
console.log(`документ=${r.scrollW} экран=${r.vw}`);
console.log(`сдвиг вбок при попытке прокрутить: ${r.scrollX}px`);
console.log(`overflow-x: html=${r.htmlOX} body=${r.bodyOX}`);
console.log(r.mail ? `почта: слева=${r.mail.left} справа=${r.mail.right} при экране ${r.mail.vw} → ${r.mail.right > r.mail.vw ? "ОБРЕЗАНА" : "видна целиком"}` : "элемент с почтой не найден");
await browser.close();
