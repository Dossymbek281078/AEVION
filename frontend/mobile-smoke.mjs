/**
 * Мобильная проверка посадочных страниц на ЖИВОМ проде.
 *
 * Зачем отдельным скриптом: расширение Chrome рапортует смену размера окна, но
 * область просмотра остаётся десктопной (`window.innerWidth` = 1920), а
 * Playwright-MCP занят другой сессией. Здесь viewport задаётся явно, поэтому
 * результат означает то, что написано.
 *
 * Ничего не отправляет и не меняет — только открывает страницы и измеряет.
 */
// Playwright берём из frontend: там он уже установлен вместе с браузерами.
// Обёртка кладёт этот файл рядом с его node_modules и убирает после прогона —
// иначе `@playwright/test` из ops-репозитория не разрешится, а ставить второй
// экземпляр браузеров ради смоука нерационально.
import { chromium, devices } from "@playwright/test";

// Денежные страницы + те, что откроет инвестор или рецензент YC — возможно,
// с телефона: заявка ведёт на /acquire и /investor.
const PAGES = ["/go?c=ig", "/shop?c=ig", "/longevity", "/", "/acquire", "/investor", "/pricing"];
const BASE = process.env.BASE || "https://aevion.app";

const browser = await chromium.launch();
const DEVICE_WIDTH = devices["iPhone 13"].viewport.width; // 390
const context = await browser.newContext(devices["iPhone 13"]);
const page = await context.newPage();

let fails = 0;

for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45_000 });
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    // Самая частая беда мобильной вёрстки — элемент, вылезающий за экран:
    // он даёт горизонтальную прокрутку и «уезжающий» текст.
    const wide = [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > (window.visualViewport?.width ?? window.innerWidth) + 2)
      .slice(0, 3)
      .map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).slice(0, 30) : ""));
    const firstBtn = document.querySelector("a,button");
    return {
      // visualViewport, а НЕ innerWidth. Замер 27.07: на /acquire innerWidth=450,
      // на /pricing 433 — но visualViewport.width там 390, масштаб 1, computed width
      // у html и body ровно 390px, ни zoom, ни transform. То есть вёрстка правильная,
      // а расширенным остаётся только innerWidth — свойство эмуляции. Проверка на нём
      // давала ложную тревогу на двух инвесторских страницах.
      viewport: window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth,
      docWidth: de.scrollWidth,
      overflow: de.scrollWidth > window.innerWidth + 1,
      wide,
      title: (document.querySelector("h1")?.innerText || "").slice(0, 50),
      // Кегль основного текста: меньше 14px на телефоне читается плохо.
      bodyFont: getComputedStyle(document.body).fontSize,
      firstAction: (firstBtn?.innerText || "").trim().slice(0, 40),
    };
  });
  // Слепое пятно, найденное 27.07 на самом себе: страница может НЕ иметь
  // горизонтальной прокрутки просто потому, что заставила браузер расширить
  // область просмотра под своё содержимое (/acquire дал 450 вместо 390,
  // /pricing — 433). Прокрутки нет, а текст мельче задуманного. Поэтому
  // сверяем ещё и ширину экрана с заявленной моделью устройства.
  const drift = m.viewport > DEVICE_WIDTH + 1;
  const bad = m.overflow || drift;
  if (bad) fails++;
  console.log(`${bad ? "FAIL" : "OK  "}  ${path}`);
  console.log(`      viewport=${m.viewport} документ=${m.docWidth} прокрутка=${m.overflow ? "ЕСТЬ" : "нет"}${drift ? ` РАСШИРЕН (ожидалось ${DEVICE_WIDTH})` : ""} кегль=${m.bodyFont}`);
  console.log(`      заголовок: «${m.title}»  первое действие: «${m.firstAction}»`);
  if (m.wide.length) console.log(`      вылезают за экран: ${m.wide.join(", ")}`);
}

await browser.close();
console.log(fails ? `\nстраниц с проблемой (прокрутка или расширенный экран): ${fails}` : "\nвсе страницы укладываются в экран телефона");
process.exitCode = fails ? 1 : 0;
