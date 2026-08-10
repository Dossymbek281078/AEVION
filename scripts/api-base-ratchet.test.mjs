#!/usr/bin/env node
// Храповик на запросы мимо прокси.
//   node scripts/api-base-ratchet.test.mjs
//
// Браузерный код обязан звать бэкенд через `apiUrl()` из `@/lib/apiBase`.
// Голый `fetch("/api/...")` уходит в САМ Next: переписан только
// `/api-backend/*` (next.config.ts), в vercel.json rewrite'ов нет вовсе, а
// обработчики под `/api/` существуют лишь для нескольких путей (health,
// errors, metrics, openapi.json, pay, payments, revalidate-sdks). Всё
// остальное отвечает 404.
//
// Отказ при этом тихий: страница показывает «ошибка запроса» или пустой
// список, в консоли обычный 404, и выглядит это как «сервер не ответил».
// Живой случай 10.08.2026: в библиотеке мультичата так не грузился список и
// кнопки экспорта сохраняли страницу ошибки под именем multichat-….json;
// в startup-exchange так же была мертва кнопка «оценить ИИ» — в трёх
// соседних файлах модуля вызов идёт через apiUrl, а в четвёртом нет.
//
// Что делать, если тест упал:
//   • новый вызов — оберните путь в `apiUrl("/api/...")`;
//   • починили зону — уменьшите BASELINE;
//   • путь ДЕЙСТВИТЕЛЬНО обслуживается самим Next (есть route.ts под
//     frontend/src/app/api/...) — добавьте его в SAME_ORIGIN ниже.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const APP = path.join(HERE, "..", "frontend", "src", "app");

/**
 * Сколько голых вызовов ещё допустимо. Только вниз.
 * Срез 10.08.2026: 25 — qpaynet 19, build 2, cyberchess 2, qcoreai 2.
 * Все четыре зоны заняты другими сессиями. startup-exchange закрыт здесь же.
 */
const BASELINE = 25;

/** Пути, которые обслуживает сам Next — для них голый fetch правильный. */
const SAME_ORIGIN = ["/api/health", "/api/errors", "/api/metrics", "/api/openapi.json", "/api/pay/", "/api/payments/", "/api/revalidate-sdks"];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// Одинарные кавычки тоже: сейчас таких вызовов в коде нет, но проверка,
// не знающая про них, молча пропустит первый же — а именно от этого класса
// «незаметно мимо» она и поставлена.
const RAW = /fetch\(\s*[`"']\/api\/([^`"'$]*)/g;

const hits = [];
for (const file of walk(APP)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(RAW)) {
    const p = `/api/${m[1]}`;
    if (SAME_ORIGIN.some((s) => p.startsWith(s))) continue;
    hits.push(`${path.relative(APP, file).split(path.sep).join("/")} → ${p}`);
  }
}

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

console.log(`вызовов мимо прокси: ${hits.length} (планка ${BASELINE})`);

ok(
  "новых вызовов мимо прокси не появилось",
  hits.length <= BASELINE,
  `стало ${hits.length} против ${BASELINE}. Оберните путь в apiUrl() — голый /api/ уходит в Next и отвечает 404.`,
);

ok(
  "планка соответствует факту",
  hits.length === BASELINE,
  hits.length < BASELINE ? `осталось ${hits.length} — уменьшите BASELINE, чтобы храповик затянулся.` : "",
);

// Посылка проверки: прокси действительно живёт на /api-backend, а не на /api.
const nextConfig = readFileSync(path.join(HERE, "..", "frontend", "next.config.ts"), "utf8");
ok("прокси по-прежнему на /api-backend", nextConfig.includes("/api-backend/:path*"));
ok("сквозного rewrite для /api нет", !/source:\s*["']\/api\/:path\*/.test(nextConfig));

if (hits.length) {
  console.log("\nостаются (первые 8):");
  for (const h of hits.slice(0, 8)) console.log(`  ${h}`);
  if (hits.length > 8) console.log(`  … и ещё ${hits.length - 8}`);
}

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
