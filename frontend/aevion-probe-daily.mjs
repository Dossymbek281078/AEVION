import { chromium, devices } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"] });
const p = await ctx.newPage();
await p.goto("https://aevion.app/cyberchess/daily", { waitUntil: "load", timeout: 45000 });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const de = document.documentElement, W = de.clientWidth;
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== de; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
    }
    return false;
  };
  const g = [...document.querySelectorAll("*")].filter((el) => {
    const st = getComputedStyle(el);
    if (st.position === "fixed" || st.position === "sticky") return false;
    const rc = el.getBoundingClientRect();
    return rc.width > 0 && rc.right > W + 1 && !clipped(el);
  });
  // листьев нет — значит виноват сам контейнер шириной больше экрана,
  // а не его содержимое: смотрим САМЫЙ ГЛУБОКИЙ из виновных и его стили
  const deepest = g.map((el) => {
    let d = 0; for (let a = el; a; a = a.parentElement) d++;
    return { el, d };
  }).sort((x, y) => y.d - x.d);
  const desc = (el) => {
    const st = getComputedStyle(el), rc = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 46),
      left: Math.round(rc.left), right: Math.round(rc.right), w: Math.round(rc.width),
      scrollW: el.scrollWidth, display: st.display, cols: st.gridTemplateColumns.slice(0, 50),
      wrap: st.flexWrap, minW: st.minWidth, width: st.width, kids: el.children.length,
      txt: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
    };
  };
  return { doc: de.scrollWidth, W, total: g.length, list: deepest.slice(0, 5).map((x) => desc(x.el)) };
});
console.log(`документ=${r.doc} экран=${r.W} виновных=${r.total}`);
for (const c of r.list) {
  console.log(`  ${c.tag}${c.cls ? "." + c.cls : ""} left=${c.left} right=${c.right} w=${c.w} scrollW=${c.scrollW}`);
  console.log(`     display=${c.display} width=${c.width} min-width=${c.minW} cols=${c.cols} wrap=${c.wrap} детей=${c.kids}`);
  console.log(`     «${c.txt}»`);
}
await b.close();
