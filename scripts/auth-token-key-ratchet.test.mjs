#!/usr/bin/env node
// Храповик на мёртвый ключ входа.
//   node scripts/auth-token-key-ratchet.test.mjs
//
// Страница входа (frontend/src/app/auth/page.tsx) кладёт JWT под ключом
// "aevion_auth_token_v1". Ключ "aevion_token" во всём коде фронтенда НЕ
// ЗАПИСЫВАЕТ НИКТО. Страница, читающая его без запасного варианта, не видит
// сессию вошедшего человека: показывает «войдите» или шлёт запрос без Bearer
// и получает 401. Отказа при этом нет — продукт просто ведёт себя так, будто
// вы не входили, и потому это годами не всплывало.
//
// 10.08.2026 таких файлов было 55. Тест держит планку: новых быть не должно,
// а когда зона свою часть чинит — число здесь уменьшают. Назад храповик не
// отпускает.
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
 * Только вниз. Срез 10.08.2026: было 55, закрыто 14 (свободные зоны +
 * multichat), осталось 41 — qpaynet 21, qcoreai 19, qright 1.
 */
const BASELINE = 41;

const DEAD_KEY = '"aevion_token"';
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
  if (text.includes(DEAD_KEY) && !CANONICAL.test(text)) {
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

// Само утверждение, на котором держится проверка: канонический ключ пишется,
// мёртвый — нет. Если это перестанет быть правдой, тест обязан сказать об этом
// первым, иначе он будет годами охранять неверную посылку.
const all = walk(SRC).map((f) => readFileSync(f, "utf8")).join("\n");
ok("канонический ключ действительно записывается", /setItem\(\s*(AUTH_TOKEN_KEY|"aevion_auth_token_v1")/.test(all));
ok("мёртвый ключ по-прежнему никто не записывает", !/setItem\(\s*"aevion_token"/.test(all));

if (broken.length) {
  console.log("\nостаются (первые 10):");
  for (const f of broken.slice(0, 10)) console.log(`  ${f}`);
  if (broken.length > 10) console.log(`  … и ещё ${broken.length - 10}`);
}

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
