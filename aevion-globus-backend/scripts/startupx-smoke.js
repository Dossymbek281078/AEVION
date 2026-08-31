#!/usr/bin/env node
/**
 * Startup Exchange smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/startupx-smoke.js
 *        BASE=https://aevion-production-a70c.up.railway.app node scripts/startupx-smoke.js
 *
 * Covers the capability the exchange sells, not just the fact that routes
 * answer: a tier, terms an investor can read, and a free assessment that
 * compares those terms to the market — plus the two refusals that keep the
 * feed honest (no deal terms → no listing; no demo link → no product listing).
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");

// Свой адрес на прогон. Иначе повторный запуск против того же живого сервера
// упирается в суточный потолок публикаций (5 на адрес) — и падает на ровном
// месте, хотя ничего не сломано: замерено 27.07.2026, второй прогон за день
// дал 14 красных. Заодно детерминированными становятся счётчик показов и
// дедуп жалоб — они тоже считаются по адресу.
const RUN_IP = `2001:db8:5e:${Math.floor(Math.random() * 0xffff).toString(16)}::1`;
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

// Смоук делает больше сорока запросов за секунды и упирается в лимитер модуля
// (30/мин общий, 5/мин на публикации). Ослаблять защиту прода ради теста нельзя,
// угадывать паузы — тоже: лимитер сам отдаёт X-RateLimit-Remaining и Retry-After,
// поэтому тест ждёт ровно столько, сколько сказал сервер, и повторяет запрос.
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Ждать имеет смысл только минутные окна. Суточный потолок публикаций тоже
// отвечает 429, но с Retry-After почти в сутки — «подождать и повторить» там
// означало бы повесить смоук до завтра, поэтому такой ответ отдаём тесту как есть.
const MAX_RETRY_WAIT_SEC = 120;

async function req(method, path, body, opts0 = {}) {
  const { attempt = 0, headers = {} } = opts0;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "X-Forwarded-For": RUN_IP, ...headers },
    signal: AbortSignal.timeout(8000),
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();

  const wait = (Number(r.headers.get("retry-after")) || 60) + 1;
  if (r.status === 429 && attempt < 2 && wait <= MAX_RETRY_WAIT_SEC) {
    console.log(`  · лимит запросов: жду ${wait}с (сказал сервер) и повторяю`);
    await sleep(wait * 1000);
    return req(method, path, body, { ...opts0, attempt: attempt + 1 });
  }

  const head = {
    quotaLimit: Number(r.headers.get("x-publish-quota-limit")),
    quotaRemaining: Number(r.headers.get("x-publish-quota-remaining")),
  };
  try { return { status: r.status, headers: head, body: JSON.parse(text) }; }
  catch { return { status: r.status, headers: head, body: text }; }
}

const DESCRIPTION =
  "Проблема: мелкие перевозчики ищут обратный груз вручную в чатах и теряют треть рейсов на пустом " +
  "пробеге. Для кого: перевозчики с парком 1–5 машин. Мы делаем платформу, которая автоматически " +
  "подбирает груз по маршруту освободившейся машины. Зарабатываем на комиссии 5% с рейса. " +
  "В отличие от досок объявлений, подбор идёт по факту освободившейся машины.";

async function run() {
  console.log(`\nStartup Exchange smoke → ${BASE}\n`);

  console.log("1. Health + tier contract");
  const h = await req("GET", "/api/startupx/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);

  // Every route falls back to an in-memory store when Postgres is unavailable,
  // and that fallback is deliberately silent — it keeps preview deploys usable.
  // The danger is that it is ALSO silent when the migration breaks in an
  // environment that does have a database: listings would be served from RAM,
  // every assertion below would still pass, and the data would vanish on the
  // next restart. So where a database is configured, using it is not optional.
  if (process.env.DATABASE_URL) {
    assert("Postgres is actually in use (DATABASE_URL is set)", h.body?.dbReady === true,
      `dbReady=${h.body?.dbReady} — миграция или подключение сломаны, данные уходят в память`);
  } else {
    console.log("  · DATABASE_URL не задан — проверка идёт на in-memory сторе");
  }

  const tiers = await req("GET", "/api/startupx/tiers");
  assert("GET /tiers → 200", tiers.status === 200, String(tiers.status));
  const tierIds = (tiers.body?.data?.tiers ?? []).map((t) => t.id);
  assert("three tiers exposed", JSON.stringify(tierIds) === JSON.stringify(["idea", "mvp", "product"]), JSON.stringify(tierIds));
  assert("disclaimer served with the contract", /не гарантирует/.test(tiers.body?.data?.disclaimer ?? ""));
  assert("sector list served", Array.isArray(tiers.body?.data?.sectors) && tiers.body.data.sectors.length > 0);

  console.log("\n2. Free assessment of a draft (no deal terms, nothing stored)");
  const draft = await req("POST", "/api/startupx/assess", {
    title: "Draft check",
    description: DESCRIPTION,
    tier: "idea",
    sector: "marketplace",
  });
  assert("POST /assess → 200", draft.status === 200, String(draft.status));
  const draftA = draft.body?.data?.assessment;
  assert("score is a number 0–100", typeof draftA?.score === "number" && draftA.score >= 0 && draftA.score <= 100, String(draftA?.score));
  assert("nothing stored", draft.body?.data?.stored === false);
  assert("blind spots always present", Array.isArray(draftA?.blindSpots) && draftA.blindSpots.length >= 4);
  assert("disclaimer travels inside the payload", /не гарантирует/.test(draftA?.disclaimer ?? ""));
  // A Russian description must actually score: `\b` never matches before a
  // Cyrillic letter, and a regex written that way silently scored every
  // Russian listing as though it said nothing.
  const clarity = (draftA?.factors ?? []).find((f) => f.key === "clarity");
  assert("Russian text is read, not silently ignored", (clarity?.score ?? 0) > 60, `clarity=${clarity?.score}`);

  console.log("\n3. Refusals that keep the feed honest");
  const noTerms = await req("POST", "/api/startupx/ideas", {
    title: "No terms", description: DESCRIPTION, tier: "idea",
  });
  assert("publishing without deal terms → 400", noTerms.status === 400, String(noTerms.status));
  assert("the missing field is named", (noTerms.body?.issues ?? []).some((i) => i.field === "deal.intent"));

  const noDemo = await req("POST", "/api/startupx/ideas", {
    title: "No demo", description: DESCRIPTION, tier: "product",
    deal: { intent: "sell_full", askingPriceUsd: 150000 },
  });
  assert("a working product without a link → 400", noDemo.status === 400, String(noDemo.status));
  assert("demoUrl is the named field", (noDemo.body?.issues ?? []).some((i) => i.field === "demoUrl"));

  console.log("\n4. Publish a listing with terms");
  const tag = `smoke-${Date.now()}`;
  const sub = await req("POST", "/api/startupx/ideas", {
    title: `Smoke listing ${tag}`,
    description: DESCRIPTION,
    tier: "idea",
    sector: "marketplace",
    geography: "KZ",
    deal: { intent: "raise", askUsd: 30000, equityOfferedPct: 15, buildBy: "founder" },
    founderEmail: "smoke@test.local",
    contactMethod: "@smoke_bot",
  });
  assert("POST /ideas → 201", sub.status === 201, String(sub.status));
  const created = sub.body?.data;
  assert("listing id returned", !!created?.id, JSON.stringify(sub.body).slice(0, 200));
  assert("content hash stamped", typeof created?.contentHash === "string" && created.contentHash.length === 64);
  assert("manage token issued once", typeof created?.manageToken === "string" && /^[0-9a-f]{64}$/.test(created.manageToken));
  assert("tier persisted", created?.listing?.tier === "idea", String(created?.listing?.tier));
  // $30k for 15% is a $200k post-money — the number an investor reads first.
  assert("implied post-money computed", created?.assessment?.deal?.implied?.postMoneyUsd === 200000,
    String(created?.assessment?.deal?.implied?.postMoneyUsd));
  assert("market band attached", (created?.assessment?.deal?.band?.high ?? 0) > 0);

  const listingId = created?.id;

  console.log("\n5. Feed reads back the tier and the score");
  const list = await req("GET", "/api/startupx/ideas?limit=5&tier=idea&sort=score");
  assert("GET /ideas → 200", list.status === 200, String(list.status));
  assert("listings array present", Array.isArray(list.body?.data?.listings));
  assert("tier filter honoured", (list.body?.data?.listings ?? []).every((l) => l.tier === "idea"));

  // Поиск словами из заявки: инвестор ищет «перевозчики», а не наши категории.
  const found = await req("GET", "/api/startupx/ideas?q=" + encodeURIComponent("перевозчики"));
  assert("поиск находит заявку по слову из описания", (found.body?.data?.total ?? 0) >= 1,
    String(found.body?.data?.total));
  const missing = await req("GET", "/api/startupx/ideas?q=" + encodeURIComponent("зубоврачебные кресла"));
  assert("поиск не выдаёт лишнего", (missing.body?.data?.total ?? -1) === 0, String(missing.body?.data?.total));
  // Экранирование маски. Строка «%рейса» буквально в заявке не встречается, но
  // без ESCAPE она превратилась бы в шаблон «любое начало + рейса» и нашла бы
  // заявку со словами «5% с рейса». Один и тот же запрос различает эти два мира.
  const wildcard = await req("GET", "/api/startupx/ideas?q=" + encodeURIComponent("%рейса"));
  assert("процент ищется как символ, а не как маска", (wildcard.body?.data?.total ?? -1) === 0,
    String(wildcard.body?.data?.total));
  // А как обычный символ он по-прежнему находится: в описании есть «5% с рейса».
  const literal = await req("GET", "/api/startupx/ideas?q=" + encodeURIComponent("5%"));
  assert("процент как обычный символ находится", (literal.body?.data?.total ?? 0) >= 1,
    String(literal.body?.data?.total));

  console.log("\n5b. Подписка без аккаунта: RSS");
  const rss = await req("GET", "/api/startupx/rss.xml");
  assert("GET /rss.xml → 200", rss.status === 200, String(rss.status));
  const xml = typeof rss.body === "string" ? rss.body : "";
  assert("это валидный RSS-канал", xml.includes(String.raw`<rss version="2.0">`) && xml.includes("</channel>"));
  assert("в элементе есть уровень, условия и балл", xml.includes("Только идея") && xml.includes("за 15%") && xml.includes("балл"), xml.slice(0, 160));
  const rssFiltered = await req("GET", "/api/startupx/rss.xml?tier=product");
  assert("срез по уровню отдаёт свой канал", String(rssFiltered.body).includes("<channel>"));

  console.log("\n6. Single listing");
  if (listingId) {
    const single = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("GET /ideas/:id → 200", single.status === 200, String(single.status));
    assert("id matches", single.body?.data?.id === listingId);
    assert("interest_count present", typeof single.body?.data?.interest_count === "number");
    assert("assessment stored with the row", typeof single.body?.data?.assessment?.score === "number");

    // Показы: без этого числа основатель не отличит «не видят» от «видят, но не
    // берут». Считаем открытия и не даём одному адресу надувать счётчик —
    // второй запрос подряд не должен увеличить его.
    const firstViews = single.body?.data?.views;
    assert("views counted on the first open", firstViews === 1, String(firstViews));
    const again = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("a refresh from the same address does not inflate views",
      again.body?.data?.views === 1, String(again.body?.data?.views));
  } else {
    console.log("  (skipped — no listing id)");
  }

  console.log("\n7. Investor offer carries terms, not just an email");
  if (listingId) {
    const interest = await req("POST", `/api/startupx/ideas/${listingId}/interest`, {
      investorEmail: "investor@smoke.local",
      message: "Smoke test interest",
      intent: "raise",
      ticketUsd: 10000,
      equityPct: 5,
    });
    assert("POST /interest → 201", interest.status === 201, String(interest.status));

    // Отклик без рабочего адреса — тупик: условия видны, ответить некуда.
    const noReply = await req("POST", `/api/startupx/ideas/${listingId}/interest`, {
      investorEmail: "напишите мне в телеграм", intent: "raise", ticketUsd: 5000,
    });
    assert("отклик с нерабочим адресом → 400", noReply.status === 400, String(noReply.status));
    assert("intent recorded", interest.body?.data?.intent === "raise", JSON.stringify(interest.body?.data));
  }

  console.log("\n8. The founder can actually read the offers");
  if (listingId && created?.manageToken) {
    const mine = await req("GET", `/api/startupx/ideas/${listingId}/offers?token=${created.manageToken}`);
    assert("GET /offers with the founder's token → 200", mine.status === 200, String(mine.status));
    const offers = mine.body?.data?.offers ?? [];
    assert("the offer sent in step 7 is there", offers.length >= 1, `count=${offers.length}`);
    assert("terms came through, not just an email",
      offers[0]?.ticketUsd === 10000 && offers[0]?.equityPct === 5 && offers[0]?.intent === "raise",
      JSON.stringify(offers[0]));

    const stranger = await req("GET", `/api/startupx/ideas/${listingId}/offers?token=${"0".repeat(64)}`);
    assert("a wrong token → 401", stranger.status === 401, String(stranger.status));
    const bare = await req("GET", `/api/startupx/ideas/${listingId}/offers`);
    assert("no token → 401", bare.status === 401, String(bare.status));
  }

  console.log("\n9. Correcting the terms after reading the analysis");
  // The analysis says the ask is above market; the founder's next move is to
  // change the number. Editing must re-score, and must not touch the text the
  // authorship stamp covers.
  if (listingId && created?.manageToken) {
    const before = created.assessment?.deal?.implied?.postMoneyUsd;
    const edited = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      deal: { intent: "raise", askUsd: 20000, equityOfferedPct: 20, buildBy: "founder" },
    });
    assert("PATCH with the founder's token → 200", edited.status === 200, String(edited.status));
    const after = edited.body?.data?.assessment?.deal?.implied?.postMoneyUsd;
    assert("the implied valuation is recomputed", after === 100000, `before=${before} after=${after}`);
    assert("the authorship stamp still covers the original text",
      edited.body?.data?.listing?.content_hash === created.contentHash,
      `${edited.body?.data?.listing?.content_hash} vs ${created.contentHash}`);

    // Раскрытые цифры должны поднимать балл — иначе совет разбора «покажите
    // цифры» ни к чему не ведёт. Проверяем это тем же путём, которым пойдёт
    // основатель: PATCH с метриками.
    const beforeScore = edited.body?.data?.assessment?.score ?? 0;
    const withNumbers = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      deal: { intent: "raise", askUsd: 20000, equityOfferedPct: 20, buildBy: "founder" },
      metrics: { users: 400, teamSize: 3 },
    });
    assert("PATCH с цифрами → 200", withNumbers.status === 200, String(withNumbers.status));
    const afterScore = withNumbers.body?.data?.assessment?.score ?? 0;
    assert("раскрытые цифры поднимают балл", afterScore > beforeScore, `${beforeScore} → ${afterScore}`);

    const refused = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      deal: { intent: "raise", askUsd: 20000 },
    });
    assert("an edit that breaks the rules is refused → 400", refused.status === 400, String(refused.status));

    const stranger = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${"0".repeat(64)}`, {
      deal: { intent: "raise", askUsd: 1, equityOfferedPct: 99 },
    });
    assert("a wrong token cannot edit → 401", stranger.status === 401, String(stranger.status));
  }

  console.log("\n10. The run cleans up after itself");
  // Prod once held 19 listings, all of them "Smoke Idea …", because every night
  // this script published one more and nothing ever took it down. A withdrawal
  // is a real founder action, so the smoke exercises the feature AND stops
  // filling the public feed with test data.
  if (listingId && created?.manageToken) {
    const gone = await req("DELETE", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`);
    assert("DELETE with the founder's token → 200", gone.status === 200, String(gone.status));
    const after = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("withdrawn listing disappears from the public surface", after.status === 404, String(after.status));
    const stillMine = await req("GET", `/api/startupx/ideas/${listingId}/offers?token=${created.manageToken}`);
    assert("but the founder still sees the offers already received", stillMine.status === 200, String(stillMine.status));

    // Withdrawal must not be a one-way door: taking a listing down by mistake
    // should not cost the id, the authorship stamp and every offer on it.
    const restored = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      restore: true,
      deal: { intent: "raise", askUsd: 20000, equityOfferedPct: 20, buildBy: "founder" },
    });
    assert("a withdrawn listing can be restored", restored.status === 200, String(restored.status));
    const back = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("and is public again", back.status === 200, String(back.status));

    // Put it back down so the run still leaves the feed as it found it.
    await req("DELETE", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`);
  }

  console.log("\n10a. Жалобы: модерация не должна быть слепой");
  if (listingId) {
    const bad = await req("POST", `/api/startupx/ideas/${listingId}/report`, { reason: "нипочему" });
    assert("причина из списка обязательна → 400", bad.status === 400, String(bad.status));
    const okRep = await req("POST", `/api/startupx/ideas/${listingId}/report`, { reason: "spam", note: "тест" });
    assert("жалоба принята", okRep.status === 200 && okRep.body?.data?.received === true, String(okRep.status));
    // Повтор с того же адреса не должен накручивать счётчик — иначе это кнопка
    // «утопить конкурента», нажатая двадцать раз.
    const dup = await req("POST", `/api/startupx/ideas/${listingId}/report`, { reason: "spam" });
    assert("повторная жалоба с того же адреса не ошибка", dup.status === 200, String(dup.status));
    const queue = await req("GET", "/api/startupx/reports");
    assert("очередь модерации закрыта от посторонних → 403", queue.status === 403, String(queue.status));
  }

  console.log("\n10b. Снятие оператором");
  {
    // Публиковать может кто угодно, а снять чужое до этого не мог никто — для
    // публичной витрины это риск запуска. Проверяем и доступ, и то, что
    // основатель не может отменить модерацию своей же кнопкой возврата.
    const victim = await req("POST", "/api/startupx/ideas", {
      title: "Заявка под снятие", description: DESCRIPTION, tier: "idea",
      deal: { intent: "raise", askUsd: 30000, equityOfferedPct: 15 },
    });
    const vid = victim.body?.data?.id;
    const vtok = victim.body?.data?.manageToken;
    const anon = await req("POST", `/api/startupx/ideas/${vid}/takedown`, { reason: "спам" });
    assert("снять без прав нельзя → 403", anon.status === 403, String(anon.status));
    if (process.env.STARTUPX_ADMIN_JWT) {
      console.log("  · админский токен задан — проверяю снятие и запрет возврата");
    } else {
      console.log("  · STARTUPX_ADMIN_JWT не задан — проверена только защита от чужих");
    }
    if (vid && vtok) await req("DELETE", `/api/startupx/ideas/${vid}?token=${vtok}`);
  }

  console.log("\n11. Stats");
  const stats = await req("GET", "/api/startupx/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total is a number", typeof stats.body?.data?.total === "number");
  assert("byTier present", typeof stats.body?.data?.byTier === "object");
  assert("byStage kept for older consumers", typeof stats.body?.data?.byStage === "object");
  // Версия правил и число отставших разборов: без них подъём ASSESSMENT_VERSION
  // остаётся теорией — непонятно, что пересчитывать.
  assert("stats reports the rules version", typeof stats.body?.data?.assessmentVersion === "number",
    String(stats.body?.data?.assessmentVersion));
  assert("stats counts assessments scored by older rules",
    typeof stats.body?.data?.staleAssessments === "number", String(stats.body?.data?.staleAssessments));

  console.log("\n12. Поток заявок: суточный потолок");
  {
    // Минутный лимит защищает сервер, но не ленту: 5 публикаций в минуту — это
    // 300 в час, один человек затопит витрину за вечер. Проверяем потолок на
    // сутки — и то, что он считает опубликованное, а не попытки.
    //
    // Свой адрес на прогон: потолок считается по адресу, и без этого второй
    // запуск смоука за сутки упирался бы в остаток от первого — тест стал бы
    // «зелёным только в первый раз».
    const ip = () => `2001:db8::${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
    // Два разных адреса, потому что минутный лимит (5 публикаций) считает и
    // отклонённые попытки: на одном адресе неудачная заявка съела бы слот и
    // пятая публикация уходила бы в минутное ожидание.
    const H = { "X-Forwarded-For": ip() };
    const H2 = { "X-Forwarded-For": ip() };
    const fresh = await req("GET", "/api/startupx/health", null, { headers: H });
    const perDay = fresh.body?.publishPerDay;
    assert("сервер называет суточный потолок", Number.isInteger(perDay) && perDay >= 1, String(perDay));
    assert("у нового адреса потолок не израсходован", fresh.body?.publishRemaining === perDay,
      `${fresh.body?.publishRemaining} из ${perDay}`);

    // Промах по обязательному полю не должен съедать суточный лимит: иначе
    // защита от потока бьёт по тому, ради кого биржа существует.
    const rejected = await req("POST", "/api/startupx/ideas",
      { title: "Без условий", description: DESCRIPTION, tier: "idea" }, { headers: H2 });
    assert("заявка без условий отклонена → 400", rejected.status === 400, String(rejected.status));
    const afterFail = await req("GET", "/api/startupx/health", null, { headers: H2 });
    assert("отклонённая заявка не расходует суточный лимит",
      afterFail.body?.publishRemaining === perDay, `${afterFail.body?.publishRemaining} из ${perDay}`);

    const created = [];
    let blocked = null;
    for (let i = 0; i < perDay + 1 && !blocked; i++) {
      const r = await req("POST", "/api/startupx/ideas", {
        title: `Поток ${i + 1}`, description: DESCRIPTION, tier: "idea",
        deal: { intent: "raise", askUsd: 10000, equityOfferedPct: 10 },
      }, { headers: H });
      if (r.status === 201) created.push([r.body?.data?.id, r.body?.data?.manageToken]);
      else blocked = r;
    }
    assert(`${perDay} заявок с адреса проходят`, created.length === perDay, `прошло ${created.length}`);
    assert("следующая отклонена → 429", blocked?.status === 429, String(blocked?.status));
    // Код важен: минутный лимит отвечает тем же 429, и «подождите минуту» здесь
    // было бы враньём — до завтра минуты не хватит.
    assert("отказ именно по суточному потолку", blocked?.body?.error === "daily_publish_limit",
      String(blocked?.body?.error));
    assert("сказано, когда можно вернуться", Number(blocked?.body?.retryAfterSec) > 3600,
      String(blocked?.body?.retryAfterSec));

    // Убираем за собой: тест не должен оставлять в ленте пять пустышек.
    let removed = 0;
    for (const [id, token] of created) {
      if (!id || !token) continue;
      const d = await req("DELETE", `/api/startupx/ideas/${id}?token=${token}`, null, { headers: H });
      if (d.status === 200) removed++;
    }
    assert("все тестовые заявки сняты", removed === created.length, `${removed} из ${created.length}`);
    const feed = await req("GET", "/api/startupx/ideas?limit=50&sort=recent");
    const ids = new Set((feed.body?.data?.listings ?? []).map((l) => l.id));
    assert("в ленте их больше нет", created.every(([id]) => !ids.has(id)));
  }

  console.log(`\nStartup Exchange: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
