#!/usr/bin/env node
// Храповик на мёртвый ключ входа.
//   node scripts/auth-token-key-ratchet.test.mjs
//
// Страница входа (frontend/src/app/auth/page.tsx) кладёт JWT под ключом
// "aevion_auth_token_v1". Ключи из списка DEAD_KEYS ниже во всём коде
// фронтенда НЕ ЗАПИСЫВАЕТ НИКТО. Страница, читающая только их, не видит
// сессию вошедшего человека: показывает «войдите» или шлёт запрос без Bearer
// и получает 401. Отказа при этом нет — продукт просто ведёт себя так, будто
// вы не входили, и потому это годами не всплывало.
//
// Тест держит планку: новых быть не должно, а когда зона свою часть чинит —
// число здесь уменьшают. Назад храповик не отпускает.
//
// Что делать, если тест упал:
//   • пишете НОВЫЙ код — берите getAuthToken()/getAuthHeaders() из
//     @/lib/auth. Литерал ключа в странице и есть причина, по которой один
//     переезд разъехался на 55 файлов;
//   • ПОЧИНИЛИ свою зону — уменьшите BASELINE;
//   • файл читает оба ключа (есть запасной вариант) — он не считается,
//     проверка смотрит только на тех, у кого канонического ключа нет вовсе.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SRC = path.join(HERE, "..", "frontend", "src");

/**
 * Сколько файлов ещё читают мёртвый ключ БЕЗ запасного варианта.
 * Только вниз.
 *
 * 10.08.2026 планка была 42 — но замерена в worktree, где 13 починок уже
 * лежали в несмёрженной ветке. На самом main их не было, и настоящее число
 * оказалось 55. 12.08.2026 зачищены все: 158 вызовов в 68 файлах переведены
 * на getAuthToken() из @/lib/auth.
 */
const BASELINE = 0;

// Мёртвые ключи — те, что читают, но не записывает НИКТО (проверено grep-ом
// по setItem). Их три, а не один: "aevion_token" нашёлся первым, но точно так
// же висят "aevion_jwt" (из-за него не видит сессию /qmedia) и
// "qcoreai_token" (две страницы QCoreAI). Один ключ в списке — значит
// следующий такой же дефект проверка пропустит.
//
// "aevion_auth_token" (без _v1) сюда НЕ входит: его никто не пишет, но
// migrateAuthToken() читает его намеренно, чтобы перенести старые сессии на
// канонический ключ. Это не дефект, а миграция.
const DEAD_KEYS = ["aevion_token", "aevion_jwt", "qcoreai_token"];

// Кавычки обеих форм. Сейчас ключи входа пишут только в двойных, но проверка,
// не знающая про одинарные, молча пропустит первый же такой вызов — а она
// поставлена ровно против класса «незаметно мимо».
const mentions = (text, key) => new RegExp(`["']${key}["']`).test(text);
const CANONICAL = /aevion_auth_token_v1|getAuthToken|getAuthHeaders/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const broken = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  if (DEAD_KEYS.some((k) => mentions(text, k)) && !CANONICAL.test(text)) {
    broken.push(path.relative(SRC, file).split(path.sep).join("/"));
  }
}

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

console.log(`страниц читают мёртвый ключ без запасного варианта: ${broken.length} (планка ${BASELINE})`);

ok(
  "новых страниц с мёртвым ключом не появилось",
  broken.length <= BASELINE,
  `стало ${broken.length} против ${BASELINE}. Берите getAuthToken() из @/lib/auth — ` +
    `литерал ключа не видит сессию вошедшего.`,
);

ok(
  "планка соответствует факту",
  broken.length === BASELINE,
  broken.length < BASELINE
    ? `осталось ${broken.length} вместо ${BASELINE} — похоже, зону починили. Уменьшите BASELINE, чтобы храповик затянулся.`
    : "",
);

// Планка дошла до нуля — значит, можно требовать большего, чем «нет чтения
// без запасного варианта». Мёртвого ключа во фронтенде теперь не должно быть
// вообще, даже рядом с каноническим: ровно так и выглядели /z-tide и
// /qmaskcard — читали три ключа подряд, мёртвый ПЕРВЫМ, и он побеждал у всех,
// у кого в браузере остался старый мусор под этим именем. Запасной вариант
// прячет дефект, а не лечит его.
const mentioners = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  if (DEAD_KEYS.some((k) => mentions(text, k))) {
    mentioners.push(path.relative(SRC, file).split(path.sep).join("/"));
  }
}
ok(
  "литерала мёртвого ключа во фронтенде нет вовсе",
  mentioners.length === 0,
  `упоминают: ${mentioners.slice(0, 5).join(", ")}${mentioners.length > 5 ? ` … и ещё ${mentioners.length - 5}` : ""}. ` +
    `Читать токен только через getAuthToken()/getAuthHeaders() из @/lib/auth.`,
);

// Само утверждение, на котором держится проверка: канонический ключ пишется,
// мёртвый — нет. Если это перестанет быть правдой, тест обязан сказать об этом
// первым, иначе он будет годами охранять неверную посылку.
const all = walk(SRC).map((f) => readFileSync(f, "utf8")).join("\n");
ok("канонический ключ действительно записывается", /setItem\(\s*(AUTH_TOKEN_KEY|"aevion_auth_token_v1")/.test(all));
for (const key of DEAD_KEYS) {
  ok(`ключ ${key} по-прежнему никто не записывает`, !new RegExp(`setItem\\(\\s*["']${key}["']`).test(all));
}

if (broken.length) {
  console.log("\nостаются (первые 10):");
  for (const f of broken.slice(0, 10)) console.log(`  ${f}`);
  if (broken.length > 10) console.log(`  … и ещё ${broken.length - 10}`);
}

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
