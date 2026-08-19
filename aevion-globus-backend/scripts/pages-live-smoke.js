#!/usr/bin/env node
/**
 * Live-page smoke — actually OPENS the public page of each live module.
 *
 * Why: 2026-07-21 lesson. Every CF Pages deploy DevHub ever made reported
 * success while the page served an empty 500 — because nothing anywhere
 * fetched the page itself. API smokes prove endpoints; this proves the
 * thing a human actually loads.
 *
 * Pass criteria per page: HTTP 2xx, body over 5KB, body mentions "aevion"
 * (case-insensitive) — enough to catch full-page 500s, empty shells, and
 * hosting-level breakage without being brittle about copy or i18n.
 *
 * Env:
 *   PAGES_BASE  default https://aevion.vercel.app
 */

const BASE = (process.env.PAGES_BASE || "https://aevion.vercel.app").replace(/\/+$/, "");

const PAGES = [
  "/",
  "/explore",
  "/devhub",
  "/studio",
  "/pricing",
  "/apps",
  "/qright",
  "/qsign",
  "/bureau",
  "/planet",
  "/awards",
  "/bank",
  "/cyberchess",
  "/qventure",
  "/qskyway",
  "/build",
  "/qtrade",
  "/smeta-trainer",
  "/revenue",
  "/pitch",
  "/acquire",
  // Страницы, на которых лежат деньги. Их тихая поломка дороже любой другой:
  // сайт продолжает отвечать, а приём платежей молча прекращается. Все четыре
  // проверены живыми (200) 2026-07-26.
  "/go",        // ссылка из шапки профиля соцсетей — входная точка ВСЕГО трафика
  "/shop",      // единая витрина — 15 покупаемых позиций
  "/qmelanin",  // кнопки покупки гайдов $9 / $19
  "/qrenew",    // линия здоровья, ведёт в те же товары
  "/longevity", // 12-недельный протокол, продукт oijxmq

  // Добавлены 10.08.2026. Причина конкретная: за день в этих модулях нашлись
  // дефекты (мёртвый ключ входа, вызовы мимо прокси), а смоук их даже не
  // открывал — то есть отчёт «26/26 PASS» не покрывал ни одну сломанную
  // страницу. Все семь проверены вручную, отдают 200.
  //
  // ⚠️ Помнить, чего этот смоук НЕ доказывает: критерий у него — 2xx, тело
  // больше 5 КБ и слово «aevion». Всё это верно и у страницы, которая
  // открылась, но внутри не работает: библиотека мультичата отдаёт 200 и
  // «войдите» вошедшему человеку, админка QPayNet — 200 и пустые списки.
  // Он доказывает, что страница ОТКРЫВАЕТСЯ, а не что она РАБОТАЕТ.
  "/qpaynet",         // платежи: кошелёк, переводы, платёжные ссылки
  "/multichat-engine",// консилиум агентов
  "/qcontract",       // документы и подписание
  "/qmaskcard",       // виртуальные карты
  "/qchaingov",       // голосования
  "/qevents",         // события
  "/qsocial",         // лента

  // Добавлены 14.08.2026, каждая по своему поводу — в этот день они либо
  // оказались сломаны, либо чуть не пропали с прода вместе с /go.
  "/partner",      // страница для инвесторов; звала мёртвый /api/aevion/registry → 404
  "/investor",     // вторая инвесторская, тот же класс обещаний
  "/compare",      // сравнение с аналогами; существует в одной ветке из трёх, легко теряется
  "/constitution", // отдельный продукт со своей оплатой и листом ожидания
  "/qcoreai",      // платный модуль, на его странице кнопка оплаты
  "/veilnetx",     // обещал Tor, которого нет; формулировку правили дважды
  "/cyberchess/launch",  // посадочная под ролики; её пропажа = потерянный трафик запуска
  "/bureau/launch",      // то же для патентного бюро, запуск 06.09
  // Добавлены 19.08.2026: обе посадочные уже отвечают 200 и уже собирают
  // адреса, но сторож их не знал — то есть их падение прошло бы незамеченным
  // ровно так же, как пропажа /go в июле.
  "/devhub/launch",           // запуск 13.09, самый дорогой чек платформы
  "/multichat-engine/launch", // запуск 20.09
];

let pass = 0;
let fail = 0;
const failures = [];

async function checkPage(p) {
  const url = BASE + p;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { Accept: "text/html" } });
    const body = await r.text();
    const okStatus = r.ok;
    const okSize = body.length > 5000;
    const okBrand = /aevion/i.test(body);
    if (okStatus && okSize && okBrand) {
      pass++;
      console.log(`  PASS ${p} (${r.status}, ${(body.length / 1024).toFixed(0)}KB)`);
    } else {
      fail++;
      failures.push(p);
      console.log(`  FAIL ${p} — status=${r.status} size=${body.length} brand=${okBrand}`);
    }
  } catch (e) {
    fail++;
    failures.push(p);
    console.log(`  FAIL ${p} — ${e.message}`);
  }
}

(async () => {
  console.log(`pages-live-smoke against ${BASE} (${PAGES.length} pages)`);
  // Small batches: fast enough, and no thundering herd against prod.
  for (let i = 0; i < PAGES.length; i += 5) {
    await Promise.all(PAGES.slice(i, i + 5).map(checkPage));
  }
  console.log(`\npages-live-smoke: ${pass}/${PAGES.length} PASS${fail ? ` — FAILING: ${failures.join(", ")}` : ""}`);
  process.exit(fail ? 1 : 0);
})();
