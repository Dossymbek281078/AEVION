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
 * ⚠️ Насколько какой критерий работает — замерено 21.08.2026, а не оценено.
 * Мутация (в список подставлен несуществующий адрес) даёт:
 *     FAIL /privacy-zzz — status=404 size=16212 brand=true
 * То есть на ПРОПАЖЕ страницы держит только код ответа: страница 404 у Next
 * весит 15-16 КБ и слово «aevion» в ней есть, оба остальных критерия её
 * пропускают. Они не лишние — ловят 500 и пустую оболочку, — но считать их
 * второй линией защиты от исчезновения страницы нельзя. Проверять сторожа
 * этой же мутацией всякий раз, когда его правят: зелёный прогон не
 * доказывает, что он умеет краснеть.
 *
 * Env:
 *   PAGES_BASE  default https://aevion.vercel.app
 */

const BASE = (process.env.PAGES_BASE || "https://aevion.vercel.app").replace(/\/+$/, "");

const PAGES = [
  "/",
  "/explore",
  "/devhub",
  // The comparison page states what the product does against named rivals — a
  // page that quietly 404s or empties out is worse than one that never
  // existed, because it is the page an investor is sent to.
  "/compare",
  "/studio",
  "/pricing",
  "/apps",
  "/qright",
  "/qsign",
  "/bureau",
  "/planet",
  "/awards",
  "/bank",
  // Шахматы выходят публично 30.08.2026, и трафик на них будет платным. До
  // 19.08 под наблюдением была только главная: страницы задачи дня, турниров и
  // рейтинга могли отдавать пустой экран сколько угодно, и узнали бы мы об этом
  // от посетителя. Это ровно тот урок, ради которого сторож и написан.
  "/cyberchess",
  "/cyberchess/daily",
  "/cyberchess/tournaments",
  "/cyberchess/leaderboard",
  "/qventure",
  "/qskyway",
  "/build",
  "/qtrade",
  "/smeta-trainer",
  "/revenue",
  "/pitch",
  "/acquire",
  "/startup-exchange",
  // Страницы, на которых лежат деньги. Их тихая поломка дороже любой другой:
  // сайт продолжает отвечать, а приём платежей молча прекращается. Все четыре
  // проверены живыми (200) 2026-07-26.
  "/go",
  // Короткие ссылки каналов и их английские двойники: перенаправляют на /go
  // с меткой источника. Сторож следует перенаправлениям, поэтому 307 здесь
  // зачтётся, а вот исчезновение адреса — нет. Ровно этот класс 14.08 увёл
  // с прода саму /go на несколько часов, и заметили не сразу.
  "/ig",
  "/tt",
  "/yt",
  "/en/ig",
  "/en/tt",
  // Страница модуля, приехавшая со сведением 28.08 и не попавшая в список.
  "/mapreality",        // ссылка из шапки профиля соцсетей — входная точка ВСЕГО трафика
  "/shop",      // единая витрина — 15 покупаемых позиций
  "/qmelanin",  // кнопки покупки гайдов $9 / $19
  "/qrenew",    // линия здоровья, ведёт в те же товары
  "/longevity", // 12-недельный протокол, продукт oijxmq

  // Английский вход, добавлен 28.08.2026 вместе с самими страницами. Причина
  // та же, что у /go: это единственная точка входа для англоязычного трафика,
  // и её тихая поломка не видна ниоткуда — русские страницы продолжают
  // отвечать, а половина воронки просто исчезает. До 28.08 оба адреса
  // отдавали 404, а готовый пакет из шести английских роликов лежал без места
  // назначения.
  "/en/go",        // посадочная под ссылку в профиле, англоязычная
  "/en/longevity", // бесплатный разбор протокола — то, что обещают ролики

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
  // Добавлено 19.08.2026. Замер покрытия: сторож смотрел 39 публичных
  // страниц верхнего уровня из 92 — то есть был зелёным, наблюдая меньше
  // половины сайта. Среди невидимых оказались условия и приватность (их
  // чинили в тот же день), поддержка, магазин, страница состояния и почти
  // все страницы модулей: сломайся любая, узнали бы от посетителя.
  //
  // Все 53 проверены ПЕРЕД добавлением: 200, больше 5000 байт, бренд на
  // месте. Сторож, который краснеет с первого дня, отключают в тот же день,
  // поэтому список не «на будущее», а по факту.
  "/account",
  "/aev",
  "/agent",
  "/api-explorer",
  "/auth",
  "/changelog",
  "/coach",
  "/data-deletion",
  "/deepsan",
  "/demo",
  "/developers",
  "/ecosystem",
  "/fintech",
  "/healthai",
  "/help",
  "/keys",
  "/kids-ai-content",
  "/launch-status",
  "/lifebox",
  "/modules",
  "/payments",
  "/pilot",
  "/press",
  "/privacy",
  "/psyapp-deps",
  "/qai",
  "/qfusionai",
  "/qgood",
  "/qjobs",
  "/qlearn",
  "/qlife",
  "/qmedia",
  "/qnews",
  "/qpersona",
  "/qreal",
  "/qstore",
  "/qtradeoffline",
  "/quantum-shield",
  "/reconstruct-demo",
  "/sdk",
  "/sdks",
  "/security",
  "/shadownet",
  "/startup-exchange",
  "/status",
  "/support",
  "/terms",
  "/tiktok-publisher",
  "/ventures",
  // Страница проверки сертификата. Идентификатор здесь ЗАВЕДОМО несуществующий,
  // и это осознанно: адрес настоящего сертификата привязал бы сторожа к данным
  // (записи из реестра могут удалить), а вопрос у нас другой — доехал ли САМ
  // МАРШРУТ до площадки. Отсутствующая страница даёт 404, живая отвечает 200 и
  // рисует своё «сертификат не найден». Замер 27.08.2026: 200.
  //
  // Проверено, что проба различает случаи: /verify без сегмента даёт 404,
  // /verify/<настоящий id> — 200. Это тот самый адрес, на который ведёт
  // QR-код КАЖДОГО выданного сертификата, и до сегодня он не проверялся.
  "/verify/cert-smoke-no-such-id",
  "/verify-offline",
  "/voice-of-earth",
  "/z-tide",
  // Из ветки шахмат (сведено 21.08.2026): подстраницы модуля, которых
  // не было в общем списке. Списки собирали два окна независимо,
  // поэтому здесь ОБЪЕДИНЕНИЕ, а не выбор одной стороны.
  "/multichat-engine/verify",
  "/cyberchess/cpi",
  "/cyberchess/cpi/dashboard",
  "/cyberchess/cpi/leaderboard",
  "/cyberchess/economy",
  "/cyberchess/history",
  "/cyberchess/matchmaking",
  "/cyberchess/offline",
  "/cyberchess/repertoire",
  "/cyberchess/replays",
  "/cyberchess/spectator",
  "/cyberchess/studio",
  "/cyberchess/tournament",
  "/cyberchess/training",
  // Дописано при сведении 21.08: этих адресов не было в их списке.
  "/build/verify-email",
  "/pricing/cases",
  // 28.08.2026 — страница по ссылке совместного просмотра QCoreAI. Токен здесь
  // намеренно выдуманный: он и должен показать экран "ссылка не действует", а
  // проверяем мы существование САМОГО адреса. Именно его и не было: кнопка
  // "поделиться" отдавала ссылку сюда, а прод отвечал 404, и обнаружил бы это
  // получатель, а не автор. Выкачено 28.08 в 12:4x — перенесено сюда из
  // PENDING_DEPLOY по просьбе самого сторожа.
  "/qcoreai/collab/probe-token-not-real",
];

