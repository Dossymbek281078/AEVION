#!/usr/bin/env node
/**
 * Все ли модули платформы вообще есть на проде. Только чтение.
 *
 * Повод (14.08.2026): сервис Railway один на всю платформу, выкатка заменяет
 * образ целиком, и за один день в него выкатились пять разных сессий. Пропажу
 * шахмат я заметил лишь потому, что у них есть свой смок с семнадцатью
 * проверками. У остальных ста модулей проб не было НИ ОДНОЙ — их исчезновение
 * прошло бы совсем незаметно.
 *
 * Как устроено. Набор проб (scripts/prod-module-probes.json) собран не руками:
 * из index.ts взяты все точки монтирования, из файлов роутеров — ручки GET без
 * параметров, и каждая проверена на живом проде. Осталась одна проба на модуль
 * с ответом, ОТЛИЧНЫМ от 404.
 *
 * Почему именно «не 404»: express отвечает 404 и на несуществующий путь внутри
 * живого модуля, и на путь модуля, которого нет вовсе. То есть 404 не
 * доказывает ничего, а 200/400/401/402/403 доказывает, что роутер смонтирован.
 * Поэтому проба считается сломанной ровно тогда, когда была не-404, а стала
 * 404.
 *
 *   node scripts/prod-module-surface.js
 *   BASE=https://... node scripts/prod-module-surface.js
 *
 * Коды выхода: 0 — все модули на месте; 1 — какие-то пропали; 2 — прод не
 * ответил (это НЕ «всё хорошо»).
 */

const fs = require("node:fs");
const path = require("node:path");

const BASE = (process.env.BASE || "https://api.aevion.app").replace(/\/+$/, "");
const PROBES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "prod-module-probes.json"), "utf-8"),
);

/**
 * Сколько модулей ВООБЩЕ не под наблюдением.
 *
 * Набор проб собран из index.ts на день сборки. Появится новый модуль — пробы у
 * него не будет, и его пропажа снова пройдёт незамеченной, а отчёт останется
 * зелёным: проверка честно скажет «все 84 на месте», просто их станет не 84 из
 * 105, а 84 из 130. Покрытие обязано называть себя само, иначе оно тихо едет
 * вниз — это тот же класс, что и «проверка охватывала одну страницу из 21».
 */
