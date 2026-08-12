#!/usr/bin/env node
/**
 * Домены, на которые ссылается сайт, — существуют ли они вообще.
 *
 * 12.08.2026 свип нашёл ЧЕТЫРЕ несуществующих домена среди 69: aevion.tech,
 * aevion.kz, aevion.bank (+ пространство имён XML, оно не в счёт). На них были
 * завязаны QR-код на сертификате, QR профиля, реферальные ссылки банка,
 * встраиваемый виджет для партнёров и разметка JSON-LD для поисковиков.
 *
 * Почему не замечали: в браузере берётся window.location.origin, и всё выглядит
 * целым. Несуществующий домен подставлялся только в запасной ветке — при
 * серверном рендере, в печати и в картинках. Ничего не падало.
 *
 * ВАЖНО про форму адреса: этот свип видит только адреса со схемой (https://).
 * Голые упоминания в тексте («aevion.kz · тренажёр» в подвале печатной
 * страницы) он не находит — их искать грепом отдельно. Урок того же дня:
 * у адреса две формы, и чинить надо обе.
 *
 * Usage: node scripts/dead-domain-sweep.mjs [путь]   (по умолчанию frontend/src)
 * Коды:  0 — все домены существуют; 1 — есть несуществующие.
 *
 * Сбой DNS отделён от вывода «домена нет»: ENOTFOUND/ENODATA означают, что
 * записи нет, всё прочее — что не смогли спросить. Путать их значит однажды
 * объявить домен мёртвым из-за обрыва связи.
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";

const ROOT = process.argv[2] || new URL("../../frontend/src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.(tsx?|mdx?)$/.test(e.name)) o.push(p);
  }
  return o;
}


// Пространства имён XML/RDF — это ИДЕНТИФИКАТОРЫ, а не адреса: разрешаться в
// DNS им не положено, и требовать этого значит держать проверку вечно красной.
// Держим список явным и коротким, чтобы под него нельзя было спрятать
// настоящий мёртвый домен.
const NAMESPACE_HOSTS = new Set([
  "schemas.openxmlformats.org",
  "schemas.microsoft.com",
  "purl.org",
]);

const hosts = new Map();
for (const f of walk(ROOT)) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const h = m[1].toLowerCase();
    if (/localhost|example\.(com|org|net)|your-|placeholder|\.local$/.test(h)) continue;
    if (NAMESPACE_HOSTS.has(h)) continue;
    if (!hosts.has(h)) hosts.set(h, new Set());
    hosts.get(h).add(path.relative(ROOT, f).replace(/\\/g, "/"));
  }
  // Голые упоминания НАШИХ доменов — подписи в печати, надписи на картинках,
  // подвалы страниц. Свип по https:// их не видит: 12.08.2026 именно так уцелели
  // подпись на печатной странице тренажёра и текст внутри SVG-снимка банка,
  // и находить их пришлось грепом вручную. Чужие домены голым текстом не ищем —
  // слишком много ложных срабатываний на строках вида "vercel.json".
  // Зона строго по списку. Первая версия брала любое слово после точки и
  // выдала 17 «мёртвых доменов», из которых настоящих было два: остальное —
  // обращения к свойствам в коде (aevion.payments, aevion.modules, aevion.build).
  // Сторож, кричащий на код, читаться перестаёт.
  for (const m of s.matchAll(/(?<![/\w.-])aevion\.(app|io|kz|tech|bank|com|net|org|dev|ai|co|cloud)\b/gi)) {
    const h = m[0].toLowerCase();
    if (NAMESPACE_HOSTS.has(h)) continue;
    if (!hosts.has(h)) hosts.set(h, new Set());
    hosts.get(h).add(path.relative(ROOT, f).replace(/\\/g, "/"));
  }
}

console.log("уникальных внешних доменов:", hosts.size, "\n");
const dead = [];
const unknown = [];
for (const [h, files] of [...hosts].sort()) {
  try {
    await dns.resolve4(h);
  } catch (e) {
    const code = e && e.code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      // CNAME/AAAA тоже считаются живыми: домен может не иметь A-записи
      // и при этом прекрасно работать. Иначе свип наврёт в сторону «мёртвый».
      try { await dns.resolveCname(h); continue; } catch {}
      try { await dns.resolve6(h); continue; } catch {}
      dead.push([h, [...files]]);
    } else {
      unknown.push([h, code]);
    }
  }
}

if (dead.length) {
  console.log("НЕ СУЩЕСТВУЮТ В DNS:", dead.length);
  for (const [h, f] of dead) {
    console.log("   " + h + "  <- " + f.slice(0, 3).join(", ") + (f.length > 3 ? ` (+${f.length - 3})` : ""));
  }
} else {
  console.log("несуществующих доменов не найдено");
}
if (unknown.length) {
  console.log("\nне смог проверить (сбой DNS, НЕ вывод о домене):", unknown.length);
  for (const [h, c] of unknown.slice(0, 8)) console.log("   " + h + " — " + c);
}
process.exitCode = dead.length ? 1 : 0;
