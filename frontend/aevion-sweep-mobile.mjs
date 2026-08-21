import { chromium, devices } from "playwright";
const PAGES = ["/","/explore","/devhub","/studio","/pricing","/apps","/qright","/qsign","/bureau",
"/planet","/awards","/bank","/cyberchess","/cyberchess/daily","/cyberchess/tournaments",
"/cyberchess/leaderboard","/qventure","/qskyway","/build","/qtrade","/smeta-trainer","/revenue",
"/pitch","/acquire","/go","/shop","/qmelanin","/qrenew","/longevity","/qpaynet","/multichat-engine",
"/qcontract","/qmaskcard","/qchaingov","/qevents","/qsocial","/partner","/investor","/compare",
"/constitution","/qcoreai","/veilnetx","/cyberchess/launch","/bureau/launch","/devhub/launch"];
const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
const bad = [], skipped = [];
for (const p of PAGES) {
  try {
    const resp = await page.goto("https://aevion.app" + p, { waitUntil: "load", timeout: 30000 });
    if (!resp || resp.status() >= 400) { skipped.push(`${p} код ${resp ? resp.status() : "?"}`); continue; }
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const de = document.documentElement, vw = de.clientWidth;
      const over = [...document.querySelectorAll("*")].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.right > vw + 1 && getComputedStyle(el).position !== "fixed";
      }).map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).slice(0,22) : "")
                    + " →" + Math.round(el.getBoundingClientRect().right));
      return { vw, scroll: de.scrollWidth, over: over.slice(0,3), n: over.length };
    });
    if (m.scroll > m.vw + 1) bad.push({ p, ...m });
  } catch (e) { skipped.push(`${p} ${e.name}`); }
}
console.log(`ПРОВЕРЕНО: ${PAGES.length - skipped.length} из ${PAGES.length}`);
if (skipped.length) console.log(`не проверено (${skipped.length}): ${skipped.join(", ")}`);
console.log(`\nШИРЕ ЭКРАНА: ${bad.length}`);
for (const b of bad) console.log(`  ${b.p.padEnd(26)} документ=${b.scroll} при ${b.vw}  за краем ${b.n}: ${b.over.join(" | ")}`);
await browser.close();
