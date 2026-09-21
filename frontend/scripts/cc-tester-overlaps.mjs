// ТЕСТЕР CyberChess — глазами игрока, а не сторожа исходника.
// Запуск (из frontend/):  node scripts/cc-tester-overlaps.mjs
//   T_URL=https://aevion.app/cyberchess  T_W=1920,1366,390  T_TABS=play,coach,analysis,puzzles  T_OUT=<папка скринов>
// Что делает: закрывает приветствие как человек, стартует партию, делает 10 настоящих ходов
// кликами/тапами по клеткам (ИИ отвечает), затем на каждой вкладке при scrollTop 0 и внизу ищет
// ПАРЫ видимых текстовых фрагментов, чьи прямоугольники пересекаются (≥25 % меньшего) и
// элементы не вложены; отдельно — текст, обрезанный контейнером, и горизонтальную прокрутку.
// Открытая модалка = «не проверено», не «наложение». Скрины t-<ширина>-<вкладка>-<top|bottom>.png.
// История находок и уроки прибора: Desktop/АЕВИОН/01-CyberChess/2026-09-15-ТОТАЛЬНАЯ-ПРОВЕРКА-перед-запуском.md
// (18–20.09.2026: пилюля на буквах доски, шапка в 4 ряда на телефоне, тосты на наве, карточка
// дебюта на панелях). Контент под непрозрачным BottomNav при scrollTop 0 — штатно, если внизу 0.
// ТЕСТЕР: настоящая партия реальными кликами мыши + геометрический поиск наложений текста.
// Ищет пары ВИДИМЫХ текстовых фрагментов, чьи прямоугольники пересекаются, а элементы не вложены друг в друга.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const OUT = process.env.T_OUT || `${tmpdir()}/cc-tester`; mkdirSync(OUT, { recursive: true });
const URL = process.env.T_URL || "https://aevion.app/cyberchess";
const WIDTHS = (process.env.T_W || "1920,1366,390").split(",").map(Number);
const TABS = (process.env.T_TABS || "play,coach,analysis").split(",");
const MOVES = [["e2","e4"],["g1","f3"],["f1","c4"],["d2","d3"],["b1","c3"],["c1","e3"],["d1","d2"],["h2","h3"],["a2","a3"],["g2","g4"]];

const clickBtn = (page, re) => page.evaluate((src) => { const re = new RegExp(src); const b = [...document.querySelectorAll("button")].find((b) => b.offsetParent && re.test((b.textContent || "").trim())); if (!b) return false; b.click(); return true; }, re.source);
const boardRect = (page) => page.evaluate(() => { const g = [...document.querySelectorAll("div")].filter((d) => /repeat\(8/.test(d.style.gridTemplateColumns || "") && d.getBoundingClientRect().width > 200).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]; if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const sq = (br, s) => { const f = s.charCodeAt(0) - 97, rk = Number(s[1]) - 1; const c = br.w / 8; return { x: br.x + (f + 0.5) * c, y: br.y + (7 - rk + 0.5) * c }; };

const overlaps = (page) => page.evaluate(() => {
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const items = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const t = (n.nodeValue || "").replace(/\s+/g, " ").trim(); if (t.length < 1) continue;
    const el = n.parentElement; if (!el || !vis(el)) continue;
    let hid = false; for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) { hid = true; break; } } if (hid) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) { if (r.width < 2 || r.height < 2) continue; if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      // обрезан ли предком с overflow (тогда текст не виден в этой зоне)
      let cl = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const ar = a.getBoundingClientRect(); cl = { l: Math.max(cl.l, ar.left), t: Math.max(cl.t, ar.top), r: Math.min(cl.r, ar.right), b: Math.min(cl.b, ar.bottom) }; } }
      if (cl.r - cl.l < 2 || cl.b - cl.t < 2) continue;
      items.push({ el, txt: t.slice(0, 40), ...cl }); }
  }
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const iw = Math.min(a.r, b.r) - Math.max(a.l, b.l), ih = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (iw < 3 || ih < 3) continue;
    const ia = iw * ih, sm = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t)); if (ia / sm < 0.25) continue;
    out.push({ a: a.txt, b: b.txt, x: Math.round(Math.max(a.l, b.l)), y: Math.round(Math.max(a.t, b.t)), pct: Math.round(100 * ia / sm) });
  }
  // текст, обрезанный своим контейнером по ширине (многоточие не в счёт): scrollWidth > clientWidth у элементов без ellipsis
  const clipped = [];
  for (const el of document.querySelectorAll("button,span,div,a,td,th,label")) { if (!vis(el) || el.children.length > 0) continue; const cs = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible" && cs.textOverflow !== "ellipsis") { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) clipped.push({ t: (el.textContent || "").trim().slice(0, 40), x: Math.round(r.left), y: Math.round(r.top), need: el.scrollWidth, have: el.clientWidth }); } }
  return { n: items.length, out: out.slice(0, 40), total: out.length, clipped: clipped.slice(0, 15), clippedTotal: clipped.length, hscroll: document.documentElement.scrollWidth - innerWidth };
});

