#!/usr/bin/env node
/**
 * Проверка перед заливкой накопленного на ПУБЛИЧНЫЙ GitHub.
 *
 * ПОВОД. Репозиторий Dossymbek281078/AEVION открыт всем. Три недели работа
 * уезжала только в локальное зеркало, где на неё никто не смотрел глазами
 * именно с этим вопросом. Публикация необратима: утёкший ключ считается
 * скомпрометированным с момента появления в открытом репозитории, даже если
 * коммит потом удалить.
 *
 * ПОЧЕМУ git grep, а не обход файлов. Первая версия читала каждый файл каждой
 * ветки отдельным `git show` — 2 минуты на ОДНУ ветку, то есть полтора часа на
 * полсотни. `git grep` ищет по всему дереву разом за 0.3 секунды. Проверка,
 * которую долго ждать, не запускается перед каждой заливкой, а значит не
 * работает вовсе.
 *
 * ЧЕГО НЕ ДЕЛАЕТ. Не заменяет gitleaks: смотрит деревья веток, а не историю
 * коммитов, и не знает энтропийных эвристик. Ловит типовые ключи известных
 * сервисов — тот класс, который и утекает чаще всего.
 *
 * Запуск:
 *   node scripts/secret-leak-scan.mjs                 # активные ветки за 7 дней
 *   node scripts/secret-leak-scan.mjs --all           # все локальные ветки
 *   node scripts/secret-leak-scan.mjs --branch main
 *   node scripts/secret-leak-scan.mjs --self-test
 *
 * Коды: 0 — чисто; 1 — найдено; 2 — просканировать не удалось.
 */

import { execFileSync } from "node:child_process";

// Шаблоны намеренно БЕЗ обратных слэшей и без ведущих дефисов в аргументе.
// Проверено на живом запуске: git grep принял «-----BEGIN…» за опцию командной
// строки, а экранирование вида [^\s:@] по дороге теряло слэш и превращалось в
// [^s:@]. Оба шаблона молча не работали — то есть сканер пропускал ровно самое
// опасное: приватные ключи и пароли в строках подключения. Поэтому шаблон
// всегда передаётся через -e, а классы символов пишутся явными символами.
//
// Пароль в строке БД описан ПЕРЕЧИСЛЕНИЕМ допустимых символов, а не через
// отрицание: «всё, кроме пробела и собаки» ловило и плейсхолдер <password> из
// документации. Сканер, который краснеет на примерах, перестают запускать.
const PATTERNS = [
  { name: "Brevo API key",      re: "xkeysib-[a-f0-9]{40,}" },
  { name: "OpenAI key",         re: "(^|[^A-Za-z0-9])sk-[A-Za-z0-9]{32,}" },
  { name: "Anthropic key",      re: "(^|[^A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}" },
  { name: "GitHub token",       re: "gh[pousr]_[A-Za-z0-9]{30,}" },
  { name: "AWS access key",     re: "AKIA[0-9A-Z]{16}" },
  { name: "Google API key",     re: "AIza[0-9A-Za-z_-]{35}" },
  { name: "Stripe live key",    re: "[sr]k_live_[A-Za-z0-9]{20,}" },
  { name: "Приватный ключ",     re: "BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY" },
  { name: "Пароль в строке БД", re: "(postgres|postgresql|mysql|mongodb)[a-z+]*://[A-Za-z0-9_.-]+:[A-Za-z0-9_.!%*+~-]{6,}@" },
  // Все шаблоны выше опознают ключ по ФОРМАТУ провайдера (xkeysib-, sk-, AKIA…).
  // У наших собственных секретов формата нет: это случайная строка без
  // префикса, и сканер её не видел. 19.08.2026 он ответил «ключей в рабочих
  // файлах не найдено», пока в all-smokes.js лежал живой
  // BUILD_PAYMENT_WEBHOOK_SECRET на 48 символов — а им подписывается вебхук,
  // помечающий заказ оплаченным.
  //
  // Опознаём по СОСЕДСТВУ: имя, кончающееся на SECRET/TOKEN/KEY/PASSWORD, и
  // тут же длинный литерал. Длина от 24 отсекает «changeme», "test", "***".
  // Ищем по СОСЕДСТВУ, а не по структуре присваивания: настоящий случай
  // выглядел как `SECRET: process.env.SECRET || "4wSq…"`, то есть между именем
  // и литералом стоит запасной путь. Шаблон «имя = литерал» его не поймал —
  // проверено на нём же, прежде чем поверить.
  { name: "Свой секрет в коде", re: "(SECRET|TOKEN|PASSWORD|API_?KEY|PASSWD).*[\"'][A-Za-z0-9+/=_-]{24,}[\"']", placeholders: true },
];

// Совпадение здесь почти всегда пример, а не ключ. Не пропускаем молча:
// считаем отдельно и печатаем числом, иначе «чисто» станет неправдой.
const EXAMPLE_HINTS = /(\.md$|\.test\.|__tests__|\.example|\.sample|fixtures?\/)/i;

