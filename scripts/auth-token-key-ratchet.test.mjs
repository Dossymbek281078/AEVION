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
// по setItem). Один ключ в списке означал бы, что следующий такой же дефект
// проверка пропустит, — и ровно это и случилось: список из трёх имён был
// закрыт, а сплошной аудит хранилища 12.08.2026 нашёл ВТОРОЕ семейство из
// пяти. Мораль в список и вписана: сюда идёт всё, что читают и не пишут.
//
//   aevion_token, aevion_jwt, qcoreai_token — найдены 10.08;
//   aevion_auth_token   — legacy без _v1: /coach, /qlearn, /qstore и SDK
//                         читали его напрямую, хотя migrateAuthToken() старое
//                         значение переносит и СТИРАЕТ, то есть у вошедшего
//                         человека он пуст всегда;
//   aevion:auth:token   — своё имя выдумал HealthAI;
//   build_token,
//   build_auth_token    — своё имя выдумал QBuild, дважды и по-разному.
const DEAD_KEYS = [
  "aevion_token",
  "aevion_jwt",
  "qcoreai_token",
  "aevion_auth_token",
  "aevion:auth:token",
  "build_token",
  "build_auth_token",
];

// Единственное законное упоминание legacy-ключа: сама миграция в lib/auth.ts
// переносит старые сессии на канонический ключ и обязана назвать источник.
// Список именно из пар «файл + ключ», а не из имён файлов: иначе исключение
// молча разрешило бы в этом файле любой другой мёртвый ключ.
const ALLOWED = [
  { file: "lib/auth.ts", key: "aevion_auth_token" },
  // Добавлено 27.08.2026. `TOKEN_ALIASES = ["aevion_token", "aevion_jwt"]` живёт
  // в том же каноническом файле, и живёт ЗАКОННО: clearAuthToken обязан стирать
  // псевдонимы у тех, кто входил в окно зеркалирования, — иначе выход оставляет
  // в браузере ключи, под которыми модули читают токен.
  //
  // Почему покраснело только сейчас, хотя строка в auth.ts с 10-11.08: до launch
  // она доехала мержем `bbfebc835` (fix/pitch-one-denominator). Прогон ДО этого
  // мержа на той же строке 254 давал ok, ПОСЛЕ — FAIL. То есть файл не протух за
  // две недели, а пришёл целиком вместе с рефакторингом.
  //
  // Это ослабление на ДВА имени в ОДНОМ файле, а не на файл целиком: пара
  // «файл + ключ» выбрана здесь именно затем, чтобы исключение не разрешало
  // соседние ключи. Запрет на все остальные страницы остаётся в силе.
  { file: "lib/auth.ts", key: "aevion_token" },
  { file: "lib/auth.ts", key: "aevion_jwt" },
];
const isAllowed = (rel, key) => ALLOWED.some((a) => a.file === rel && a.key === key);

// Кавычки обеих форм. Сейчас ключи входа пишут только в двойных, но проверка,
// не знающая про одинарные, молча пропустит первый же такой вызов — а она
// поставлена ровно против класса «незаметно мимо».
const mentions = (text, key) => new RegExp(`["']${key}["']`).test(text);
const CANONICAL = /aevion_auth_token_v1|getAuthToken|getAuthHeaders/;

// Тесты пропускаем намеренно. Проверка охраняет СТРАНИЦЫ, а тест, который
// доказывает, что мёртвый ключ никого не пускает, обязан назвать его вслух и
// даже записать. Без этого исключения проверка запрещала бы ровно то
// доказательство, ради которого заведена, — и первым же её нарушителем стал
// собственный тест ZTideRankPill.auth.test.tsx.
const isTest = (name) => /\.test\.(ts|tsx)$/.test(name);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !isTest(entry)) out.push(full);
  }
  return out;
}

const rel = (file) => path.relative(SRC, file).split(path.sep).join("/");

/**
 * Комментарии выбрасываем перед поиском. Иначе проверка ловит объяснение
 * дефекта вместо дефекта: первыми её нарушителями стали /coach, /healthai и
 * SDK — файлы, ПОЧИНЕННЫЕ в этом же заходе, где мёртвый ключ назван в
 * комментарии «раньше здесь стояло вот это». Запрещать называть имя ошибки —
 * верный способ получить код без объяснений.
 *
 * Режем только блочные комментарии и строки, начинающиеся с // или * —
 * хвостовой // после кода не трогаем, чтобы не съесть «https://» в строке.
 */
const stripComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

const deadKeysIn = (text, file) => {
  const code = stripComments(text);
  return DEAD_KEYS.filter((k) => mentions(code, k) && !isAllowed(rel(file), k));
};

const broken = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  if (deadKeysIn(text, file).length > 0 && !CANONICAL.test(text)) {
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
  const found = deadKeysIn(text, file);
  if (found.length) mentioners.push(`${rel(file)} (${found.join(", ")})`);
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
