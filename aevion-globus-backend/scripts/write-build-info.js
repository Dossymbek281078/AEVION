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
const { writeFileSync, mkdirSync } = require("node:fs");
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

const out = join(__dirname, "..", "dist");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "build-info.json"), JSON.stringify(info, null, 2), "utf8");

// Печатаем в лог сборки: если маркер не собрался, это должно быть видно в
// логах деплоя, а не только запросом к /health после него.
console.log(`[build-info] commit=${info.commit} source=${info.source} branch=${info.branch}`);
if (info.source === "none") {
  console.warn(
    "[build-info] коммит определить не удалось — /health покажет unknown. " +
      "Задайте GIT_SHA в переменных сервиса, если сборка идёт без .git.",
  );
}