// Заглушка называет себя сама, настоящий секрет — случайная строка. Отсев по
// самоописанию, а не по длине: из четырёх совпадений шаблона «свой секрет»
// настоящим оказалось одно, три были `dev-only-key`, `change-in-prod` и
// `0123456789abcdef…`. Без этого отсева сканер тонет в собственном шуме и его
// перестают читать.
const PLACEHOLDER_HINTS = /(dev-only|change-?in-?prod|changeme|placeholder|example|sample|dummy|your-|test-key|fake|0123456789|abcdef0123|fedcba98|76543210|deadbeef|xxxx|\.\.\.)/i;

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

function selfTest() {
  // Сканер обязан краснеть на заведомом ключе и молчать на заглушке. Проверяем
  // не регулярку в отрыве, а весь путь: создаём временную ветку с ключом.
  const marker = "xkeysib-" + "a".repeat(48);
  let ok = false, quiet = false;
  try {
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { input: `const k='${marker}';\n`, encoding: "utf8" }).trim();
    const tree = execFileSync("git", ["mktree"], { input: `100644 blob ${blob}\tleak.js\n`, encoding: "utf8" }).trim();
    const commit = execFileSync("git", ["commit-tree", tree, "-m", "self-test"], { encoding: "utf8" }).trim();
    const hits = grepRef(commit);
    ok = hits.some((h) => h.kind === "Brevo API key");
    // и на заглушке молчит
    const blob2 = execFileSync("git", ["hash-object", "-w", "--stdin"], { input: "SMTP=<xkeysib-... из окружения>\n", encoding: "utf8" }).trim();
    const tree2 = execFileSync("git", ["mktree"], { input: `100644 blob ${blob2}\tconf.txt\n`, encoding: "utf8" }).trim();
    const commit2 = execFileSync("git", ["commit-tree", tree2, "-m", "self-test-2"], { encoding: "utf8" }).trim();
    quiet = grepRef(commit2).length === 0;
  } catch (e) {
    console.error("самопроверка не выполнилась:", e.message);
    process.exit(2);
  }
  console.log("самопроверка (на настоящем дереве git, не на строке в памяти):");
  console.log(`  настоящий ключ найден : ${ok ? "да" : "НЕТ — сканер слеп"}`);
  console.log(`  заглушка не найдена   : ${quiet ? "да" : "НЕТ — будет ложная тревога"}`);
  process.exit(ok && quiet ? 0 : 1);
}

function grepRef(ref) {
  const out = [];
  for (const p of PATTERNS) {
    let res = "";
    try {
      res = git(["grep", "-I", "-n", "-E", "-e", p.re, ref]);
    } catch {
      continue; // git grep возвращает 1, когда совпадений нет
    }
    for (const line of res.split("\n").filter(Boolean)) {
      const rest = line.slice(ref.length + 1);
      const file = rest.slice(0, rest.indexOf(":"));
      const text = rest.slice(0, 300);
      if (p.placeholders && PLACEHOLDER_HINTS.test(text)) continue;
      out.push({ ref, file, kind: p.name, line: rest.slice(0, 120) });
    }
  }
  return out;
}

if (process.argv.includes("--self-test")) selfTest();

const iBranch = process.argv.indexOf("--branch");
let branches;
try {
  if (iBranch !== -1) branches = [process.argv[iBranch + 1]];
  else {
    const rows = git(["for-each-ref", "--format=%(refname:short)|%(committerdate:short)", "refs/heads"])
      .split("\n").filter(Boolean).map((l) => l.split("|"));
    branches = process.argv.includes("--all")
      ? rows.map(([b]) => b)
      : rows.filter(([, d]) => d >= new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)).map(([b]) => b);
  }
} catch (e) {
  console.error("ОСТАНОВКА: не смог перечислить ветки —", e.message);
  process.exit(2);
}

if (!branches.length) {
  console.error("ОСТАНОВКА: ни одной ветки для проверки — это не «чисто»");
  process.exit(2);
}

const findings = [];
let examples = 0;
// Строка подключения к локальной базе — не секрет. В daily-smoke.yml стоит
// postgres://postgres:postgres@127.0.0.1 для одноразового контейнера в CI:
// «пароль» там равен имени пользователя и снаружи не значит ничего. Держать
// это в находках значит приучить читателя пролистывать список.
const LOCAL_DB = /(127\.0\.0\.1|localhost|\bdb:|@postgres[:/])/;

for (const b of branches) {
  for (const hit of grepRef(b)) {
    if (EXAMPLE_HINTS.test(hit.file)) { examples++; continue; }
    if (hit.kind === "Пароль в строке БД" && LOCAL_DB.test(hit.line)) { examples++; continue; }
    findings.push(hit);
  }
}

console.log(`Проверено веток: ${branches.length}`);
console.log(`Совпадений в документации, примерах и тестах (не утечка): ${examples}`);
if (!findings.length) {
  console.log("\nКлючей в рабочих файлах не найдено.");
  console.log("Это не гарантия по всей истории: проверялись деревья веток, а не коммиты.");
  process.exit(0);
}
console.log(`\nНАЙДЕНО ${findings.length}:`);
for (const f of findings) console.log(`  ${f.ref} · ${f.file} · ${f.kind}`);
console.log("\nНе заливать, пока ключ не убран И не отозван у поставщика:");
console.log("публикация делает его скомпрометированным навсегда, даже после удаления коммита.");
process.exit(1);
