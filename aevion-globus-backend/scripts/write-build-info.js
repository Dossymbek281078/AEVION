#!/usr/bin/env node
/**
 * Пишет dist/build-info.json во время сборки, чтобы /health мог назвать
 * развёрнутый коммит.
 *
 * Зачем. Проверено на живом проде 13.08.2026: `GET https://api.aevion.app/health`
 * отдаёт `"commit":"unknown"`. Значит после деплоя нельзя ответить на самый
 * нужный вопрос — какой код сейчас работает, — и любой деплой становится
 * действием вслепую: не проверить ни что развернулось, ни что было до.
 *
 * Почему одних переменных окружения не хватило. Рантайм читал только
 * RAILWAY_GIT_COMMIT_SHA / GIT_SHA / SOURCE_VERSION. Первую Railway подставляет
 * при сборке из подключённого репозитория, а репозиторий недоступен с 27.07
 * (аккаунт GitHub заблокирован), поэтому переменной нет — и маркер молча стал
 * «unknown» вместо того, чтобы найти коммит другим способом.
 *
 * Порядок источников здесь тот же, что в рантайме, плюс `git rev-parse` как
 * последняя попытка: при сборке из рабочего дерева .git на месте, и этого
 * достаточно. Если не удалось ничего — пишем "unknown" ЯВНО, вместе с причиной:
 * «маркер не собрался» и «маркер не показывается» — разные неисправности, и
 * различать их надо до деплоя, а не после.
 */

const { execFileSync } = require("node:child_process");
const { writeFileSync, readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

function fromGit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function branchFromGit() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const env = process.env;
const commit =
  env.RAILWAY_GIT_COMMIT_SHA || env.GIT_SHA || env.SOURCE_VERSION || fromGit() || "";

const info = {
  commit: commit ? commit.slice(0, 12) : "unknown",
  // Откуда взято — чтобы «unknown» на проде читался однозначно: маркер не
  // собрался или собрался и не доехал.
  source: env.RAILWAY_GIT_COMMIT_SHA
    ? "RAILWAY_GIT_COMMIT_SHA"
    : env.GIT_SHA
      ? "GIT_SHA"
      : env.SOURCE_VERSION
        ? "SOURCE_VERSION"
        : commit
          ? "git rev-parse"
          : "none",
  branch: env.RAILWAY_GIT_BRANCH || branchFromGit() || "unknown",
  builtAt: new Date().toISOString(),
};

// Рядом с кодом, НЕ в dist: `railway up` исключает игнорируемое, и отметка из
// dist в образ не уезжает — это уже проверено на реальной выкатке (6a30a9bd8 в
// ветке deploy/combined). Скрипт выкатки scripts/railway-deploy.sh пишет этот
// же файл сам и убирает за собой; здесь он появляется при обычной сборке.
const out = join(__dirname, "..");
const target = join(out, "build-info.json");

// НЕ затирать готовую отметку. Тот же файл кладёт scripts/railway-deploy.sh
// перед загрузкой — там ещё есть .git и настоящий коммит. Здесь, внутри образа,
// .git отсутствует и переменных нет, поэтому мы бы записали поверх "unknown".
//
// Проверено на живой выкатке 14.08.2026 (f0c1620ceac2): код доехал, поля branch
// и commitSource появились, а commit остался "unknown" — ровно потому, что этот
// шаг сборки шёл последним и стирал уехавшую отметку. Два механизма писали в
// один файл, и побеждал тот, кто знает меньше.
if (info.source === "none" && existsSync(target)) {
  try {
    const prev = JSON.parse(readFileSync(target, "utf8"));
    if (prev && prev.commit && prev.commit !== "unknown") {
      console.log(
        `[build-info] сохраняю отметку выкатки: commit=${prev.commit} branch=${prev.branch || "unknown"} ` +
          `(своего источника здесь нет — .git в образ не попадает)`,
      );
      process.exit(0);
    }
  } catch {
    // Битый файл — перезапишем своим, это лучше неразбираемого.
  }
}

writeFileSync(target, JSON.stringify(info, null, 2), "utf8");

// Печатаем в лог сборки: если маркер не собрался, это должно быть видно в
// логах деплоя, а не только запросом к /health после него.
console.log(`[build-info] commit=${info.commit} source=${info.source} branch=${info.branch}`);
if (info.source === "none") {
  console.warn(
    "[build-info] коммит определить не удалось — /health покажет unknown. " +
      "Задайте GIT_SHA в переменных сервиса, если сборка идёт без .git.",
  );
}
