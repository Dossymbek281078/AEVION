#!/usr/bin/env node
/**
 * Отчёт: что мы ПРОДАЁМ против того, что реально ЗАКРЫТО платным доступом.
 *
 * Зачем. 13.08.2026 обнаружилось расхождение, которого не видно ни из кода, ни
 * из магазина по отдельности: из девяти модулей, продаваемых отдельными
 * подписками ($19–$149/мес), доступ закрыт только у одного (DevHub, своим
 * механизмом), а платным доступом закрыты шесть ДРУГИХ модулей, которых в
 * продаже нет вовсе. Покупатель QVenture за $39/мес получает ровно то же,
 * что и незарегистрированный гость.
 *
 * Механизм для этого написан, но не подключён: вебхук пишет строку в
 * `AppSubscription`, ручка `/api/apps/access` умеет её отдавать — и её не
 * вызывает ни один экран, а `planGate` про неё не знает.
 *
 * ЭТО ОТЧЁТ, А НЕ СТОРОЖ. Код выхода всегда 0. Включать платный доступ там,
 * где его нет, — решение о том, кому начать отказывать, то есть продуктовое,
 * а не техническое. Сторож, который краснеет на нерешённом вопросе, через
 * неделю перестаёт читаться (см. память feedback_audit_that_is_always_red).
 *
 * Запуск:  node scripts/sold-vs-enforced-report.mjs
 *          PROD_BASE=https://aevion.app node scripts/sold-vs-enforced-report.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROD_BASE = process.env.PROD_BASE || "https://aevion.app";
const POLICY_URL = `${PROD_BASE}/api-backend/api/paywall/policy`;

// Что продаётся отдельной подпиской — берём из таблицы вариантов, а не из
// отдельного списка: иначе появится второй источник правды и они разойдутся.
const VARIANTS_FILE = resolve(process.cwd(), "aevion-globus-backend/src/data/lemonSqueezyVariants.ts");

function soldModuleSlugs() {
  const src = readFileSync(VARIANTS_FILE, "utf8");
  // Берём ключи вида `app_<slug>:` из таблицы соответствия переменных.
  const slugs = new Set();
  for (const m of src.matchAll(/^\s*app_([a-z_]+)\s*:/gm)) slugs.add(m[1]);
  return [...slugs];
}

/**
 * Модули со СВОИМ механизмом доступа, мимо общего пейволла. Их отсутствие в
 * политике не означает «открыт всем» — иначе отчёт соврал бы ровно там, где
 * покупка как раз работает.
 */
const OWN_GATE = {
  devhub: "свой тариф в DevHubTier/DevHubEmailTier — покупка открывает Pro",
};

/** Названия модулей в пейволле и в таблице вариантов совпадают не буквально. */
const SLUG_TO_MODULE = {
  ip_bureau: "aevion-ip-bureau",
  smeta: "smeta-trainer",
  constitution: "constitution",
  devhub: "devhub",
};

async function main() {
  const sold = soldModuleSlugs();
  if (sold.length === 0) {
    console.log("В таблице вариантов не нашлось ни одного app_* — проверьте путь к файлу.");
    return;
  }

  let policy;
  try {
    const res = await fetch(POLICY_URL, {
      headers: { "User-Agent": "AEVION-sold-vs-enforced/1.0" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!(res.status >= 200 && res.status < 300)) {
      console.log(`Политика пейволла недоступна: ${POLICY_URL} → ${res.status}. Судить не по чему.`);
      return;
    }
    policy = await res.json();
  } catch (e) {
    console.log(`Политика пейволла не открылась: ${e.message}. Это НЕ значит «всё открыто» — просто не проверено.`);
    return;
  }

  const modules = Array.isArray(policy.modules) ? policy.modules : [];
  const byId = new Map(modules.map((m) => [m.module, m]));
  const enforced = modules.filter((m) => m.enforced).map((m) => m.module);

  console.log(`Политика пейволла: ${modules.length} модулей, закрыто платным доступом ${enforced.length}.\n`);

  console.log("ПРОДАЁТСЯ ОТДЕЛЬНОЙ ПОДПИСКОЙ:");
  const soldNotEnforced = [];
  for (const slug of sold.sort()) {
    const id = SLUG_TO_MODULE[slug] ?? slug;
    const m = byId.get(id);
    let state;
    if (OWN_GATE[slug]) state = `закрыт своим механизмом ✓ (${OWN_GATE[slug]})`;
    else if (!m) state = "в политике пейволла его нет и своего механизма не найдено";
    else if (m.enforced) state = "закрыт платным доступом ✓";
    else state = "ОТКРЫТ ВСЕМ — покупка ничего не добавляет";
    if (!OWN_GATE[slug] && (!m || !m.enforced)) soldNotEnforced.push(id);
    console.log(`  ${id.padEnd(20)} ${state}`);
  }

  console.log("\nЗАКРЫТО ПЛАТНЫМ ДОСТУПОМ, но отдельной подпиской НЕ продаётся:");
  const soldIds = new Set(sold.map((s) => SLUG_TO_MODULE[s] ?? s));
  const enforcedNotSold = enforced.filter((id) => !soldIds.has(id));
  for (const id of enforcedNotSold) console.log(`  ${id}`);
  if (enforcedNotSold.length === 0) console.log("  (нет)");

  console.log("");
  if (soldNotEnforced.length > 0) {
    console.log(
      `РАСХОЖДЕНИЕ: ${soldNotEnforced.length} из ${sold.length} продаваемых модулей открыты всем, ` +
      `а ${enforcedNotSold.length} закрытых нельзя купить отдельно.`,
    );
    console.log("Решение продуктовое: либо включать платный доступ у проданного, либо не продавать открытое.");
  } else {
    console.log("Расхождений нет: всё, что продаётся отдельно, закрыто платным доступом.");
  }
  // process.exit() здесь рвал keep-alive сокет fetch: Node падал с
  // «Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)» и отдавал код 127
  // вместо 0. Просто возвращаемся — код выхода и так 0.
}

await main();