const browser = await chromium.launch();
for (const W of WIDTHS) {
  const H = W < 769 ? 844 : (W === 1366 ? 768 : 1080);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: "ru-RU", hasTouch: W < 769, isMobile: W < 769 });
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(URL, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
  console.log(`\n===== ${W}×${H} =====`);
  // как человек: сперва закрыть приветствие новичка, иначе DOM-клик «ИГРАТЬ» пройдёт СКВОЗЬ модалку
  const ob = await clickBtn(page, /^Просто осмотрюсь$/); if (ob) await page.waitForTimeout(800);
  console.log("приветствие закрыто:", ob, "| старт:", await clickBtn(page, /^ИГРАТЬ$|^▶ Играть$/)); await page.waitForTimeout(2000);
  let made = 0;
  for (const [from, to] of MOVES) {
    const br = await boardRect(page); if (!br) { console.log("доска не найдена"); break; }
    const a = sq(br, from), b = sq(br, to);
    if (W < 769) { await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(250); await page.touchscreen.tap(b.x, b.y); }
    else { await page.mouse.click(a.x, a.y); await page.waitForTimeout(250); await page.mouse.click(b.x, b.y); }
    await page.waitForTimeout(2600); made++;
  }
  const histTxt = await page.evaluate(() => { const all = [...document.querySelectorAll("div,span")].filter((e) => e.children.length === 0 && /^(O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?)$/.test((e.textContent || "").trim())); return all.length; });
  console.log(`кликов-ходов: ${made}, SAN-фрагментов на экране: ${histTxt}, ошибок страницы: ${errs.length}${errs[0] ? " — " + errs[0] : ""}`);
  for (const tab of TABS) {
    if (tab !== "play") { const re = tab === "coach" ? /Коуч$/ : tab === "puzzles" ? /Задачи$/ : /Анализ$/; console.log(`→ вкладка ${tab}:`, await clickBtn(page, re)); await page.waitForTimeout(2200); }
    for (const pos of ["top", "bottom"]) {
      if (pos === "bottom") { await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); for (const d of document.querySelectorAll("div")) { const cs = getComputedStyle(d); if (/(auto|scroll)/.test(cs.overflowY) && d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 300) d.scrollTop = d.scrollHeight; } }); await page.waitForTimeout(700); }
      const modal = await page.evaluate(() => !![...document.querySelectorAll("[role=dialog],[aria-modal=true]")].find((e) => e.getBoundingClientRect().width > 100));
      if (modal) { console.log(`[${W} ${tab} ${pos}] МОДАЛКА ОТКРЫТА — наложения не проверены (что за модалка — см. скрин)`); await page.screenshot({ path: `${OUT}/t-${W}-${tab}-${pos}.png` }); continue; }
      const r = await overlaps(page);
      console.log(`[${W} ${tab} ${pos}] текстов ${r.n}, НАЛОЖЕНИЙ ${r.total}, обрезанных ${r.clippedTotal}, гориз.прокрутка ${r.hscroll}px`);
      for (const o of r.out.slice(0, 14)) console.log(`   ⛔ «${o.a}» × «${o.b}» @${o.x},${o.y} ${o.pct}%`);
      for (const c of r.clipped.slice(0, 6)) console.log(`   ✂ «${c.t}» @${c.x},${c.y} нужно ${c.need}px, есть ${c.have}px`);
      await page.screenshot({ path: `${OUT}/t-${W}-${tab}-${pos}.png` });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await ctx.close();
}
await browser.close();
