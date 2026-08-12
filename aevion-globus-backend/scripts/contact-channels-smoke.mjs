#!/usr/bin/env node
/**
 * Каналы связи, которые сайт ОБЕЩАЕТ, против того, работают ли они.
 *
 * 12.08.2026: на страницах было напечатано 36 адресов вида support@aevion.app,
 * privacy@aevion.app, billing@aevion.app — в том числе на юридических страницах,
 * где указан адрес для запросов о персональных данных и для возврата денег.
 * У домена aevion.app НЕТ записи MX: письма возвращаются отправителю. Рядом
 * форма на /help отправляла на /api/help/contact, которого не существовало —
 * прод отвечал 404. Ничего при этом не падало и не выглядело сломанным.
 *
 * Смок проверяет две вещи:
 *   1) у каждого домена, чьи адреса напечатаны на сайте, есть MX;
 *   2) ручка приёма обращений существует.
 *
 * Ручка проверяется ЗАВЕДОМО НЕВЕРНЫМ пакетом: ожидаем 400 ((«поля не прошли
 * проверку» — значит роут жив), а 404 означает, что его нет. Так проверка не
 * оставляет на проде ни одного настоящего обращения.
 *
 * Usage: node scripts/contact-channels-smoke.mjs
 * Env:   BASE (по умолчанию https://aevion.app/api-backend)
 * Коды:  0 — всё работает или известно; 1 — появилось новое; 2 — не смог проверить.
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";

const SRC = path.join(import.meta.dirname, "..", "..", "frontend", "src");
const BASE = (process.env.BASE || "https://aevion.app/api-backend").replace(/\/+$/, "");

// Известно на 12.08.2026: домен сайта почту не принимает. Чинится записью MX в
// аккаунте регистратора — это рука основателя, и до неё смок не должен держать
// весь ежедневный набор красным. Список обязан ПУСТЕТЬ: как только MX появится,
// смок попросит убрать домен отсюда.
const KNOWN_NO_MX = new Set(["aevion.app"]);

// Ручка /api/help/contact написана 12.08.2026, но на проде появится только
// после выкладки ветки. До тех пор она отвечает 404 — и это ИЗВЕСТНО, а не
// новая поломка. Без этой отметки смок нельзя было бы подключить к ежедневному
// набору сегодня, а «подключу позже» — ровно тот способ, которым инструменты
// становятся забытыми: сегодня я нашёл сразу несколько таких.
// Отметка обязана сняться: когда ручка ответит, смок сам попросит убрать её.
const ENDPOINT_PENDING_DEPLOY = true;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mdx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Адреса, напечатанные на сайте, с указанием где именно. */
function advertisedEmails() {
  const found = new Map(); // домен -> Set(файлов)
  const RE = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi;
  for (const f of walk(SRC)) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(RE)) {
      const domain = m[1].toLowerCase();
      // Примеры и заглушки в подсказках полей — не обещание канала.
      if (/^(example|test|domain|mail)\.(com|org|net)$/.test(domain)) continue;
      if (!/aevion/.test(domain)) continue;
      if (!found.has(domain)) found.set(domain, new Set());
      found.get(domain).add(path.relative(SRC, f).replace(/\\/g, "/"));
    }
  }
  return found;
}

async function hasMx(domain) {
  try {
    const r = await dns.resolveMx(domain);
    return { ok: Array.isArray(r) && r.length > 0, detail: r?.map((x) => x.exchange).join(", ") };
  } catch (e) {
    // ENODATA/ENOTFOUND — записи нет. Прочие ошибки — это сбой связи, а не вывод
    // о домене: путать их значит однажды объявить почту сломанной из-за DNS.
    if (e && (e.code === "ENODATA" || e.code === "ENOTFOUND")) return { ok: false, detail: "записи MX нет" };
    return { unknown: true, detail: String(e?.code || e) };
  }
}

async function contactEndpointAlive() {
  try {
    const r = await fetch(`${BASE}/api/help/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "smoke", subject: "", message: "" }),
    });
    if (r.status === 404) return { ok: false, detail: "404 — ручки не существует" };
    // 400 (не прошло проверку) и 429 (ограничение частоты) одинаково доказывают,
    // что роут жив и обрабатывает запрос.
    if (r.status === 400 || r.status === 429) return { ok: true, detail: `отвечает ${r.status}` };
    return { ok: r.ok, detail: `код ${r.status}` };
  } catch (e) {
    return { unknown: true, detail: String(e?.message || e) };
  }
}

const emails = advertisedEmails();
if (emails.size === 0) {
  console.error("НЕ СМОГ ПРОВЕРИТЬ: на страницах не нашлось ни одного адреса — шаблон поиска устарел?");
  process.exitCode = 2;
} else {
  let broken = 0, known = 0, unknown = 0;
  console.log("Домены, чьи адреса напечатаны на сайте:\n");
  for (const [domain, files] of [...emails].sort()) {
    const r = await hasMx(domain);
    if (r.unknown) {
      unknown++;
      console.log(`  ?     ${domain.padEnd(14)} не смог спросить DNS: ${r.detail}`);
      continue;
    }
    if (r.ok) {
      if (KNOWN_NO_MX.has(domain)) {
        console.log(`  ПОЧИНЕНО ${domain} принимает почту — убери его из KNOWN_NO_MX`);
      } else {
        console.log(`  ok    ${domain.padEnd(14)} MX: ${r.detail}`);
      }
      continue;
    }
    const where = [...files].slice(0, 3).join(", ") + (files.size > 3 ? ` (+${files.size - 3})` : "");
    if (KNOWN_NO_MX.has(domain)) {
      known++;
      console.log(`  ИЗВЕСТНО ${domain} — ${r.detail}; напечатан в: ${where}`);
    } else {
      broken++;
      console.log(`  ПУСТО ${domain.padEnd(14)} ${r.detail}; напечатан в: ${where}`);
    }
  }

  console.log("\nРучка приёма обращений:");
  const ep = await contactEndpointAlive();
  if (ep.unknown) {
    unknown++;
    console.log(`  ?     не смог спросить: ${ep.detail}`);
  } else {
    if (ep.ok && ENDPOINT_PENDING_DEPLOY) {
      console.log(`  ok    /api/help/contact — ${ep.detail}`);
      console.log("  ПОЧИНЕНО — ручка выкатилась, убери ENDPOINT_PENDING_DEPLOY");
    } else if (!ep.ok && ENDPOINT_PENDING_DEPLOY) {
      known++;
      console.log(`  ИЗВЕСТНО /api/help/contact — ${ep.detail}; ждёт выкладки ветки`);
    } else {
      console.log(`  ${ep.ok ? "ok   " : "ПУСТО"} /api/help/contact — ${ep.detail}`);
      if (!ep.ok) broken++;
    }
  }

  console.log("");
  if (broken > 0) {
    console.error(`ПРОВАЛ: неработающих каналов ${broken}. Сайт обещает связь, которой нет.`);
    process.exitCode = 1;
  } else if (unknown > 0 && known === 0) {
    console.error("НЕ СМОГ ПРОВЕРИТЬ: DNS или прод не ответили.");
    process.exitCode = 2;
  } else {
    console.log(known ? "Новых обрывов нет (известное ждёт записи MX)." : "Все обещанные каналы работают.");
    process.exitCode = 0;
  }
}
