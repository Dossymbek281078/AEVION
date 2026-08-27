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
/**
 * Отметка, которую положил скрипт выкатки, — она про ЭТУ сборку.
 *
 * `src/lib/buildStamp.ts` переписывается `scripts/vercel-deploy.sh` прямо
 * перед загрузкой, поэтому на машине Vercel это единственный источник, который
 * заведомо описывает текущую выкатку. Привезённый `public/version.json` таким
 * не является: он остаётся в рабочем каталоге от прошлых прогонов (его пишет
 * `prebuild` при любом локальном билде) и уезжает как есть.
 *
 * Замер 23.08.2026: выкатка коммита 141f123c3ae7 везла version.json от
 * fd6b9563479c — на один коммит старше. `/api/health` при этом отвечал верно,
 * потому что читает BUILD_STAMP, а вот `/version.json` отдавал бы другой
 * ответ на тот же вопрос. Два ответа хуже одного неточного: непонятно, какому
 * верить.
 */
function fromBuildStamp() {
  try {
    const src = readFileSync(join(HERE, "..", "src", "lib", "buildStamp.ts"), "utf8");
    // Разбор БЕЗ регулярки намеренно. Первая версия строила её из строки, и
    // экранирование схлопнулось по дороге: шаблон превратился в «commits*:s*»
    // и не находил ничего. Поймано отрицательным контролем (подложил заведомо
    // старую отметку и увидел, что она осталась), а не чтением кода.
    // Ищем ПРИСВОЕНИЕ (field: "..."), а не просто «field:». Вторая ловушка
    // подряд в этом же разборе: в файле сначала идёт объявление типа
    // (`branch: string;`), и поиск по «branch:» попадал в него, а следующая
    // кавычка принадлежала уже значению commit — то есть branch и builtAt
    // возвращали КОММИТ. У commit это совпало случайно и выглядело рабочим.
    // Видно только если печатать все три поля, а не одно.
    const body = src.slice(Math.max(0, src.indexOf("BUILD_STAMP:")));
    const pick = (field) => {
      const marker = field + ': "';
      const at = body.indexOf(marker);
      if (at < 0) return "";
      const from = at + marker.length;
      const to = body.indexOf('"', from);
      return to > from ? body.slice(from, to) : "";
    };
    const commit = pick("commit");
    if (!commit || commit === "unknown") return null;
    return { commit, branch: pick("branch") || "unknown", builtAt: pick("builtAt") || null };
  } catch {
    return null;
  }
}

let keep = null;
if (info.commit === "unknown") {
  const stamped = fromBuildStamp();
  if (stamped) {
    keep = {
      commit: stamped.commit,
      branch: stamped.branch,
      builtAt: stamped.builtAt ?? new Date().toISOString(),
      source: "stamped-at-deploy",
    };
    writeFileSync(OUT, JSON.stringify(keep, null, 2) + "\n", "utf8");
    console.log(`version.json: взята отметка выкатки ${keep.commit} (${keep.branch}) из buildStamp.ts`);
    keep = null; // записали сами — ниже ничего печатать не нужно
    process.exit(0);
  }
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
