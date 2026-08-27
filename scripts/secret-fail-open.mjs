#!/usr/bin/env node
// Секреты, при отсутствии которых проверка МОЛЧА ВЫКЛЮЧАЕТСЯ.
//   node scripts/secret-fail-open.mjs
//
// Класс дефекта: `const s = process.env.SECRET; if (!s) return true;`
// Ключ не задан — проверка пропущена, запрос принят. Отказа нет, в логе тихо,
// и на боевой среде это выглядит как нормальная работа. Нашлось 12.08.2026 при
// разборе платёжного вебхука Gumroad, который при пустом секрете не проверял
// подпись пинга.
//
// Срез 12.08.2026: 117 мест «секрет + ветка если не задан», из них
// открывается ОДНО — routes/metrics.ts (Prometheus). Там это осознанный
// выбор, описанный в комментарии рядом: наружу идут только глобальные
// счётчики без разбивки по пользователям. Замер прода в тот же день: ручка
// отвечает 200 без токена, все счётчики в нулях. Перед реальным трафиком
// METRICS_TOKEN стоит задать.
//
// Результат «одно из 117» — сам по себе полезный: код почти везде
// закрывается правильно (throw, 4xx/5xx, return false).
//
// ⚠️ ГРАНИЦЫ ПРОВЕРКИ, чтобы не принять её за доказательство:
//   • смотрит окно в 7 строк после чтения переменной — форма, разнесённая
//     дальше, не видна;
//   • судит по словам (`return true`, `next()` против `throw`, `status(4`) —
//     разрешение, выраженное иначе, будет пропущено;
//   • у Gumroad, с которого всё началось, вторая линия защиты лежит в ДРУГОМ
//     файле на 70 строк ниже. Такое сопоставление скрипт не делает вовсе.
//   Поэтому это подсказка, куда смотреть, а не список уязвимостей. Каждое
//   попадание дочитывать руками до конца обработчика.

// Ищем форму «секрета нет — проверку пропускаем».
// Печатаем ветку, срабатывающую при незаданном секрете, чтобы решить глазами:
// закрывается (403/503/throw/return false) или открывается (return true/next).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Корень — от самого скрипта. 27.08.2026 здесь стоял чужой worktree
// ("C:/Users/user/aevion-money/..."), то есть проверка «секрет не задан —
// ручка открывается или закрывается» отвечала про ЧУЖОЙ код. Для проверки,
// связанной с секретами, это худший вид тихой ошибки.
const ROOT = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "aevion-globus-backend/src",
);
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    if (e === "node_modules") continue;
    const f = path.join(d, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.ts$/.test(e)) out.push(f);
  }
  return out;
}

const SECRETISH = /(SECRET|TOKEN|_KEY|ALLOWLIST|ADMIN|SIGN_SK|PASSWORD)/;
const hits = [];
for (const f of walk(ROOT)) {
  const lines = readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/process\.env\.([A-Z][A-Z0-9_]*)/);
    if (!m || !SECRETISH.test(m[1])) continue;
    // Ветка «не задан» ищется в ближайших 6 строках.
    const win = lines.slice(i, i + 7).join("\n");
    if (!/if\s*\(\s*!/.test(win)) continue;
    hits.push({
      file: path.relative(ROOT, f).split(path.sep).join("/"),
      line: i + 1,
      v: m[1],
      snippet: lines.slice(i, i + 7).map((l) => l.trim()).filter(Boolean).slice(0, 5).join(" | "),
    });
  }
}

// Открывается, если в окне есть «return true» / «next()» / «return payload»
const OPEN = /return\s+true|next\(\)|return\s+payload|=\s*true\b/;
const CLOSED = /throw|status\(4|status\(5|return\s+false|return\s+null/;

const suspicious = hits.filter((h) => OPEN.test(h.snippet) && !CLOSED.test(h.snippet));
console.log(`мест «секрет + ветка если не задан»: ${hits.length}`);
console.log(`из них похожи на ОТКРЫВАЮЩИЕСЯ: ${suspicious.length}\n`);
for (const h of suspicious) console.log(`  ${h.file}:${h.line}  ${h.v}\n     ${h.snippet}\n`);
