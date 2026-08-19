/**
 * Один способ спрашивать Overpass для всех скриптов QSkyway.
 *
 * Вынесено из `audit-height-claims.mjs` 12.08.2026, когда понадобился второй
 * аудит по тем же зданиям: копия этих сорока строк означала бы, что уроки,
 * оплаченные в первом (перебор зеркал по кругу, кэш по умолчанию, строка
 * прогресса ДО запроса), во втором пришлось бы получать заново.
 */

import fs from "node:fs";

export const OVERPASS_HOSTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Rounds outside, hosts inside — deliberately, and not the obvious nesting.
 *
 * With hosts on the OUTER loop a dead mirror costs three full timeouts before
 * anything else is tried: on 2026-07-27 overpass.kumi.systems stopped answering
 * while overpass-api.de replied in one second, and the audit sat for nine
 * minutes per run because it asked the dead one three times first. Round-robin
 * spends one timeout per host per round, so a healthy mirror is reached at once.
 */
export async function overpass(query, { ua, hosts = OVERPASS_HOSTS, bodyProblem } = {}) {
  let last;
  for (let round = 1; round <= 3; round++) {
    for (const host of hosts) {
      // Пишем ДО запроса, а не только при ошибке. Худший случай честно длинный:
      // три круга × три зеркала × 120 с плюс паузы — больше двадцати минут, и всё
      // это время инструмент не печатал ни строки. Человек в такой тишине решает,
      // что он повис, и больше его не запускает (так и вышло 11.08.2026).
      process.stderr.write(`  → ${new URL(host).host} (круг ${round} из 3, ждём до 120 с)…\n`);
      try {
        const res = await fetch(host, {
          method: "POST", body: query,
          headers: { "Content-Type": "text/plain", "User-Agent": ua },
          signal: AbortSignal.timeout(120_000),
        });
        // 429/504 is Overpass asking us to wait, not saying the data is absent.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // …and an overloaded instance says so with HTTP **200** and an HTML page.
        const body = await res.text();
        const problem = bodyProblem?.(body);
        if (problem) throw new Error(problem);
        return JSON.parse(body).elements;
      } catch (e) {
        last = e;
        process.stderr.write(`  ${host} round ${round}: ${e.message}\n`);
      }
    }
    if (round < 3) await new Promise((r) => setTimeout(r, 12_000 * round));
  }
  throw last;
}

/**
 * Кэш ВКЛЮЧЁН по умолчанию, а не по флагу. 11.08.2026 из-за его отсутствия
 * каждый запуск шёл в сеть, и аудит по Нью-Йорку дважды не дошёл до отчёта:
 * `overpass-api.de` отдаёт на запрос по Мидтауну HTTP 504, а перебор зеркал
 * занимает больше двадцати минут. Обойти: `--no-cache` / `--osm-cache <dir>`.
 */
export function osmCacheDir(argv, defaultDir) {
  if (argv.includes("--no-cache")) return null;
  const flag = argv.indexOf("--osm-cache");
  const dir = flag > 0 ? argv[flag + 1] : defaultDir;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ответ из кэша, если он есть; иначе запрос и запись в кэш. */
export async function cachedOverpass({ cacheFile, query, label, ua, bodyProblem }) {
  if (cacheFile && fs.existsSync(cacheFile)) {
    const elements = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    const days = Math.round((Date.now() - fs.statSync(cacheFile).mtimeMs) / 86400000);
    process.stderr.write(`${label} — ${elements.length} элементов из кэша (возраст ${days} дн., обойти — --no-cache)\n`);
    return elements;
  }
  process.stderr.write(`${label} — спрашиваем Overpass…\n`);
  const elements = await overpass(query, { ua, bodyProblem });
  if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(elements));
  return elements;
}