/**
 * Адреса, которые ЕСТЬ в ветке, но ещё не выкачены.
 *
 * Красить свип красным из-за них нельзя: мержа не было, и виноват не прод.
 * Считать зелёными — тоже нельзя: проверка не состоялась. Поэтому отдельный
 * счётчик — видно в выводе, но код выхода не ломается. Договорённость взята
 * из qreal-prod-smoke.js (там это функция pend), чтобы способ был один.
 *
 * ⚠️ Выкатили — переносите строку в PAGES. Иначе проверка останется вечно
 * «ожидаемой» и однажды прикроет настоящую пропажу страницы.
 */
const PENDING_DEPLOY = {
  // Пусто: всё, что здесь стояло, выкачено. Сторож сам просит вычеркнуть строку,
  // когда адрес начинает отвечать, — так список не превращается в постоянное
  // исключение, которое однажды прикроет настоящую пропажу страницы.
};

let pass = 0;
let fail = 0;
const failures = [];
let pending = 0;
const deployedNowPending = [];

async function checkPage(p) {
  const url = BASE + p;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { Accept: "text/html" } });
    const body = await r.text();
    const okStatus = r.ok;
    const okSize = body.length > 5000;
    const okBrand = /aevion/i.test(body);
    if (okStatus && okSize && okBrand) {
      if (PENDING_DEPLOY[p]) deployedNowPending.push(p);
      pass++;
      console.log(`  PASS ${p} (${r.status}, ${(body.length / 1024).toFixed(0)}KB)`);
    } else if (PENDING_DEPLOY[p]) {
      // Не PASS и не FAIL: проверка не состоялась, потому что мержа ещё не было.
      pending++;
      console.log(`  ~ ${p} — ждёт выкатки (${PENDING_DEPLOY[p]}); status=${r.status}`);
    } else {
      fail++;
      failures.push(p);
      console.log(`  FAIL ${p} — status=${r.status} size=${body.length} brand=${okBrand}`);
    }
  } catch (e) {
    if (PENDING_DEPLOY[p]) {
      pending++;
      console.log(`  ~ ${p} — ждёт выкатки (${PENDING_DEPLOY[p]}); ${e.message}`);
    } else {
      fail++;
      failures.push(p);
      console.log(`  FAIL ${p} — ${e.message}`);
    }
  }
}


