#!/usr/bin/env node
/**
 * Пишет `public/version.json`, чтобы на вопрос «какой код сейчас на сайте»
 * отвечал ОДИН запрос.
 *
 * Зачем. 18.08.2026 я выяснял это так: скачал страницу, вытащил семнадцать
 * адресов чанков, скачал их по одному и грепал по своим строкам. Ушло
 * полблока, и приём требует заранее знать, что искать. Ответ был важный —
 * на живом сайте не оказалось починки, сделанной двумя днями раньше.
 *
 * Почему файл, а не переменная окружения. Ровно та же ловушка уже стоила
 * бэкенду двух недель неизвестности: переменные живут в СЕРВИСЕ, а не в
 * сборке, поэтому после чужой выкатки отметка продолжает уверенно называть
 * ваш коммит. Файл едет ВНУТРИ артефакта и врать не может.
 *
 * Приём и порядок источников взяты из `aevion-globus-backend/scripts/
 * write-build-info.js` намеренно: второй способ делать то же — хуже, чем
 * неидеальный первый.
 *
 * ⚠️ `public/version.json` НЕ ДЕРЖАТЬ В .gitignore: `vercel --prod` уважает
 * игнор-списки, и отметка просто не доедет до сборки. Файл живёт как
 * незакоммиченный — его пишет `prebuild` перед каждой сборкой. Сторож
 * `buildStamp.guard` следит, чтобы его не заигнорили.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "version.json");

function fromGit(args) {
  try {
    return execFileSync("git", args, { cwd: HERE, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const commit =
  process.env.AEVION_SOURCE_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  fromGit(["rev-parse", "HEAD"]) ||
  // Явное "unknown", а не пустая строка: «отметка не собралась» и «отметка не
  // показывается» — разные поломки, различать их надо до выкатки, а не после.
  "unknown";

const branch =
  process.env.AEVION_SOURCE_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  fromGit(["rev-parse", "--abbrev-ref", "HEAD"]) ||
  "unknown";

const info = {
  commit: commit.slice(0, 12),
  branch,
  builtAt: new Date().toISOString(),
  // Откуда взялось значение: свой git, переменная хостинга или ничего.
  // Без этого поля «unknown» неотличимо от «подставилось чужое».
  source: process.env.AEVION_SOURCE_COMMIT
    ? "stamped-at-deploy"
    : process.env.VERCEL_GIT_COMMIT_SHA
      ? "host-provided"
      : commit === "unknown"
        ? "none"
        : "git",
};

mkdirSync(dirname(OUT), { recursive: true });

/**
 * НЕ ПОНИЖАТЬ уже привезённую отметку.
 *
 * Воспроизведено 19.08.2026: сборка Vercel идёт НА ИХ МАШИНЕ, git там
 * недоступен, а при заливке из локального каталога переменных VERCEL_GIT_*
 * тоже нет. Значит этот скрипт запускается там ВТОРОЙ раз, не находит
 * ничего — и перезаписывает привезённую честную отметку на "unknown". То
 * есть механизм, сделанный ради ответа «какой код на сайте», сам же этот
 * ответ и стирал — молча и только в проде.
 *
 * Правило: пустой ответ не имеет права затирать непустой.
 */
let keep = null;
if (info.commit === "unknown") {
  try {
    const prev = JSON.parse(readFileSync(OUT, "utf8"));
    if (prev && typeof prev.commit === "string" && prev.commit && prev.commit !== "unknown") {
      keep = prev;
    }
  } catch {
    /* нет файла или он битый — писать своё, это честнее */
  }
}

if (keep) {
  console.log(
    `version.json: оставлена привезённая отметка ${keep.commit} (${keep.branch}) — ` +
      `здесь определить коммит нечем, а затирать known на unknown нельзя`,
  );
} else {
  writeFileSync(OUT, JSON.stringify(info, null, 2) + "\n", "utf8");
  console.log(`version.json: ${info.commit} (${info.branch}) источник=${info.source}`);
}
