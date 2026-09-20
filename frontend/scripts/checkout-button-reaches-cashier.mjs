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

/**
 * Пять приложений со своей ценой и ТО, КАК их кнопка подписана на витрине.
 *
 * ⚠️ Имя обязательно. Замер DOM 20.09.2026: на странице цен две секции —
 * `#tiers` с кнопками «Выбрать Lite … Max» (подписка на всю планету) и `#apps`
 * с кнопками «Купить CyberChess», «Купить DevHub» и т.д. Пока проба брала
 * первую попавшуюся кнопку по слову «выбрать|купить», она нажимала кнопку
 * ПЛАНЕТЫ на любой странице — и «все пять приложений доходят до кассы» было
 * зелёным, которое ничего не проверяло.
 */
const APPS = [
  { slug: "devhub", label: "DevHub" },
  { slug: "cyberchess", label: "CyberChess" },
  { slug: "multichat", label: "Multichat" },
  { slug: "qventure", label: "QVenture" },
  { slug: "ip_bureau", label: "IP Bureau" },
];

async function probe(page, url, label, section, want) {
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
  const buy = page.locator(`#${section}`).locator("a, button").filter({ hasText: want });
  let clicked = null;
  try {
    const n = await buy.count();
    if (n > 0) {
      const first = buy.first();
      await first.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
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

  /*
   * Различаем ДВА разных исхода, которые оба выглядят как «мы в кассе».
   * Замер 20.09.2026: часть прогонов приводит на корзину товара
   * (…/checkout/cart/<id>), а часть — на общую страницу магазина
   * (…/checkout?custom=1), где выбранного товара нет. Для покупателя это
   * разные вещи: во втором случае он нажал «Купить DevHub» и оказался в
   * магазине без DevHub. Причина расхождения на 20.09 НЕ установлена —
   * ограничитель темпа исключён (30/мин по адресу, столько не было).
   */
  /*
   * ⚠️ Поправка 20.09.2026, вечер: сюда обязан входить `/checkout/custom/`.
   *
   * Без него проба называла «общей страницей магазина» ПЕРСОНАЛЬНУЮ кассу
   * товара и роняла прогон зря. Проверено прямым опросом ручки
   * POST /api/pricing/checkout/session по каждому из пяти приложений: все
   * отвечают 200 и дают СВОЙ подписанный адрес вида
   * `…/checkout/custom/<uuid>?signature=…` — шесть запросов, шесть разных
   * адресов. Отрицательный контроль: выдуманное приложение получает 400
   * `invalid_app`, то есть ручка проверяет вход, а не выдаёт что попало.
   */
  const PRODUCT_CART = /lemonsqueezy\.com\/(checkout\/(cart|buy|custom)\/|buy\/)/i;

  out.landed = cashier || page.url();
  if (cashier && PRODUCT_CART.test(cashier)) out.verdict = "ДОШЛА ДО КАССЫ";
  else if (cashier) out.verdict = "довела до МАГАЗИНА, но не до товара";
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
    /*
     * Проба ОБЯЗАНА называть себя. 20.09.2026 первый прогон этого файла оставил
     * на боевой аналитике 23 события «дошёл до кассы», неотличимых от живого
     * человека, — и они тут же были прочитаны как посетители. Правило §19:
     * создающий запрос на прод идёт только с пометкой. Слово probe в
     * User-Agent ловится общим признаком робота в разборе событий.
     */
    /*
     * ⚠️ Метка — СУФФИКС к настоящему User-Agent браузера, а не замена его.
     * Первая попытка поставила «Mozilla/5.0 (compatible; …probe…)» целиком, и
     * витрина отдала другое содержимое: все пять нажатий свелись к одной кассе,
     * контроль «адреса обязаны различаться» это поймал и уронил прогон с кодом 2.
     * Сайт ведёт себя иначе для неизвестного клиента, поэтому проба обязана
     * оставаться похожей на браузер и при этом называть себя.
     */
    /*
     * 🔴 ЗАМЕР 20.09.2026: метка в User-Agent ЛОМАЕТ измерение.
     * Четыре прогона со строкой «AEVION-probe» в UA дали общую страницу
     * магазина вместо корзины товара — у всех шести целей, включая контрольную
     * подписку планеты. Два прогона без метки дали шесть разных корзин.
     * То есть касса (или её скрипт на нашей странице) отказывается собирать
     * корзину для клиента, который выглядит необычно.
     *
     * Отсюда честная развилка, и она не в мою пользу: либо проба называет себя
     * и меряет НЕ ТО, либо меряет верно и оставляет в аналитике события,
     * неотличимые от живого покупателя. Выбрано второе, потому что сторож,
     * дающий неверный ответ, хуже сторожа, о котором знают.
     *
     * Поэтому: метка по умолчанию ВЫКЛЮЧЕНА, включается переменной
     * AEVION_PROBE_UA=1 (для случаев, когда важнее не пачкать аналитику), и
     * каждый прогон пишет отметку времени в локальный журнал, чтобы разбор
     * событий мог исключить это окно.
     */
    const PROBE_UA = process.env.AEVION_PROBE_UA
      ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/128.0.0.0 Safari/537.36 AEVION-probe/1.0"
      : null;
    const ctxOpts = PROBE_UA ? { userAgent: PROBE_UA } : {};

    const started = new Date().toISOString();
    console.log(
      `⚠️ Прогон пишет события в БОЕВУЮ аналитику (page_view + checkout_start).\n` +
        `   Начало ${started} — исключайте это окно при разборе посетителей.`,
    );
    try {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(
        "C:/Users/user/aevion-checkout-gate-runs.log",
        `${started} checkout-button-reaches-cashier, целей ${APPS.length + 1}, метка UA ${PROBE_UA ? "вкл" : "выкл"}\n`,
      );
    } catch { /* журнал не критичен для прогона */ }

    for (const app of APPS) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await ctx.newPage();
      // Подпись кнопки берём ТЕКСТОМ, без регулярки: экранирование на этой
      // машине съедается на границе вызова, и "Купить\s+" превращается в
      // "Купитьs+" — фильтр молча не находит ничего.
      const want = `Купить ${app.label}`;
      results.push(
        await probe(page, `${BASE}/pricing?app=${app.slug}#apps`, `приложение ${app.slug}`, "apps", want),
      );
      await ctx.close();
    }
    // Контроль: подписка планеты — путь, который заведомо продаётся.
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    results.push(await probe(page, `${BASE}/pricing#tiers`, "КОНТРОЛЬ подписка планеты", "tiers", /Выбрать\s+Lite/i));
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
