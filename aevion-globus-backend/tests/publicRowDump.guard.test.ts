import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Сторож против одного класса, который 28.07.2026 нашёлся СЕМЬ раз за день:
 * публичная ручка читает строку запросом «выбрать всё» и отдаёт её в ответ
 * целиком.
 *
 * Опасность не в том, что такая ручка отдаёт сегодня, а в том, что выдача
 * растёт сама: колонку добавили обычным обновлением базы — и она уехала наружу,
 * хотя код никто не менял. В `planetCompliance` это уже случилось: в описании
 * таблицы 12 колонок, в ответе 17.
 *
 * Сторож НЕ требует починить всё разом — он замораживает нынешнее состояние:
 *  - появился НОВЫЙ такой обработчик → тест краснеет;
 *  - починили старый → тест краснеет и требует убрать его из списка, чтобы
 *    список не превратился в вечную свалку.
 *
 * Разбор грубый, по тексту обработчика, и за день он трижды ошибался — поэтому
 * ниже стоят два контроля: заведомо опасный образец обязан находиться, заведомо
 * безопасный — нет. Без них сторож молча выродится в декорацию.
 */

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes");

/** Признаки того, что обработчик определяет пользователя. */
const AUTH_MARKS =
  /verifyBearer|requireAuth|requireAdmin|isAdmin|requireModule|apiKey|gateRequest|resolveUser|headers\["authorization"\]|headers\.authorization/;

/** Строка из базы уходит в ответ как есть. */
const DUMPS_ROW = [
  /res\.(?:json|send)\(\s*(?:rows\[0\]|\w+\.rows\[0\]|\w+\.rows|rows)\b/,
  /res\.(?:json|send)\(\s*\{[^}]*\.\.\.\s*(?:\w+\.)?rows?\b/,
  /:\s*[\w.]*rows\s*\??\.?\[0\]/,
  /:\s*[\w.]*rows\b(?!\s*\.map)/,
];

/** `SELECT *` в любом виде, включая псевдоним таблицы (`SELECT p.*`). */
const SELECT_STAR = /SELECT\s+(?:[a-z_]{1,4}\.)?\*/i;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(Math.max(0, m.length - p1.length)));
}

export function findRowDumps(src: string, file: string): string[] {
  const clean = stripComments(src);
  const out: string[] = [];
  // Грубо режем на обработчики: от `.get(`/`.post(` до следующего такого же.
  for (const part of clean.split(/\n(?=\s*\w+\.(?:get|post|put|patch|delete)\()/)) {
    const head = part.split("\n")[0] || "";
    const m = head.match(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]*)["'`]/);
    if (!m) continue;
    if (!SELECT_STAR.test(part)) continue;
    if (!/res\.(?:json|send)\(/.test(part)) continue;
    if (AUTH_MARKS.test(part)) continue;
    if (!DUMPS_ROW.some((re) => re.test(part))) continue;
    out.push(`${file} ${m[1].toUpperCase()} ${m[2]}`);
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Замороженный список на 28.07.2026. Каждая строка — обработчик, который ещё не
 * разобран. Список обязан только СОКРАЩАТЬСЯ.
 */
const KNOWN: string[] = [
  "cyberchess.ts GET /cpi/me",
  "kidsAiContent.ts GET /lessons/:id",
  "mapReality.ts GET /signals",
  "mapReality.ts GET /signals/nearby",
  "mapReality.ts GET /signals/:id",
  "mapReality.ts GET /stats",
  "planetCompliance.ts GET /artifacts/:artifactVersionId/public",
  "planetCompliance.ts GET /artifacts/:artifactVersionId/votes/snapshot/latest",
  "puzzles.ts GET /",
  "qchaingov.ts GET /proposals/:id",
  "qevents.ts GET /events",
  "qevents.ts GET /events/:id",
  "qevents.ts GET /events/:id/attendees",
  "qjobs.ts GET /jobs",
  "qjobs.ts GET /jobs/:id",
  "qlearn.ts GET /courses",
  "qlearn.ts GET /courses/:id",
  "qlearn.ts GET /courses/:id/lessons/:lessonId",
  "qnews.ts GET /trending",
  "qnews.ts GET /articles",
  "qnews.ts GET /articles/:id",
  "qsocial.ts GET /feed",
  "qsocial.ts GET /posts/:id",
  "qsocial.ts GET /posts/:id/comments",
  "qsocial.ts GET /users/:userId/posts",
  "qsocial.ts GET /stories",
  "qstore.ts GET /products",
  "qstore.ts GET /products/:id",
  "voiceOfEarth.ts GET /tracks",
  "voiceOfEarth.ts GET /tracks/:id",
];

const found = walk(ROUTES_DIR).flatMap((f) =>
  findRowDumps(readFileSync(f, "utf8"), f.split(sep).slice(f.split(sep).indexOf("routes") + 1).join("/")),
);

describe("публичные ручки не отдают строку из базы целиком", () => {
  it("сканирование вообще нашло обработчики", () => {
    // контроль инструмента: на пустом наборе всё ниже пройдёт само собой
    expect(walk(ROUTES_DIR).length).toBeGreaterThan(50);
  });

  it("ловит заведомо опасный образец", () => {
    const bad = `
      thingRouter.get("/things/:id", async (req, res) => {
        const { rows } = await pool.query(\`SELECT * FROM "Thing" WHERE "id"=$1\`, [req.params.id]);
        return res.json({ thing: rows[0] });
      });
    `;
    expect(findRowDumps(bad, "sample.ts")).toHaveLength(1);
  });

  it("не ловит безопасный образец: поля перечислены и ответ собран", () => {
    const good = `
      thingRouter.get("/things/:id", async (req, res) => {
        const { rows } = await pool.query(\`SELECT "id","title" FROM "Thing" WHERE "id"=$1\`, [req.params.id]);
        const row = rows[0];
        return res.json({ thing: { id: row.id, title: row.title } });
      });
    `;
    expect(findRowDumps(good, "sample.ts")).toEqual([]);
  });

  it("не ловит ручку с проверкой входа", () => {
    const guarded = `
      thingRouter.get("/mine", async (req, res) => {
        const auth = verifyBearerOptional(req);
        if (!auth) return res.status(401).json({ error: "auth" });
        const { rows } = await pool.query(\`SELECT * FROM "Thing" WHERE "ownerId"=$1\`, [auth.sub]);
        return res.json({ things: rows });
      });
    `;
    expect(findRowDumps(guarded, "sample.ts")).toEqual([]);
  });

  it("новых мест не появилось", () => {
    const extra = found.filter((f) => !KNOWN.includes(f));
    expect(extra, `новая публичная ручка отдаёт строку целиком:\n${extra.join("\n")}`).toEqual([]);
  });

  it("список не устарел: всё из него ещё существует", () => {
    const fixed = KNOWN.filter((k) => !found.includes(k));
    expect(
      fixed,
      `исправлено — уберите из KNOWN, иначе список превратится в свалку:\n${fixed.join("\n")}`,
    ).toEqual([]);
  });
});