// ── Обещания модуля, а не только доступность страниц ─────────────────────────
//
// Этот файл — единственная проверка прода, которую что-то ЗАПУСКАЕТ: задача
// AEVION-PagesGuard берёт его из зеркала каждые 30 минут. Шахматный смоук
// подробнее, но его не зовёт никто, поэтому два обещания, молча пропадавшие
// при чужих выкатках, живут здесь.
//
// 19.08.2026 чужая выкатка в 10:34 вернула прод к состоянию, где задача дня НЕ
// РЕШАЕТСЯ (решение приходило обрывками JSON), а серию можно было объявить
// числом без единого хода. Прод один на все окна, побеждает последняя выкатка —
// откат повторится, и заметить его должен сторож, а не случайность.
//
// Проверяется ПРИГОДНОСТЬ, а не ответ 200: сервер может отвечать бодро и при
// этом обещать то, чего не делает.
const API = (process.env.API_BASE || "https://api.aevion.app").replace(/[/]+$/, "");
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

async function checkChessPromises() {
  try {
    const r = await fetch(`${API}/api/cyberchess-daily/puzzle`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    const sol = Array.isArray(j?.puzzle?.sol) ? j.puzzle.sol : [];
    if (sol.length > 0 && sol.every((m) => UCI.test(String(m)))) {
      pass++; console.log(`  PASS задача дня решаема (${sol.length} ходов)`);
    } else {
      fail++; failures.push("задача дня нерешаема");
      console.log(`  FAIL задача дня нерешаема — ${JSON.stringify(sol).slice(0, 60)}`);
    }
  } catch (e) {
    fail++; failures.push("задача дня недоступна");
    console.log(`  FAIL задача дня — ${e.message}`);
  }

  // Серию нельзя объявить: без сыгранных ходов запрос обязан быть отвергнут.
  // Проба ничего не записывает именно потому, что её отвергают.
  try {
    const r = await fetch(`${API}/api/cyberchess-daily/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Дату НЕ шлём: её называет сервер, а расхождение даёт отдельный отказ
      // wrong_day. На стыке суток UTC проба и сервер посчитали бы разные дни, и
      // сторож раз в сутки кричал бы «подделка проходит» на исправной защите.
      body: JSON.stringify({ streak: 999, userId: "pages-guard-probe", name: "guard" }),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    // Проверяется СВОЙСТВО «заявление без сыгранных ходов не засчитывается», а
    // не конкретный текст отказа: сервер вправе отказать по любой причине, и
    // придирка к формулировке делала бы сторожа красным при живой защите —
    // например, пока новая версия ещё не выкачена. Красным он должен становиться
    // тогда, когда заявление ПРОХОДИТ.
    // Отказ должен быть НАШИМ: 4xx плюс JSON с признаком отказа. Иначе
    // сторож зеленел на чужом 404 — проверено контролем, направив его на
    // несуществующий адрес: «защита работает» при полном её отсутствии.
    const нашОтказ = r.status >= 400 && r.status < 500 && j && j.ok === false && typeof j.error === "string";
    if (нашОтказ) {
      pass++; console.log(`  PASS серию нельзя объявить без ходов (${r.status} ${j.error})`);
    } else {
      fail++; failures.push("серию можно подделать");
      console.log(`  FAIL серию можно подделать — ${r.status} ${JSON.stringify(j).slice(0, 60)}`);
    }
  } catch (e) {
    fail++; failures.push("проверка подделки не выполнена");
    console.log(`  FAIL проверка подделки — ${e.message}`);
  }
}

(async () => {
  // Ожидающие выкатки адреса ПРОВЕРЯЕМ тоже: иначе список станет просто
  // исключением, и мы не узнаем, когда страница появится на проде.
  const ALL = [...PAGES, ...Object.keys(PENDING_DEPLOY)];
  console.log(`pages-live-smoke against ${BASE} (${ALL.length} pages)`);
  // Small batches: fast enough, and no thundering herd against prod.
  for (let i = 0; i < ALL.length; i += 5) {
    await Promise.all(ALL.slice(i, i + 5).map(checkPage));
  }
  await checkChessPromises();
  // Знаменатель — страницы плюс две проверки обещаний: иначе «46/46» при
  // сломанном обещании читалось бы как полный порядок.
  const total = PAGES.length + Object.keys(PENDING_DEPLOY).length + 2;
  const pendNote = pending ? ` — ЖДУТ ВЫКАТКИ: ${pending}` : "";
  console.log(`\npages-live-smoke: ${pass}/${total} PASS${pendNote}${fail ? ` — FAILING: ${failures.join(", ")}` : ""}`);
  // Адрес из списка ожидания ПРОШЁЛ — значит выкатка была, и строку надо
  // убрать. Иначе список тихо станет постоянным исключением и однажды
  // прикроет настоящую пропажу страницы. Не падение, но сказать надо громко.
  if (deployedNowPending.length > 0) {
    console.log(
      `  ! УБЕРИТЕ ИЗ PENDING_DEPLOY (уже на проде): ${deployedNowPending.join(", ")}`,
    );
  }
  process.exit(fail ? 1 : 0);
})();