function coverage(probes) {
  let idx = "";
  try {
    idx = fs.readFileSync(path.join(__dirname, "..", "src", "index.ts"), "utf-8");
  } catch {
    return null; // исходника рядом нет (запуск не из репозитория) — молчим, а не выдумываем
  }
  const mounted = new Set();
  // Оба вида кавычек: половина index.ts пишет одинарные, и счётчик точек
  // монтирования занижался — покрытие выглядело лучше, чем есть.
  for (const m of idx.matchAll(/app\.use\(["'](\/api\/[^"']+)["']/g)) mounted.add(m[1]);

  // ВТОРОЙ источник монтирования. Новые модули добавляют строку в EXTRA_MOUNTS
  // (moduleManifest.ts), а не правят index.ts — там живут qventure, qskyway,
  // qevents, qreal, data-quality. Считая только app.use, я делил на заниженный
  // знаменатель, то есть проверка покрытия страдала ровно тем, что призвана
  // ловить: отвечала «88 из 95», не зная про ещё пять точек.
  try {
    const man = fs.readFileSync(
      path.join(__dirname, "..", "src", "routes", "moduleManifest.ts"),
      "utf-8",
    );
    for (const m of man.matchAll(/path:\s*["'](\/api\/[^"']+)["']/g)) mounted.add(m[1]);
  } catch {
    /* манифеста нет — тогда просто не добавляем, а не выдумываем */
  }
  const watched = new Set(probes.map((p) => p.base));
  const unwatched = [...mounted].filter((b) => !watched.has(b)).sort();
  return { mounted: mounted.size, watched: watched.size, unwatched };
}

async function probe(p) {
  try {
    // 06.09.2026: у части модулей нет НИ ОДНОЙ GET-ручки без параметров —
    // их монтирование доказывает только POST. Проба шлёт ПУСТОЕ тело {}:
    // живой роутер отвечает своим 4xx (400 «нет полей» / 401 «нет подписи»)
    // ДО какой-либо работы, несмонтированный — 404. Данных не создаёт:
    // это проверено на каждом добавленном адресе. Битый JSON для этого
    // НЕ годится — body-parser бьёт его 400 ГЛОБАЛЬНО, до маршрутизации
    // (поймано отрицательным контролем на выдуманном пути); OPTIONS не
    // годится тоже — CORS отвечает 204 на что угодно.
    const init = { signal: AbortSignal.timeout(15000) };
    if (p.method && p.method !== "GET") {
      init.method = p.method;
      init.headers = { "Content-Type": "application/json" };
      init.body = "{}";
    }
    const r = await fetch(BASE + p.url, init);
    return { ...p, status: r.status };
  } catch (e) {
    return { ...p, status: 0, error: e.message || String(e) };
  }
}

async function main() {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (i < PROBES.length) {
      results.push(await probe(PROBES[i++]));
    }
  });
  await Promise.all(workers);

  const unreachable = results.filter((r) => r.status === 0);
  // Прод не ответил ни разу — это неисправность связи, а не пропажа модулей.
  // Объявить сто модулей пропавшими из-за одного обрыва сети значит научить
  // читателя не верить проверке.
  if (unreachable.length === results.length) {
    console.error(`\nПрод не отвечает (${results[0]?.error || "?"}). Это не ответ «модулей нет».`);
    process.exitCode = 2;
    return;
  }

  const missing = results.filter((r) => r.status === 404);
  const changed = results.filter(
    (r) => r.status !== 404 && r.status !== 0 && r.status !== r.expect,
  );

  console.log(`\nПоверхность модулей на проде → ${BASE}`);
  console.log(`проб: ${results.length}, на месте: ${results.length - missing.length - unreachable.length}`);

  if (missing.length) {
    console.log(`\n🔴 ПРОПАЛИ (${missing.length}) — модуль не смонтирован в текущей сборке:`);
    for (const m of missing.sort((a, b) => (a.base < b.base ? -1 : 1))) {
      console.log(`   ${m.base}   (проба ${m.url}: ожидался ${m.expect}, получен 404)`);
    }
    console.log(`\nСкорее всего на прод выкачена ветка без этих модулей.`);
    console.log(`Кто там сейчас: node C:\\Users\\user\\aevion-deploy-check.mjs`);
  }

  if (changed.length) {
    // Смена кода — не обязательно поломка (403 вместо 401 при смене защиты), но
    // сказать надо: молча принятое расхождение однажды окажется настоящим.
    console.log(`\n⚠️  Ответ изменился, не 404 (${changed.length}):`);
    for (const c of changed) console.log(`   ${c.url}: было ${c.expect}, стало ${c.status}`);
  }

  if (unreachable.length) {
    console.log(`\n… не ответили: ${unreachable.length} (сеть, а не модули)`);
  }

  if (!missing.length && !changed.length) console.log("\nВсе модули под наблюдением на месте, ответы прежние.");

  const cov = coverage(PROBES);
  if (cov) {
    console.log(`\nпокрытие: ${cov.watched} проб на ${cov.mounted} точек монтирования в коде`);
    if (cov.unwatched.length) {
      console.log(`\n⚠️  БЕЗ ПРОБЫ (${cov.unwatched.length}) — их пропажу проверка не заметит:`);
      for (const b of cov.unwatched.slice(0, 25)) console.log(`   ${b}`);
      if (cov.unwatched.length > 25) console.log(`   …и ещё ${cov.unwatched.length - 25}`);
      console.log(`\nПересобрать набор: см. шапку файла (пробы берутся из роутеров и`);
      console.log(`проверяются на живом проде; годится ответ, отличный от 404).`);
    }
  }

  process.exitCode = missing.length ? 1 : 0;
}

main();
