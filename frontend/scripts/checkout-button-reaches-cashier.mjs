/**
 * Ворота запуска, пункт 2: КНОПКА ОПЛАТЫ ДОХОДИТ ДО КАССЫ.
 *
 * Зачем отдельно от всего остального. Мы уже знаем, что цены в кассе совпадают
 * с витриной (ls-variant-prices-check.js, 30 из 30) и что варианты заведены.
 * Но это ответ на вопрос «правильная ли цена у товара», а не «может ли человек
 * до этого товара дойти». Страница цен рисуется в браузере: обход сырым HTTP
 * её кнопок не видит вовсе — контрольный запрос /pricing отдаёт 649 знаков
 * текста. Поэтому только браузером.
 *
 * Что считается успехом: после нажатия адрес уходит на домен кассы
 * (*.lemonsqueezy.com). Остальное — отказ, и отказы разные:
 *   нет кнопки        — покупателю нечего нажать;
 *   нажалась, но адрес остался нашим — кнопка есть, кассы за ней нет.
 *
 * Оплату НЕ проводит: открывает страницу кассы и уходит. Карты не вводятся.
 *
 * Запуск: node frontend/scripts/checkout-button-reaches-cashier.mjs
 * Коды: 0 — все дошли; 1 — кто-то не дошёл; 2 — прогон не состоялся.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://aevion.app";
const CASHIER = /lemonsqueezy\.com/i;

/** Пять приложений со своей ценой — ровно те, у кого касса настроена. */
const APPS = ["devhub", "cyberchess", "multichat", "qventure", "ip_bureau"];

/** Подписи, по которым человек узнаёт кнопку покупки. */
const BUY_TEXT = /купить|оформить|подписаться|buy|subscribe|checkout|выбрать/i;

async function probe(page, url, label) {
  const out = { label, url, verdict: "", landed: "" };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500); // витрина дорисовывается на клиенте
  } catch (e) {
    out.verdict = `страница не открылась: ${String(e.message).slice(0, 60)}`;
    return out;
  }

  /*
   * Ищем ФИЛЬТРОМ, а не перебором всех элементов по одному.
   * Первая редакция брала page.locator("a,button").all() и спрашивала innerText
   * у каждого из 111 узлов: на перерисовке они устаревали, и проба сообщала
   * «кнопки покупки НЕ НАЙДЕНО» там, где кнопок десять. Два прогона подряд дали
   * разный ответ на одной и той же странице — признак шаткого прибора, а не
   * дефекта витрины.
   */
  const buy = page.locator("a, button").filter({ hasText: BUY_TEXT });
  let clicked = null;
  try {
    const n = await buy.count();
    if (n > 0) {
      const first = buy.first();
      await first.waitFor({ state: "visible", timeout: 8000 });
      clicked = { el: first, text: ((await first.innerText()) || "").trim() };
    }
  } catch (e) {
    out.verdict = `кнопку не удалось взять: ${String(e.message).slice(0, 50)}`;
    return out;
  }

  if (!clicked) {
    out.verdict = "кнопки покупки НЕ НАЙДЕНО";
    return out;
  }

  const before = page.url();
  try {
    await Promise.race([
      clicked.el.click({ timeout: 8000 }),
      page.waitForTimeout(8000),
    ]);
    await page.waitForTimeout(4000);
  } catch (e) {
    out.verdict = `нажатие не прошло: ${String(e.message).slice(0, 50)}`;
    return out;
  }

  // Касса может открыться в новой вкладке или наложением поверх страницы.
  const pages = page.context().pages();
  const urls = pages.map((p) => p.url());
  const frames = page.frames().map((f) => f.url());
  const all = [...urls, ...frames, page.url()];
  const cashier = all.find((u) => CASHIER.test(u));

  out.landed = cashier || page.url();
  if (cashier) out.verdict = "ДОШЛА ДО КАССЫ";
  else if (page.url() !== before) out.verdict = "ушла НЕ в кассу";
  else out.verdict = "нажалась, адрес не изменился";
  out.button = clicked.text.slice(0, 40);
  return out;
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.error("ПРОГОН НЕ СОСТОЯЛСЯ: браузер не запустился —", String(e.message).slice(0, 80));
    process.exitCode = 2;
    return;
  }

  const results = [];
  try {
    for (const app of APPS) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      results.push(await probe(page, `${BASE}/pricing?app=${app}#apps`, `приложение ${app}`));
      await ctx.close();
    }
    // Контроль: подписка планеты — путь, который заведомо продаётся.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    results.push(await probe(page, `${BASE}/pricing#tiers`, "КОНТРОЛЬ подписка планеты"));
    await ctx.close();
  } finally {
    await browser.close();
  }

  for (const r of results) {
    const mark = r.verdict === "ДОШЛА ДО КАССЫ" ? "  ok " : "  !! ";
    console.log(`${mark}${r.label.padEnd(30)} ${r.verdict}${r.button ? `  [${r.button}]` : ""}`);
    console.log(`      адрес кассы: ${r.landed}`);
  }

  const bad = results.filter((r) => r.verdict !== "ДОШЛА ДО КАССЫ");
  console.log(`\nдошли до кассы ${results.length - bad.length} из ${results.length}`);

  /*
   * КОНТРОЛЬ ПРИБОРА, без которого зелёный ничего не значит.
   * Проба нажимает ПЕРВУЮ подходящую кнопку, а на странице цен кнопки
   * приложения и кнопки подписки планеты подписаны одинаково («Выбрать Lite»).
   * Значит «дошла до кассы» могло означать «каждый раз нажималась одна и та же
   * кнопка планеты». Отличить можно только по адресу: у разных товаров он
   * разный. Совпали все — проба мерила не то, что обещает её имя.
   */
  const reached = results.filter((r) => r.verdict === "ДОШЛА ДО КАССЫ");
  const distinct = new Set(reached.map((r) => r.landed));
  console.log(`разных адресов кассы: ${distinct.size} при ${reached.length} дошедших`);
  if (reached.length > 1 && distinct.size === 1) {
    console.error(
      "КОНТРОЛЬ НЕ ПРОЙДЕН: все нажатия ведут в ОДНУ кассу — проба нажимает одну и ту же кнопку.",
    );
    console.error("Зелёный выше ничего не доказывает; чинить пробу, а не радоваться.");
    process.exitCode = 2;
    return;
  }

  if (bad.length) {
    console.error("НЕ ВСЕ КНОПКИ ДОХОДЯТ ДО КАССЫ — покупатель не сможет заплатить.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("ПРОГОН НЕ СОСТОЯЛСЯ:", String(e && e.message ? e.message : e).slice(0, 150));
  process.exitCode = 2;
});
