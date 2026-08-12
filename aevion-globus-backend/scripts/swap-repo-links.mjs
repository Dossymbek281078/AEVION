#!/usr/bin/env node
/**
 * Перевод ссылок на репозиторий с мёртвого GitHub на GitLab.
 *
 * ЗАЧЕМ. Аккаунт GitHub отключён 27.07.2026, и
 * https://github.com/Dossymbek281078/AEVION отдаёт 404. Ссылка стоит на 21
 * странице сайта, среди них /investor, /developers, /sdk, /api-explorer —
 * то есть ровно там, где посетителю предлагают «посмотрите сами».
 *
 * ПОЧЕМУ НЕ ПРОСТО ЗАМЕНА. Перевести адреса мало: если целевой проект закрыт
 * или пуст, мы меняем 404 на форму входа, а это для инвестора читается как
 * «показать нечего». Поэтому скрипт ОТКАЗЫВАЕТСЯ применять правку, пока
 * целевой проект не отвечает публично и неавторизованному. Проверка не
 * косметическая: 12.08.2026 проект был приватным (страница — редирект на вход,
 * API — 404) и с нулём веток, и замена в тот день сделала бы хуже.
 *
 * Usage:
 *   node scripts/swap-repo-links.mjs                 # показать, что изменится
 *   node scripts/swap-repo-links.mjs --apply         # применить (с проверкой доступности)
 *   node scripts/swap-repo-links.mjs --apply --force # применить, зная, что репозиторий закрыт
 *
 * Env:
 *   TARGET  адрес проекта, по умолчанию https://gitlab.com/yahiin1978/aevion-core
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..", "frontend", "src");
// Адрес встречается ДВУМЯ способами, и это выяснилось прогоном, а не чтением:
// в href — со схемой, а в видимом тексте ссылки, в подвалах и в переводах
// (src/lib/i18n-data.ts) — голым доменом, без https://. Первая версия скрипта
// знала только форму со схемой и получила худший из исходов: href уезжал на
// GitLab, а подпись рядом продолжала говорить github.com. Страница показывала
// один адрес и вела на другой — дефект, которого до правки не было.
const OLD_BARE = "github.com/Dossymbek281078/AEVION";
const OLD = "https://" + OLD_BARE;
const TARGET = (process.env.TARGET || "https://gitlab.com/yahiin1978/aevion-core").replace(/\/+$/, "");
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

// GitHub и GitLab расходятся не только доменом: у GitLab служебные разделы
// живут под /-/. Прямая замена домена дала бы битые адреса на каждой глубокой
// ссылке — а их больше половины.
const RULES = [
  [/\/tree\//, "/-/tree/"],
  [/\/blob\//, "/-/blob/"],
  [/\/commits\//, "/-/commits/"],
  [/\/issues/, "/-/issues"],
];

/** Куда ведёт конкретная ссылка после перевода. null = ручное решение. */
function translate(url) {
  // Форма без схемы должна и остаться без схемы: это подпись под ссылкой и
  // строки переводов, где «https://» смотрелось бы чужеродно.
  const bare = !url.startsWith("https://");
  const base = bare ? TARGET.replace(/^https:\/\//, "") : TARGET;
  const tail = url.slice((bare ? OLD_BARE : OLD).length);
  if (tail === "" || tail === "/") return base;
  // У GitHub Actions нет прямого соответствия: пайплайны GitLab устроены иначе,
  // и подставлять /-/pipelines вместо ссылки на конкретный workflow — значит
  // обещать не то. Такие адреса выносим человеку, а не угадываем.
  if (tail.startsWith("/actions")) return null;
  for (const [re, to] of RULES) {
    if (re.test(tail)) return base + tail.replace(re, to);
  }
  return null;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mdx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Отвечает ли целевой проект ПУБЛИЧНО — без токена, как случайный посетитель. */
async function targetIsPublic() {
  const m = TARGET.match(/gitlab\.com\/(.+)$/);
  if (!m) return { ok: false, why: "не узнал адрес GitLab" };
  try {
    const api = `https://gitlab.com/api/v4/projects/${encodeURIComponent(m[1])}`;
    const r = await fetch(api, { redirect: "manual" });
    if (r.status === 404) return { ok: false, why: "проект закрыт или не существует (API отдаёт 404 неавторизованному)" };
    if (!r.ok) return { ok: false, why: `API ответил ${r.status}` };
    const d = await r.json();
    // Публичный, но пустой — тоже негодная цель: ссылка приведёт в никуда.
    if (d.empty_repo) return { ok: false, why: "проект публичный, но ПУСТОЙ — веток нет" };
    return { ok: true, why: `публичный, ветка по умолчанию ${d.default_branch || "?"}` };
  } catch (e) {
    return { ok: false, why: `не смог спросить: ${e instanceof Error ? e.message : e}` };
  }
}

async function main() {
const files = walk(ROOT);
const hits = [];
const manual = [];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Со схемой ищем ПЕРВЫМ: иначе голый шаблон откусит хвост у полного адреса и
// оставит осиротевшее «https://» перед новым адресом.
const FORMS = [OLD, OLD_BARE];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!src.includes(OLD_BARE)) continue;
  const lines = src.split("\n");
  lines.forEach((l, i) => {
    const seen = [];
    for (const form of FORMS) {
      for (const m of l.matchAll(new RegExp(esc(form) + "[^\"'`\\s)<]*", "g"))) {
        // Голая форма совпадает и внутри полной — считаем такое вхождение один раз.
        if (seen.some((s) => m.index >= s.start && m.index < s.end)) continue;
        seen.push({ start: m.index, end: m.index + m[0].length });
        const to = translate(m[0]);
        const rel = path.relative(ROOT, f).replace(/\\/g, "/");
        if (to) hits.push({ file: f, rel, li: i, start: m.index, len: m[0].length, from: m[0], to });
        else manual.push({ rel, line: i + 1, from: m[0] });
      }
    }
  });
}

console.log(`Цель: ${TARGET}`);
const pub = await targetIsPublic();
console.log(`Доступность цели: ${pub.ok ? "ГОДНА" : "НЕГОДНА"} — ${pub.why}\n`);

console.log(`Переводится автоматически: ${hits.length}`);
for (const h of hits) console.log(`   ${h.rel}:${h.line}  ${h.from}\n      → ${h.to}`);
if (manual.length) {
  console.log(`\nТребует решения человека: ${manual.length}`);
  // Молчаливый пропуск здесь был бы худшим исходом: «перевёл 27 из 29» звучит
  // как успех, пока не откроешь страницу с оставшейся мёртвой ссылкой.
  for (const m of manual) console.log(`   ${m.rel}:${m.line}  ${m.from}`);
}

if (!APPLY) {
  console.log("\nПоказ без правки. Чтобы применить: --apply");
  return 0;
}
if (!pub.ok && !FORCE) {
  console.error(`\nНЕ ПРИМЕНЯЮ: ${pub.why}.`);
  console.error("Замена мёртвой ссылки на форму входа делает хуже, а не лучше.");
  console.error("Сначала сделать проект публичным и убедиться, что в нём есть ветки.");
  return 1;
}

const byFile = new Map();
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) || []).concat(h));
for (const [f, list] of byFile) {
  // Заменяем ПО ПОЗИЦИИ найденного вхождения, а не по всему тексту файла.
  // Замена строкой (split/join) разрушала соседей: подстановка короткого
  // корневого адреса задевала начало длинной ссылки на GitHub Actions, и та
  // молча превращалась в gitlab.com/.../actions/workflows/... — адрес GitLab с
  // путём GitHub, гарантированный 404. Причём скрипт в тот же момент печатал,
  // что оставляет её человеку: отчёт говорил одно, правка делала другое.
  const lines = fs.readFileSync(f, "utf8").split("\n");
  const byLine = new Map();
  for (const h of list) byLine.set(h.li, (byLine.get(h.li) || []).concat(h));
  for (const [li, hs] of byLine) {
    let line = lines[li];
    // Справа налево: иначе смещение сдвинет позиции последующих вхождений.
    for (const h of [...hs].sort((a, b) => b.start - a.start)) {
      line = line.slice(0, h.start) + h.to + line.slice(h.start + h.len);
    }
    lines[li] = line;
  }
  fs.writeFileSync(f, lines.join("\n"), "utf8");
}
console.log(`\nПравка применена: файлов ${byFile.size}, ссылок ${hits.length}.`);
if (manual.length) console.log(`Осталось вручную: ${manual.length} — см. список выше.`);
return 0;
}

// process.exit() обрывал процесс на живом сокете после fetch: Node на Windows
// падал с assertion в libuv и отдавал 127 ВМЕСТО задуманных 0 и 1 — то есть
// отличить «показал» от «отказался применять» было нельзя. Выходим значением.
process.exitCode = await main();
