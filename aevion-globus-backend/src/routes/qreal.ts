// QReal Studio — «полностью живое» AI-видео без съёмки актёра.
//
// Пайплайн: бриф → AI-раскадровка → render-ready промты с директивами
// реализма → внешний движок (Higgsfield/Veo/Kling через адаптеры) →
// QC-петля реализма (14 критериев) → сборка → provenance-манифест.
//
// Принципиально: КАЖДЫЙ проект несёт неотключаемую AI-декларацию
// (C2PA-style манифест, sha256, EU AI Act art. 50 disclosure). Реализм —
// продукт; неотличимость БЕЗ маркировки — не наш рынок.
//
//   GET  /api/qreal/health
//   GET  /api/qreal/engines                        ← честный статус движков
//   GET  /api/qreal/realism-criteria               ← QC-чеклист (14 критериев)
//   GET  /api/qreal/demo                           ← засеянный демо-проект
//   POST /api/qreal/projects                       ← {title, brief, format?...}
//   GET  /api/qreal/projects                       ← мои (Bearer)
//   GET  /api/qreal/projects/:id
//   POST /api/qreal/projects/:id/storyboard        ← бриф → кадры (LLM или stub)
//   POST /api/qreal/projects/:id/shots/:sid/render ← собрать промт, job
//   POST /api/qreal/projects/:id/shots/:sid/qc     ← отчёт реализма
//   GET  /api/qreal/projects/:id/provenance        ← подписанный манифест
import { Router } from "express";
import { readBuildInfo } from "../lib/buildInfo";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { makeServiceCapture } from "../lib/sentry/platform";
import { verifyBearerOptional } from "../lib/authJwt";
import { callProvider, pickConfiguredProvider, getProviders } from "../services/qcoreai/providers";
import { renderEngines, pickVideoEngine, falSubmit, falPoll } from "../services/qreal/engines";
import { REALISM_ANCHORS, scoreCriteria, buildJudgePrompt, autoRegenPolicy, acceptThreshold, type JudgeVerdict } from "../services/qreal/judge";
import { judgeRender, vlmJudgeConfigured, vlmJudgeModel } from "../services/qreal/vlmJudge";
import { deriveCharacters, subjectLines, consistencyDirective, charactersInShot, referenceCast, type Character } from "../services/qreal/characters";
import { REALISM_DIRECTIVES } from "../services/qreal/directives";
import { CONTINUITY_CRITERIA, CONTINUITY_ANCHORS, continuityThreshold, buildContinuityPrompt, scoreContinuity, isMeasurable } from "../services/qreal/continuity";
import { ensureQRealTables } from "../lib/ensureQRealTables";
import { getPool } from "../lib/dbPool";
import { clientIp } from "../lib/rateLimit";
import { isAdminRequest } from "../lib/adminAuth";

const captureQRealError = makeServiceCapture("qreal");

export const qrealRouter = Router();

/* ── Типы ── */

type SubjectKind = "human" | "child" | "animal" | "bird" | "nature" | "object";
type Subject = { kind: SubjectKind; description: string };

type QcCriterion = {
  id: string;
  label: string;
  weight: number;
  score: number | null; // 0..1, null = не оценено
  note: string | null;
};
type QcReport = {
  totalScore: number | null;
  method: "vlm-judge" | "manual" | "pending";
  criteria: QcCriterion[];
  checkedAt: string;
  /** Итог судьи: принять кадр, перегенерировать или «нечем судить».
   *  Появляется после реального скоринга; у пустого чеклиста его нет. */
  verdict?: JudgeVerdict;
};

type ShotStatus = "draft" | "prompt_ready" | "queued" | "rendered" | "failed";
type Shot = {
  id: string;
  order: number;
  title: string;
  description: string;
  subjects: Subject[];
  camera: string;
  dialogue: string | null;
  soundscape: string;
  durationSec: number;
  prompt: string | null;
  engine: string | null;
  engineRequestId: string | null;
  status: ShotStatus;
  resultUrl: string | null;
  qc: QcReport | null;
  /** Сколько раз кадр уже перегенерировали по вердикту судьи — ограничитель
   *  для авто-режима, чтобы петля «не нравится → рендерь ещё» не жгла бюджет. */
  qcAttempts?: number;
  /** Ушёл ли кадр в reference-вариант модели. Нужно при опросе: у него свой
   *  requests-путь, и опрос по text-to-video отдаст 404 на живую задачу. */
  usedReference?: boolean;
};

type ProjectFormat = "short" | "scene" | "film" | "music-video";
type Project = {
  id: string;
  userId: string;
  title: string;
  brief: string;
  format: ProjectFormat;
  targetDurationSec: number;
  language: string;
  depictsRealPeople: boolean;
  consentConfirmed: boolean;
  status: "draft" | "storyboarded" | "rendering" | "done";
  shots: Shot[];
  /** Реестр персонажей сцены: одно каноническое описание на героя, чтобы он
   *  не менял лицо между кадрами. Пересобирается вместе с раскадровкой. */
  characters?: Character[];
  filmPath: string | null;
  assembledAt: string | null;
  qrightObjectId: string | null;
  createdAt: string;
  updatedAt: string;
};

const memProjects = new Map<string, Project>();

// Кэш готовых рендеров: hash(движок|промт|длительность) → resultUrl.
// Повторный рендер того же кадра не тратит деньги («дешевле» на практике).
const memRenderCache = new Map<string, string>();

/* ── P7 persistence: Postgres write-through поверх in-memory ── */

const pool = getPool();
let dbWarmed = false;

/**
 * Запись проекта в базу. Остаётся «выстрелил и забыл» — рендер важнее записи,
 * и это правильно: все чтения идут из `memProjects`, то есть во время работы
 * процесса пользователь ничего не теряет.
 *
 * НО МОЛЧАТЬ НЕЛЬЗЯ. База здесь — единственное, что переживает перезапуск, а
 * выкатки в общий сервис идут по нескольку раз в день. Если запись падает,
 * проекты исчезают при первой же выкатке, и узнаём мы об этом от пользователя,
 * а не от системы. Раньше здесь стоял `.catch(() => {})` — ни строки в журнале.
 *
 * Тот же класс уже чинили 12.08.2026 в `devhub.ts` (коммит 55bda8024,
 * «проект, чьё сохранение не прошло, исчезает»). Там понадобилась подкладка
 * из памяти при чтении, потому что чтения шли в базу. Здесь чтения и так из
 * памяти, поэтому нужна ровно видимость — делать вторую подкладку незачем.
 */
function saveProject(p: Project): void {
  pool
    .query(
      `INSERT INTO "QRealProject" ("id","userId","data","updatedAt") VALUES ($1,$2,$3,NOW())
       ON CONFLICT ("id") DO UPDATE SET "data"=$3, "updatedAt"=NOW()`,
      [p.id, p.userId, JSON.stringify(p)]
    )
    .catch((e: Error) => {
      console.warn(
        `[qreal] проект ${p.id} НЕ сохранён в базу: ${e.message}. ` +
          "В памяти он есть, но не переживёт перезапуск процесса.",
      );
    });
}

function saveCacheEntry(cacheKey: string, url: string): void {
  pool
    .query(
      `INSERT INTO "QRealRenderCache" ("cacheKey","url") VALUES ($1,$2) ON CONFLICT ("cacheKey") DO NOTHING`,
      [cacheKey, url]
    )
    .catch((e: Error) => {
      console.warn(`[qreal] кэш рендера не записан: ${e.message}`);
    });
}

async function loadProjectFromDb(id: string): Promise<Project | null> {
  try {
    const r = await pool.query(`SELECT "data" FROM "QRealProject" WHERE "id"=$1`, [id]);
    return r.rows[0]?.data ? (r.rows[0].data as Project) : null;
  } catch { return null; }
}

/** Разогрев при первом запросе: кэш рендеров + сохранённые проекты (демо в
 *  БД новее сида — рендеры демо переживают редеплой). */
async function warmFromDb(): Promise<void> {
  if (dbWarmed) return;
  dbWarmed = true;
  try {
    await ensureQRealTables(pool);
    const cache = await pool.query(`SELECT "cacheKey","url" FROM "QRealRenderCache" LIMIT 5000`);
    for (const row of cache.rows) memRenderCache.set(row.cacheKey, row.url);
    const projects = await pool.query(`SELECT "data" FROM "QRealProject" ORDER BY "updatedAt" DESC LIMIT 500`);
    for (const row of projects.rows) {
      const p = row.data as Project;
      if (p?.id) memProjects.set(p.id, p);
    }
  } catch { /* in-memory режим */ }
}

/** Короткий коммит образа, или null — «не знаю» вместо выдуманного. */
function buildCommit(): string | null {
  const c = readBuildInfo().commit;
  return c && c !== "unknown" ? c.slice(0, 8) : null;
}

qrealRouter.use((_req, _res, next) => { warmFromDb().finally(() => next()); });

/** Ключ кэша рендеров.
 *
 *  Референс-картинки ОБЯЗАНЫ входить в ключ. В промте от них остаётся только
 *  маркер «@Image1» — при смене ссылки на другое лицо текст промта не меняется,
 *  и без URL в ключе повторный рендер вернул бы СТАРОЕ видео из кэша. Режиссёр
 *  поменял бы референс, увидел прежний ролик и решил, что референсы не
 *  работают. (Найдено вычиткой собственного дифа 2026-07-26.) */
function renderCacheKey(engineId: string, prompt: string, durationSec: number, imageUrls: string[] = []): string {
  const refs = imageUrls.length ? `|refs:${imageUrls.join(",")}` : "";
  return crypto.createHash("sha256").update(`${engineId}|${durationSec}|${prompt}${refs}`).digest("hex");
}

// Append-only журнал рендеров на диске: {submitted|completed}-строки.
// Урок 2026-07-21: рестарт процесса стёр in-memory проекты, оплаченные
// джобы спас только ручной лог request_id. Журнал закрывает эту дыру и
// восстанавливает кэш готовых рендеров при старте.
// Resolved per call, not at import. Binding a file path once at import is how
// the paywall suite ended up writing its fixtures into the real
// data/subscriptions.jsonl: whichever module got imported first decided the
// path, before the test could point it at a temp dir. Same shape here, so the
// same guard.
function journalPath(): string {
  return process.env.QREAL_JOURNAL_PATH
    || path.join(process.cwd(), "data", "qreal-render-journal.jsonl");
}

function journalAppend(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(journalPath()), { recursive: true });
    fs.appendFileSync(journalPath(), JSON.stringify({ ts: nowIso(), ...entry }) + "\n");
  } catch { /* журнал best-effort, рендер важнее */ }
}

function restoreRenderCacheFromJournal(): number {
  try {
    if (!fs.existsSync(journalPath())) return 0;
    let restored = 0;
    for (const line of fs.readFileSync(journalPath(), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.type === "completed" && typeof e.cacheKey === "string" && typeof e.url === "string") {
          memRenderCache.set(e.cacheKey, e.url);
          restored++;
        }
      } catch { /* битую строку пропускаем */ }
    }
    return restored;
  } catch { return 0; }
}

function nowIso() { return new Date().toISOString(); }
function uid() { return crypto.randomUUID(); }

/* ── Движки: собственный слой прямых интеграций (services/qreal/engines) ── */

/* ── Защита баланса: рендер стоит реальных денег ($0.13-0.30/с) ──
 * Пер-IP суточный лимит + общий суточный колпак на процесс. Без этого
 * прод-эндпоинт после мержа позволил бы анонимам жечь fal-баланс. */
const RENDER_IP_DAILY_LIMIT = Math.max(1, Number(process.env.QREAL_RENDER_IP_DAILY_LIMIT) || 3);
const RENDER_GLOBAL_DAILY_CAP = Math.max(1, Number(process.env.QREAL_RENDER_GLOBAL_DAILY_CAP) || 20);
const renderCounters = { day: "", byIp: new Map<string, number>(), total: 0 };

/** Судейство VLM тоже платное, но дешевле рендера — своё ведро со своими
 *  лимитами. Без него два публичных эндпоинта (POST /qc и /continuity с
 *  {"judge":true}) позволяли бы анониму жечь баланс в цикле: демо на проде
 *  открыто без логина. Найдено вычиткой дифа 2026-07-26. */
const JUDGE_IP_DAILY_LIMIT = Math.max(1, Number(process.env.QREAL_JUDGE_IP_DAILY_LIMIT) || 10);
const JUDGE_GLOBAL_DAILY_CAP = Math.max(1, Number(process.env.QREAL_JUDGE_GLOBAL_DAILY_CAP) || 60);
const judgeCounters = { day: "", byIp: new Map<string, number>(), total: 0 };

async function takeRenderQuota(
  req: { ip?: string; headers: Record<string, unknown> },
  bucket: "render" | "judge" = "render"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const isJudge = bucket === "judge";
  const IP_LIMIT = isJudge ? JUDGE_IP_DAILY_LIMIT : RENDER_IP_DAILY_LIMIT;
  const GLOBAL_CAP = isJudge ? JUDGE_GLOBAL_DAILY_CAP : RENDER_GLOBAL_DAILY_CAP;
  const counters = isJudge ? judgeCounters : renderCounters;
  const what = isJudge ? "судейств" : "рендеров";
  const today = nowIso().slice(0, 10);
  if (counters.day !== today) {
    counters.day = today;
    counters.byIp.clear();
    counters.total = 0;
  }
  // Левый элемент X-Forwarded-For пишет сам клиент: квота рендера и судейства
  // снималась сменой заголовка. Берём адрес так же, как ограничитель платформы.
  const fwd = clientIp(req);
  // Ключ ведра входит в ip-ключ: у рендера и судейства раздельные счётчики,
  // иначе судейство съедало бы квоту рендера и наоборот.
  const ip = (isJudge ? "judge:" : "") + (fwd || req.ip || "unknown");
  // Postgres-счётчики (переживают редеплой); при недоступной БД — in-memory.
  try {
    const r = await pool.query(
      `SELECT "ip","count" FROM "QRealQuota" WHERE "day"=$1 AND "ip" IN ($2,$3)`,
      [today, ip, isJudge ? "__global_judge__" : "__global__"]
    );
    const globalKey = isJudge ? "__global_judge__" : "__global__";
    const ipCount = r.rows.find((x: any) => x.ip === ip)?.count ?? 0;
    const globalCount = r.rows.find((x: any) => x.ip === globalKey)?.count ?? 0;
    if (globalCount >= GLOBAL_CAP) {
      return { ok: false, error: `Суточный лимит ${what} платформы исчерпан (${GLOBAL_CAP}/день) — попробуйте завтра.` };
    }
    if (ipCount >= IP_LIMIT) {
      return { ok: false, error: `Лимит бесплатных ${what} на сегодня исчерпан (${IP_LIMIT}/день).` };
    }
    await pool.query(
      `INSERT INTO "QRealQuota" ("day","ip","count") VALUES ($1,$2,1),($1,$3,1)
       ON CONFLICT ("day","ip") DO UPDATE SET "count"="QRealQuota"."count"+1`,
      [today, ip, globalKey]
    );
    return { ok: true };
  } catch { /* БД недоступна — считаем в памяти */ }
  if (counters.total >= GLOBAL_CAP) {
    return { ok: false, error: `Суточный лимит ${what} платформы исчерпан (${GLOBAL_CAP}/день) — попробуйте завтра.` };
  }
  const used = counters.byIp.get(ip) || 0;
  if (used >= IP_LIMIT) {
    return { ok: false, error: `Лимит бесплатных ${what} на сегодня исчерпан (${IP_LIMIT}/день).` };
  }
  counters.byIp.set(ip, used + 1);
  counters.total += 1;
  return { ok: true };
}

/* ── QC: 14 критериев реализма (ядро know-how модуля) ── */

const REALISM_CRITERIA: Array<{ id: string; label: string; weight: number }> = [
  { id: "micro-expressions", label: "Непроизвольная микромимика (не «маска», асимметрия лица)", weight: 1.2 },
  { id: "blink-rate", label: "Моргание 10–20/мин, неравномерное, с частичными морганиями", weight: 1.0 },
  { id: "skin-sss", label: "Подповерхностное рассеивание кожи (уши/пальцы на просвет)", weight: 1.0 },
  { id: "hands-topology", label: "Руки: 5 пальцев, суставы, естественные хваты", weight: 1.3 },
  { id: "eye-parallax", label: "Глаза: влажность, саккады, параллакс отражений", weight: 1.1 },
  { id: "hair-cloth-physics", label: "Физика волос и ткани (инерция, ветер, без «желе»)", weight: 1.0 },
  { id: "lipsync", label: "Липсинк ±40 мс, ко-артикуляция губ, видимый язык на [л]/[т]", weight: 1.3 },
  { id: "gait-motorics", label: "Походка/моторика: вес тела, у детей — детская, не «взрослая уменьшенная»", weight: 1.1 },
  { id: "animal-ethology", label: "Животные/птицы: видоспецифичное поведение (уши, хвост, взгляд, посадка головы)", weight: 1.1 },
  { id: "camera-body", label: "Камера с «телом»: микротряска руки, вес стедикама, не идеальный слайдер", weight: 0.9 },
  { id: "room-tone", label: "Room tone: у тишины есть звук помещения/улицы, без цифрового нуля", weight: 1.0 },
  { id: "foley-sync", label: "Фоли: шаги/одежда/предметы синхронны и материально верны", weight: 1.0 },
  { id: "light-continuity", label: "Свет: один источник во всех кадрах сцены, тени согласованы", weight: 0.9 },
  { id: "motion-blur", label: "24fps, шаттер 180°, естественный motion blur (не «видеоигра»)", weight: 0.8 },
];

function emptyQcReport(): QcReport {
  return {
    totalScore: null,
    method: "pending",
    criteria: REALISM_CRITERIA.map((c) => ({ ...c, score: null, note: null })),
    checkedAt: nowIso(),
  };
}

/* ── Директивы реализма, вшиваемые в каждый render-промт ── */


function buildRenderPrompt(p: Project, s: Shot): string {
  // Описания субъектов берём из реестра персонажей, а не из кадра: LLM пишет
  // раскадровку покадрово и переописывает того же героя каждый раз — отсюда
  // разные лица между кадрами. Реестр подставляет ОДИН канонический текст.
  const cast = p.characters || [];
  // Если у персонажей есть опорные картинки, строки несут маркеры @Image1/@Image2 —
  // Seedance адресует image_urls именно из текста промта, без ссылки они не
  // применяются. Без картинок referenceCast возвращает те же строки, что и
  // subjectLines, поэтому ветвление не нужно.
  const { imageUrls, lines } = referenceCast(s.subjects, cast);
  const subj = (imageUrls.length ? lines : subjectLines(s.subjects, cast)).join("; ");
  const dial = s.dialogue ? ` Dialogue (${p.language}): "${s.dialogue}".` : "";
  const continuity = consistencyDirective(charactersInShot(s.subjects, cast));
  return (
    `${s.description} Subjects — ${subj}. Camera: ${s.camera}. ` +
    `Sound: ${s.soundscape}.${dial} ${REALISM_DIRECTIVES}${continuity}`
  );
}

/* ── Раскадровка: LLM-декомпозиция с детерминированным fallback ── */

const STORYBOARD_SYSTEM =
  "Ты — режиссёр раскадровки фотореалистичного видео. Разбей бриф на 3-6 кадров. " +
  "ЖЕЛЕЗНОЕ ПРАВИЛО: раскадровка разворачивает ИМЕННО сцену из брифа — те же " +
  "субъекты, то же место, те же звуки. Ничего не выдумывай сверх брифа; каждый " +
  "кадр обязан прямо показывать сущности брифа (люди/животные/объекты/среда). " +
  "Реплики — на языке брифа. " +
  "Ответь СТРОГО JSON-объектом: {\"entities\":[перечисли ВСЕ сущности брифа: кто, что делает, где, когда, какие звуки]," +
  "\"shots\":[{\"title\":string,\"description\":string(на английском, кинематографично; ОБЯЗАН содержать сущности из entities — то же действие, то же место)," +
  "\"subjects\":[{\"kind\":\"human|child|animal|bird|nature|object\",\"description\":string}]," +
  "\"camera\":string,\"dialogue\":string|null,\"soundscape\":string(звуки из брифа),\"durationSec\":number}]}. " +
  "Кадр, показывающий другое действие или место, — ошибка. Без markdown, без пояснений.";

// Кэш раскадровок: одинаковый бриф → те же кадры без повторного LLM-вызова
// (экономия opus-токенов; демо-брифы отвечают мгновенно).
const memStoryboardCache = new Map<string, Shot[]>();

function storyboardCacheKey(p: Project, variation: number): string {
  return crypto.createHash("sha256").update(`${p.format}|${p.language}|v${variation}|${p.brief}`).digest("hex");
}

function cloneShotsForProject(shots: Shot[]): Shot[] {
  return shots.map((s) => ({ ...s, id: uid(), subjects: s.subjects.map((x) => ({ ...x })), qc: null, engineRequestId: null, resultUrl: null, status: "draft" as ShotStatus, engine: null }));
}

function stubStoryboard(p: Project): Shot[] {
  const base = p.brief.slice(0, 220);
  const mk = (order: number, title: string, description: string, camera: string, soundscape: string, durationSec: number): Shot => ({
    id: uid(), order, title, description,
    subjects: [{ kind: "nature", description: "environment from the brief" }],
    camera, dialogue: null, soundscape, durationSec,
    prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
  });
  return [
    mk(1, "Establishing", `Wide establishing shot. ${base}`, "slow push-in, eye level", "wind, distant ambient bed", 6),
    mk(2, "Medium", `Medium shot of the main subject. ${base}`, "handheld, 35mm", "close ambience, breathing room tone", 5),
    mk(3, "Close-up", `Close-up on the emotional detail. ${base}`, "85mm, shallow DOF", "intimate foley, fabric and skin sounds", 4),
    mk(4, "Closing", `Closing wide, subject leaves frame. ${base}`, "static tripod, long lens", "ambience swells then settles", 6),
  ];
}

async function aiStoryboard(p: Project, variation: number): Promise<{ shots: Shot[]; fromCache: boolean } | null> {
  const cacheKey = storyboardCacheKey(p, variation);
  const cached = memStoryboardCache.get(cacheKey);
  if (cached) return { shots: cloneShotsForProject(cached), fromCache: true };
  try {
    const dbHit = await pool.query(`SELECT "shots" FROM "QRealStoryboardCache" WHERE "briefHash"=$1`, [cacheKey]).catch(() => null);
    const dbShots = dbHit?.rows?.[0]?.shots;
    if (Array.isArray(dbShots) && dbShots.length) {
      memStoryboardCache.set(cacheKey, dbShots as Shot[]);
      return { shots: cloneShotsForProject(dbShots as Shot[]), fromCache: true };
    }
    const provider = pickConfiguredProvider();
    if (!provider || provider === "stub") return null;
    // Пустая модель давала 400 у Anthropic → тихий stub-фолбэк на проде
    // (найдено смоуком storyboardMethod 2026-07-22). Берём defaultModel провайдера.
    const model = getProviders().find((x) => x.id === provider)?.defaultModel || "";
    if (!model) return null;
    const r = await callProvider(
      provider,
      [
        { role: "system", content: STORYBOARD_SYSTEM },
        { role: "user", content: `Бриф (${p.format}, ~${p.targetDurationSec}с, язык диалогов: ${p.language}). Разбей ИМЕННО эту сцену, не выдумывай другую:\n${p.brief}` + (variation > 1 ? `
Вариация №${variation}: та же сцена и сущности, но ДРУГОЙ монтажный ритм — иной порядок планов, другая крупность и движение камеры.` : "") },
      ],
      model, 0.3
    );
    const jsonText = r.reply.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText);
    const arr = Array.isArray(parsed) ? parsed : parsed?.shots;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const shots = arr.slice(0, 8).map((s: any, i: number): Shot => ({
      id: uid(),
      order: i + 1,
      title: String(s.title || `Shot ${i + 1}`).slice(0, 120),
      description: String(s.description || "").slice(0, 1200),
      subjects: Array.isArray(s.subjects)
        ? s.subjects.slice(0, 8).map((x: any) => ({
            kind: (["human", "child", "animal", "bird", "nature", "object"].includes(x?.kind) ? x.kind : "object") as SubjectKind,
            description: String(x?.description || "").slice(0, 300),
          }))
        : [],
      camera: String(s.camera || "handheld, 35mm").slice(0, 200),
      dialogue: s.dialogue ? String(s.dialogue).slice(0, 500) : null,
      soundscape: String(s.soundscape || "natural ambient bed").slice(0, 300),
      durationSec: Number(s.durationSec) > 0 ? Math.min(20, Number(s.durationSec)) : 5,
      prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    }));
    memStoryboardCache.set(cacheKey, shots);
    pool.query(`INSERT INTO "QRealStoryboardCache" ("briefHash","shots") VALUES ($1,$2) ON CONFLICT ("briefHash") DO NOTHING`, [cacheKey, JSON.stringify(shots)]).catch((e: Error) => {
      console.warn(`[qreal] кэш раскадровки не записан: ${e.message}`);
    });
    return { shots: cloneShotsForProject(shots), fromCache: false };
  } catch {
    return null; // честный fallback на stub, без маскировки под AI
  }
}

/* ── Provenance: неотключаемая AI-декларация ── */

function provenanceManifest(p: Project) {
  const payload = {
    standard: "AEVION-QReal/1.0 (C2PA-style)",
    projectId: p.id,
    title: p.title,
    aiGenerated: true, // всегда true, тумблера нет by design
    assembledAt: p.assembledAt,
    engines: Array.from(new Set(p.shots.map((s) => s.engine).filter(Boolean))),
    disclosure:
      "Это видео полностью сгенерировано ИИ (AEVION QReal). Люди, дети, животные и " +
      "среда в кадре не существуют. Маркировка соответствует EU AI Act art. 50.",
    depictsRealPeople: p.depictsRealPeople,
    shots: p.shots.map((s) => ({ id: s.id, title: s.title, engine: s.engine, status: s.status })),
    createdAt: p.createdAt,
  };
  const sha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { ...payload, sha256, verify: "/api/data-quality/trust-score/verify" };
}

/* ── Демо-проект (витрина без логина) ── */

const DEMO_ID = "demo-steppe-morning";

function seedDemo() {
  if (memProjects.has(DEMO_ID)) return;
  const created = "2026-07-21T06:00:00.000Z";
  const shots: Shot[] = [
    {
      id: "demo-shot-1", order: 1, title: "Рассвет над степью",
      description: "Golden-hour wide shot of the Kazakh steppe; feather grass bends in waves under the wind, a dirt road leads to a lone yurt with smoke from the chimney.",
      subjects: [{ kind: "nature", description: "steppe, feather grass, dawn light, wind" }],
      camera: "slow aerial push-in, 21mm", dialogue: null,
      soundscape: "steady steppe wind, skylark far away, grass rustle",
      durationSec: 7, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
    {
      id: "demo-shot-2", order: 2, title: "Мальчик и собака",
      description: "A 7-year-old boy runs out of the yurt, an Alabai dog jumps around him; the boy laughs, dust rises from bare feet on the packed ground.",
      subjects: [
        { kind: "child", description: "7yo boy, tousled hair, oversized sweater, childlike gait" },
        { kind: "animal", description: "Central Asian shepherd dog, tail wagging, ears reacting to voice" },
      ],
      camera: "handheld tracking, 35mm, knee height", dialogue: "Айда, Ақтөс!",
      soundscape: "boy's laughter with open-air acoustics, dog paws on dirt, morning birds",
      durationSec: 6, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
    {
      id: "demo-shot-3", order: 3, title: "Бабушка у очага",
      description: "Inside the yurt an elderly woman pours tea from a kettle; steam curls in a sunbeam from the shanyrak; her hands show age spots and slight tremor.",
      subjects: [
        { kind: "human", description: "grandmother ~70, weathered hands, warm squint, headscarf" },
        { kind: "object", description: "copper kettle, piala bowls, steam in light shaft" },
      ],
      camera: "static 50mm, table level, shallow DOF", dialogue: "Шай ішіп ал, балам.",
      soundscape: "pouring tea, fire crackle, muffled wind outside — dense room tone",
      durationSec: 5, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
    {
      id: "demo-shot-4", order: 4, title: "Беркут взлетает",
      description: "A golden eagle takes off from a wooden perch: two heavy wing beats, feathers spread against the low sun, camera pans with the bird into the sky.",
      subjects: [{ kind: "bird", description: "golden eagle, accurate wing mechanics, feather detail" }],
      camera: "pan with subject, 135mm, slight lag behind motion", dialogue: null,
      soundscape: "heavy wing beats close-up, wind gust, single eagle cry with natural echo",
      durationSec: 6, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
  ];
  const demo: Project = {
    id: DEMO_ID, userId: "aevion-demo",
    title: "Утро в степи",
    brief: "Утро казахской семьи в степи: рассвет, мальчик с собакой, бабушка с чаем в юрте, беркут. Полностью живое видео без единой съёмки — люди, ребёнок, животные, птица, ветер и звук сгенерированы.",
    format: "scene", targetDurationSec: 24, language: "kk",
    depictsRealPeople: false, consentConfirmed: false,
    status: "storyboarded", shots, filmPath: null, assembledAt: null, qrightObjectId: null,
    createdAt: created, updatedAt: created,
  };
  for (const s of demo.shots) s.prompt = buildRenderPrompt(demo, s);
  memProjects.set(DEMO_ID, demo);
}
seedDemo();
restoreRenderCacheFromJournal();

/* ── Сборка фильма (P4): скачиваем кадры → FFmpeg concat + loudnorm ── */

const AI_DISCLOSURE_META =
  "AI-generated by AEVION QReal Studio. All people, children, animals and sounds are synthetic. EU AI Act art.50 disclosure.";

function runFfmpeg(args: string[]): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => { err += String(d); });
    proc.on("error", (e) => resolve({ ok: false, error: e.message })); // ENOENT = ffmpeg нет
    proc.on("close", (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: err.slice(-500) }));
  });
}

async function assembleFilm(p: Project): Promise<{ ok: true; filmPath: string } | { ok: false; error: string }> {
  const shots = [...p.shots].sort((a, b) => a.order - b.order);
  if (!shots.length || shots.some((s) => !s.resultUrl)) {
    return { ok: false, error: "not all shots are rendered" };
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "qreal-film-"));
  try {
    const localFiles: string[] = [];
    for (const s of shots) {
      const f = path.join(workDir, `shot-${s.order}.mp4`);
      const r = await fetch(s.resultUrl as string);
      if (!r.ok) return { ok: false, error: `download shot ${s.order} failed (${r.status})` };
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      localFiles.push(f);
    }
    const listFile = path.join(workDir, "concat.txt");
    // Windows: у concat-демаксера '\' — escape-символ, пути отдаём с '/'.
    fs.writeFileSync(
      listFile,
      localFiles.map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n")
    );
    const out = path.join(workDir, "film.mp4");
    const res = await runFfmpeg([
      "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile,
      "-c:v", "libx264", "-crf", "20", "-preset", "medium",
      "-c:a", "aac", "-b:a", "160k", "-af", "loudnorm=I=-14:TP=-1.5",
      "-metadata", `comment=${AI_DISCLOSURE_META}`,
      out,
    ]);
    if (!res.ok) return { ok: false, error: res.error || "ffmpeg failed" };
    return { ok: true, filmPath: out };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "assemble failed" };
  }
}

/* ── Роуты ── */

qrealRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    module: "qreal",
    // Читаем отметку тем же способом, что и главный /health: из файла в
    // образе, а переменные только запасным путём. Раньше здесь стояла ТОЛЬКО
    // переменная RAILWAY_GIT_COMMIT_SHA, а выкатка идёт папкой и её не ставит —
    // поле было null всегда, и смоук модуля краснел на нём постоянно.
    commit: buildCommit(),
    label: "QReal Studio",
    tagline: "Полностью живое AI-видео без съёмки актёра — с неотключаемой AI-маркировкой",
    pipeline: ["brief", "storyboard", "render-prompts", "engine", "realism-qc", "assembly", "provenance"],
    projects: memProjects.size,
  });
});

qrealRouter.get("/engines", (_req, res) => {
  res.json({ engines: renderEngines() });
});

/**
 * Сколько рендеров и судейств было по дням. Только СВОДНЫЕ числа.
 *
 * Зачем. Расход у поставщика виден в его выписке одной суммой, а вопрос
 * «сколько рендеров и в какие дни» до сих пор нельзя было задать ниоткуда:
 * данные лежат в `QRealQuota`, наружу их не отдавала ни одна ручка. Для
 * разговора о счёте это ровно недостающее число.
 *
 * 🔒 Приватность. В таблице лежит СЫРОЙ адрес клиента, поэтому читаются только
 * строки итогов `__global__` и `__global_judge__` — данных о людях этот
 * запрос не касается вовсе. Столбец `ip` не выбирается и наружу не уходит.
 *
 * Только для администратора: число рендеров платформы — деловая метрика.
 */
qrealRouter.get("/usage", async (req, res) => {
  if (!isAdminRequest(req)) return res.status(403).json({ error: "admin_required" });
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  try {
    const r = await pool.query(
      `SELECT "day","ip","count" FROM "QRealQuota"
        WHERE "ip" IN ('__global__', '__global_judge__')
        ORDER BY "day" DESC LIMIT $1`,
      [days * 2],
    );
    // Сколько РАЗЛИЧНЫХ адресов — подсказал сосед, и довод верный: 20 рендеров
    // с одного адреса и с двадцати — разные истории, и первая означает
    // злоупотребление. Считаем COUNT(DISTINCT), сами адреса не выбираются.
    const ips = await pool.query(
      `SELECT "day", COUNT(DISTINCT "ip")::int AS "ips" FROM "QRealQuota"
        WHERE "ip" NOT IN ('__global__', '__global_judge__')
        GROUP BY "day" ORDER BY "day" DESC LIMIT $1`,
      [days],
    );
    const ipsByDay = new Map<string, number>(
      (ips.rows as Array<{ day: string; ips: number }>).map((x) => [x.day, x.ips]),
    );
    const byDay = new Map<string, { day: string; renders: number; judgements: number }>();
    for (const row of r.rows as Array<{ day: string; ip: string; count: number }>) {
      const e = byDay.get(row.day) ?? { day: row.day, renders: 0, judgements: 0 };
      // Только ДВА известных ключа итогов. Прежняя редакция принимала за
      // рендеры любую строку, кроме судейской, — и адресная строка попала бы
      // в сводку, если бы запрос когда-нибудь перестал их отсекать.
      // Приватность не должна держаться на одном слое: SQL фильтрует, и
      // разбор тоже. Поймано тестом с подложенной адресной строкой.
      if (row.ip === "__global_judge__") e.judgements = row.count;
      else if (row.ip === "__global__") e.renders = row.count;
      else continue;
      byDay.set(row.day, e);
    }
    return res.json({
      available: true,
      days: [...byDay.values()]
        .map((d) => ({ ...d, distinctAddresses: ipsByDay.get(d.day) ?? 0 }))
        .sort((x, y) => (x.day < y.day ? 1 : -1)),
      caps: { renderGlobalDaily: RENDER_GLOBAL_DAILY_CAP, judgeGlobalDaily: JUDGE_GLOBAL_DAILY_CAP },
      note: "Числа — количество вызовов, НЕ стоимость: длительность рендера не хранится.",
    });
  } catch (e) {
    // Пустой список при недоступной базе читался бы как «рендеров не было» —
    // то есть ответ выглядел бы благополучно и был бы ложью. Говорим прямо.
    return res.status(503).json({
      available: false,
      error: "quota_store_unavailable",
      note: "Хранилище квот недоступно: сколько рендеров было — НЕИЗВЕСТНО, а не ноль.",
    });
  }
});

qrealRouter.get("/realism-criteria", (_req, res) => {
  // Якоря 1/3/5 отдаются вместе с критериями: продуктовый судья, слепой
  // бенчмарк и фронт обязаны мерить одной линейкой, а не тремя копиями шкалы.
  res.json({ criteria: REALISM_CRITERIA, anchors: REALISM_ANCHORS, scale: "1..5 по якорям; наружу score = (оценка-1)/4", threshold: acceptThreshold() });
});

qrealRouter.get("/demo", (_req, res) => {
  seedDemo();
  res.json({ project: memProjects.get(DEMO_ID) });
});

qrealRouter.post("/projects", (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const { title, brief, format, targetDurationSec, language, depictsRealPeople, consentConfirmed } = req.body || {};
    if (!brief || typeof brief !== "string" || brief.trim().length < 10) {
      return res.status(400).json({ error: "brief required (10+ chars)" });
    }
    // Guardrail: реальные узнаваемые люди — только с подтверждённым согласием.
    if (depictsRealPeople === true && consentConfirmed !== true) {
      return res.status(422).json({
        error: "real_person_consent_required",
        message: "Для изображения реального человека нужно подтверждённое согласие (consentConfirmed: true).",
      });
    }
    const p: Project = {
      id: uid(),
      userId: auth?.sub || "anon",
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : "Без названия",
      brief: brief.trim().slice(0, 4000),
      format: (["short", "scene", "film", "music-video"] as ProjectFormat[]).includes(format) ? format : "short",
      targetDurationSec: Number(targetDurationSec) > 0 ? Math.min(600, Number(targetDurationSec)) : 30,
      language: typeof language === "string" && language ? language.slice(0, 8) : "ru",
      depictsRealPeople: depictsRealPeople === true,
      consentConfirmed: consentConfirmed === true,
      status: "draft", shots: [], filmPath: null, assembledAt: null, qrightObjectId: null,
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    memProjects.set(p.id, p);
    saveProject(p);
    res.status(201).json({ project: p });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "create project failed" }); }
});

qrealRouter.get("/projects", (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = Array.from(memProjects.values())
      .filter((p) => p.userId === auth.sub)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ items });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "list failed" }); }
});

qrealRouter.get("/projects/:id", (req, res) => {
  const p = memProjects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json({ project: p });
});

qrealRouter.post("/projects/:id/storyboard", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    const variation = Math.min(5, Math.max(1, Number(req.body?.variation) || 1));
    const viaAi = await aiStoryboard(p, variation);
    p.shots = viaAi?.shots ?? stubStoryboard(p);
    // Каст выводим ДО промтов: buildRenderPrompt читает p.characters.
    p.characters = deriveCharacters(p.shots);
    for (const s of p.shots) s.prompt = buildRenderPrompt(p, s);
    p.status = "storyboarded";
    p.updatedAt = nowIso();
    saveProject(p);
    res.json({ project: p, storyboardMethod: viaAi ? (viaAi.fromCache ? "llm-cached" : "llm") : "deterministic-stub" });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "storyboard failed" }); }
});

function isCachedShot(p: Project, s: Shot, engine: ReturnType<typeof pickVideoEngine>): boolean {
  if (!engine) return false;
  const prompt = s.prompt || buildRenderPrompt(p, s);
  const { imageUrls } = referenceCast(s.subjects, p.characters || []);
  return memRenderCache.has(renderCacheKey(engine.id, prompt, s.durationSec, imageUrls));
}

/** Один кадр: кэш → мгновенно; иначе submit в движок с одним ретраем. */
async function submitShot(p: Project, s: Shot, engine: ReturnType<typeof pickVideoEngine>): Promise<string> {
  // Перерендер кадра, который судья уже забраковал, — это следующая попытка.
  // Считаем её здесь, а не в /qc: лимит должен ограничивать РЕНДЕРЫ (деньги),
  // а не пересуждения одного и того же файла.
  if (s.qc?.verdict?.verdict === "regenerate") s.qcAttempts = (s.qcAttempts || 0) + 1;
  s.prompt = buildRenderPrompt(p, s);
  if (!engine) {
    s.engine = null;
    s.status = "prompt_ready"; // честно: промт собран, FAL_KEY не задан
    return "Render-промт готов. Прямой видеодвижок не сконфигурирован (env FAL_KEY) — задайте ключ fal.ai, и рендер пойдёт без посредников.";
  }
  // Есть ли у персонажей кадра опорные картинки — тогда уходим в
  // reference-вариант модели и ссылаемся на них прямо в промте (@Image1).
  // Считаем ДО кэша: ссылки входят в ключ, иначе смена референса вернула бы
  // старое видео.
  const { imageUrls } = referenceCast(s.subjects, p.characters || []);
  s.usedReference = imageUrls.length > 0;

  const cacheKey = renderCacheKey(engine.id, s.prompt, s.durationSec, imageUrls);
  const cached = memRenderCache.get(cacheKey);
  if (cached) {
    s.engine = engine.id;
    s.engineRequestId = null;
    s.resultUrl = cached;
    s.status = "rendered";
    return "Кадр взят из кэша рендеров — $0.";
  }

  let sub = await falSubmit(engine, s.prompt, s.durationSec, imageUrls);
  if (!sub.ok) sub = await falSubmit(engine, s.prompt, s.durationSec, imageUrls); // один ретрай (fal бывает 5xx)
  if (!sub.ok) {
    s.engine = engine.id;
    s.status = "failed";
    return `Движок ${engine.label} отклонил задачу: ${sub.error}`;
  }
  s.engine = engine.id;
  s.engineRequestId = sub.requestId;
  s.status = "queued";
  journalAppend({ type: "submitted", projectId: p.id, shotId: s.id, engine: engine.id, requestId: sub.requestId, cacheKey });
  const estUsd = engine.usdPerSecond != null ? (engine.usdPerSecond * s.durationSec).toFixed(2) : "?";
  return `Кадр в очереди: ${engine.label}, ~$${estUsd}.`;
}

qrealRouter.get("/projects/:id/characters", (req, res) => {
  const p = memProjects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  // Каст мог быть выведен до появления реестра (старые проекты в БД) —
  // считаем на лету, чтобы не отдавать пустоту там, где персонажи есть.
  const characters = p.characters?.length ? p.characters : deriveCharacters(p.shots);
  res.json({ characters, note: "canonical — единственное описание, которое уходит во ВСЕ кадры персонажа" });
});

/** Правка каста человеком. Автовывод хорош, но режиссёр знает лучше: «алабай»
 *  вместо «shepherd dog», конкретный возраст, порода, шрам. После правки промты
 *  ПЕРЕСОБИРАЮТСЯ — иначе canonical поменялся бы, а в движок ушёл старый текст. */
qrealRouter.patch("/projects/:id/characters/:cid", (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    if (!p.characters?.length) p.characters = deriveCharacters(p.shots);
    const c = p.characters.find((x) => x.id === req.params.cid);
    if (!c) return res.status(404).json({ error: "character not found" });

    const { canonical, name, refImages } = req.body || {};
    if (typeof canonical === "string" && canonical.trim().length >= 3) c.canonical = canonical.trim().slice(0, 600);
    if (typeof name === "string" && name.trim()) c.name = name.trim().slice(0, 80);
    if (Array.isArray(refImages)) {
      // Движки принимают ограниченное число референсов (Seedance — до 9).
      c.refImages = refImages.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 9);
    }

    for (const s of p.shots) s.prompt = buildRenderPrompt(p, s);
    p.updatedAt = nowIso();
    saveProject(p);
    res.json({ character: c, characters: p.characters, note: "Промты кадров пересобраны под новое описание." });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "character update failed" }); }
});

/** Непрерывность персонажа между кадрами — то, что реестр персонажей чинит,
 *  а покадровый QC измерить не может в принципе: на одиночном клипе не видно,
 *  что во втором и четвёртом кадре разные мальчики. Судим собранный фильм. */
qrealRouter.post("/projects/:id/continuity", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    if (!p.characters?.length) p.characters = deriveCharacters(p.shots);

    // Ни один герой не появляется дважды — сравнивать нечего. Отдать здесь
    // бодрое «непрерывно» значило бы подтвердить непроверенное заявление.
    if (!isMeasurable(p.characters)) {
      return res.status(409).json({
        error: "not_measurable",
        message: "Ни один персонаж не появляется в двух кадрах — непрерывность измерять не на чем.",
        characters: p.characters,
      });
    }

    const shots = p.shots.map((s) => ({ order: s.order, title: s.title }));
    const prompt = buildContinuityPrompt(p.characters, shots);
    let raw = Array.isArray(req.body?.scores) ? req.body.scores : null;

    if (!raw && req.body?.judge === true) {
      if (!vlmJudgeConfigured()) return res.status(503).json({ error: "vlm_not_configured", message: "FAL_KEY не задан." });

      // Судья смотрит фильм по публичному URL, а /film отдаёт 404, пока не
      // отрендерены ВСЕ кадры. Без этой проверки платный вызов ушёл бы на
      // заведомо мёртвую ссылку — деньги за гарантированный провал.
      const unrendered = p.shots.filter((s) => !s.resultUrl);
      if (!p.filmPath && unrendered.length) {
        return res.status(409).json({
          error: "film_not_ready",
          message: `Фильм не собран: не отрендерено кадров — ${unrendered.length} из ${p.shots.length}. Судить нечего, платный вызов не делаю.`,
          unrenderedShots: unrendered.map((s) => s.order),
        });
      }

      // Судейство платное, а демо на проде открыто без логина — без квоты
      // аноним жёг бы баланс в цикле.
      const quota = await takeRenderQuota(req as any, "judge");
      if (!quota.ok) return res.status(429).json({ error: "judge_quota_exceeded", message: quota.error });

      const base = (process.env.PUBLIC_BASE_URL || "https://aevion.app/api-backend").replace(/\/+$/, "");
      const filmUrl = `${base}/api/qreal/projects/${p.id}/film`;
      const out = await judgeRender(filmUrl, CONTINUITY_CRITERIA, { description: p.brief }, { prompt });
      if (!out.ok) return res.status(502).json({ error: "vlm_judge_failed", message: out.error, filmUrl });
      raw = out.scores;
    }

    if (!raw) {
      return res.json({
        criteria: CONTINUITY_CRITERIA,
        anchors: CONTINUITY_ANCHORS,
        threshold: continuityThreshold(),
        characters: p.characters,
        judgePrompt: prompt,
        note: "Пришли оценки в {scores:[{id,score:1-5|null}]} — от человека по якорям или от VLM через {\"judge\":true} (платно, по собранному фильму).",
      });
    }

    const result = scoreContinuity(raw);
    res.json({
      continuity: result,
      note:
        result.verdict === "consistent"
          ? `Персонаж держится: ${(result.totalScore as number).toFixed(2)} ≥ ${result.threshold}.`
          : result.verdict === "drifting"
            ? `Дрейф: ${(result.totalScore as number).toFixed(2)} < ${result.threshold}. Разошлось: ${result.weakest.map((w) => w.id).join(", ")}. Уточни канон персонажа или добавь референс-кадр.`
            : `Оценено ${result.judgedCriteria} из ${CONTINUITY_CRITERIA.length} — мало для вердикта.`,
    });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "continuity failed" }); }
});

qrealRouter.get("/projects/:id/estimate", (req, res) => {
  const p = memProjects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  const totalSec = p.shots.reduce((a, s) => a + s.durationSec, 0);
  const cachedSec = p.shots.reduce((a, s) => {
    const engine = pickVideoEngine() || renderEngines().find((e) => e.modality.includes("video"))!;
    const prompt = s.prompt || buildRenderPrompt(p, s);
    const { imageUrls } = referenceCast(s.subjects, p.characters || []);
    return a + (memRenderCache.has(renderCacheKey(engine.id, prompt, s.durationSec, imageUrls)) ? s.durationSec : 0);
  }, 0);
  const engines = renderEngines()
    .filter((e) => e.modality.includes("video") && e.usdPerSecond != null)
    .map((e) => ({
      id: e.id,
      label: e.label,
      configured: e.configured,
      usdPerSecond: e.usdPerSecond,
      usdTotal: Number(((totalSec - cachedSec) * (e.usdPerSecond as number)).toFixed(2)),
    }));
  res.json({ shots: p.shots.length, totalSec, cachedSec, engines });
});

qrealRouter.post("/projects/:id/shots/:sid/render", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    const s = p?.shots.find((x) => x.id === req.params.sid);
    if (!p || !s) return res.status(404).json({ error: "not found" });
    const preferred = typeof req.body?.engine === "string" ? req.body.engine : undefined;
    const engine = pickVideoEngine(preferred);
    if (engine && !isCachedShot(p, s, engine)) {
      const quota = await takeRenderQuota(req as any);
      if (!quota.ok) return res.status(429).json({ error: "render_quota_exceeded", message: quota.error });
    }
    const note = await submitShot(p, s, engine);
    p.updatedAt = nowIso();
    saveProject(p);
    if (s.status === "failed") return res.status(502).json({ shot: s, note });
    res.json({ shot: s, note });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "render failed" }); }
});

// «Бриф → фильм без кликов»: последовательная очередь всех кадров.
qrealRouter.post("/projects/:id/render-all", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    const preferred = typeof req.body?.engine === "string" ? req.body.engine : undefined;
    const engine = pickVideoEngine(preferred);
    const notes: Array<{ shotId: string; note: string }> = [];
    for (const s of p.shots) {
      if (s.status === "rendered" || s.status === "queued") continue;
      if (engine && !isCachedShot(p, s, engine)) {
        const quota = await takeRenderQuota(req as any);
        if (!quota.ok) { notes.push({ shotId: s.id, note: quota.error }); continue; }
      }
      notes.push({ shotId: s.id, note: await submitShot(p, s, engine) });
    }
    p.status = engine ? "rendering" : p.status;
    p.updatedAt = nowIso();
    saveProject(p);
    res.json({ project: p, notes });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "render-all failed" }); }
});

qrealRouter.get("/projects/:id/shots/:sid/render-status", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    const s = p?.shots.find((x) => x.id === req.params.sid);
    if (!p || !s) return res.status(404).json({ error: "not found" });
    if (s.status === "rendered" || !s.engineRequestId) return res.json({ shot: s });
    const engine = renderEngines().find((e) => e.id === s.engine);
    if (!engine) return res.json({ shot: s });
    const poll = await falPoll(engine, s.engineRequestId, s.usedReference === true);
    if (poll.state === "completed") {
      s.resultUrl = poll.videoUrl;
      s.status = poll.videoUrl ? "rendered" : "failed";
      if (poll.videoUrl && s.prompt) {
        // Ключ записи обязан совпадать с ключом чтения, иначе кэш не попадёт
        // никогда и каждый повтор будет платным.
        const { imageUrls } = referenceCast(s.subjects, p.characters || []);
        const cacheKey = renderCacheKey(engine.id, s.prompt, s.durationSec, imageUrls);
        memRenderCache.set(cacheKey, poll.videoUrl);
        saveCacheEntry(cacheKey, poll.videoUrl);
        journalAppend({ type: "completed", projectId: p.id, shotId: s.id, requestId: s.engineRequestId, cacheKey, url: poll.videoUrl });
      }
    } else if (poll.state === "failed") {
      s.status = "failed";
    }
    p.updatedAt = nowIso();
    saveProject(p);
    res.json({ shot: s, engineState: poll.state });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "render-status failed" }); }
});

qrealRouter.post("/projects/:id/shots/:sid/qc", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    const s = p?.shots.find((x) => x.id === req.params.sid);
    if (!p || !s) return res.status(404).json({ error: "not found" });

    // Оценки приходят снаружи: от VLM-судьи или от человека по тем же якорям.
    // Шкала 1..5, null = критерий неприменим к этому кадру.
    let raw = Array.isArray(req.body?.scores) ? req.body.scores : null;
    let judgeNote: string | null = null;

    // Позвать VLM-судью можно только явно: вызов платный, и неявный запуск
    // из «просто открыл вкладку QC» жёг бы деньги на каждом рендере.
    if (!raw && req.body?.judge === true) {
      if (!s.resultUrl) return res.status(409).json({ error: "no_render", message: "Судить нечего: у кадра нет рендера." });
      if (!vlmJudgeConfigured()) return res.status(503).json({ error: "vlm_not_configured", message: "FAL_KEY не задан — VLM-судья недоступен." });
      const quota = await takeRenderQuota(req as any, "judge");
      if (!quota.ok) return res.status(429).json({ error: "judge_quota_exceeded", message: quota.error });
      const verdictRaw = await judgeRender(s.resultUrl, REALISM_CRITERIA, s);
      if (!verdictRaw.ok) return res.status(502).json({ error: "vlm_judge_failed", message: verdictRaw.error });
      raw = verdictRaw.scores;
      judgeNote = verdictRaw.dropped.length ? `Судья вернул неизвестные критерии и они отброшены: ${verdictRaw.dropped.join(", ")}.` : null;
    }

    if (!raw) {
      // Судить нечем — отдаём якорный чеклист, а не пустой «vlm-judge»,
      // который раньше выглядел как проведённая проверка.
      s.qc = emptyQcReport();
      s.qc.method = "manual";
      p.updatedAt = nowIso();
      saveProject(p);
      return res.json({
        qc: s.qc,
        anchors: REALISM_ANCHORS,
        threshold: acceptThreshold(),
        judgePrompt: s.resultUrl ? buildJudgePrompt(REALISM_CRITERIA, s) : null,
        vlm: { configured: vlmJudgeConfigured(), model: vlmJudgeModel(), note: "Платный вызов. Запуск: POST {\"judge\":true}" },
        note: s.resultUrl
          ? "Рендер есть. Пришли оценки в POST {scores:[{id,score:1-5|null,note}]} — от VLM по judgePrompt или от человека по якорям."
          : "Рендера ещё нет: чеклист с якорями для ручной проверки.",
      });
    }

    const { criteria, verdict } = scoreCriteria(REALISM_CRITERIA, raw);
    s.qc = {
      totalScore: verdict.totalScore,
      method: req.body?.method === "manual" ? "manual" : "vlm-judge",
      criteria,
      checkedAt: nowIso(),
      verdict,
    };
    p.updatedAt = nowIso();
    saveProject(p);

    // Перегенерация — это деньги. По умолчанию отдаём рекомендацию, а не жжём
    // бюджет молча; авто-режим включается явно и ограничен по попыткам.
    const policy = verdict.verdict === "regenerate" ? autoRegenPolicy(s.qcAttempts || 0) : null;
    res.json({
      qc: s.qc,
      threshold: acceptThreshold(),
      autoRegen: policy,
      judgeNote,
      note:
        verdict.verdict === "pass"
          ? `Кадр принят: ${(verdict.totalScore as number).toFixed(2)} ≥ ${acceptThreshold()}.`
          : verdict.verdict === "regenerate"
            ? `Ниже порога (${(verdict.totalScore as number).toFixed(2)} < ${acceptThreshold()}). Слабее всего: ${verdict.weakest.map((w) => w.id).join(", ")}. ${policy?.reason ?? ""}`
            : `Оценено ${verdict.judgedCriteria} из ${REALISM_CRITERIA.length} критериев — этого мало для вердикта.`,
    });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "qc failed" }); }
});

qrealRouter.post("/projects/:id/assemble", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    const r = await assembleFilm(p);
    if (!r.ok) {
      const noFfmpeg = /ENOENT/i.test(r.error);
      return res.status(noFfmpeg ? 501 : 422).json({
        error: noFfmpeg ? "ffmpeg_unavailable" : "assemble_failed",
        message: noFfmpeg
          ? "FFmpeg недоступен на этом сервере — сборка фильма пока только в окружении с ffmpeg."
          : r.error,
      });
    }
    p.filmPath = r.filmPath;
    p.assembledAt = nowIso();
    p.status = "done";
    p.updatedAt = nowIso();
    saveProject(p);
    res.json({ ok: true, filmUrl: `/api/qreal/projects/${p.id}/film`, disclosure: AI_DISCLOSURE_META });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "assemble failed" }); }
});

qrealRouter.get("/projects/:id/film", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    // Ленивый re-assemble: /tmp не переживает рестарт контейнера, а кадры
    // живут в CDN движка — пересборка бесплатна. /film само-восстанавливается.
    if ((!p.filmPath || !fs.existsSync(p.filmPath)) && p.shots.length && p.shots.every((s) => s.resultUrl)) {
      const r = await assembleFilm(p);
      if (r.ok) {
        p.filmPath = r.filmPath;
        p.assembledAt = nowIso();
        p.updatedAt = nowIso();
        saveProject(p);
      }
    }
    if (!p.filmPath || !fs.existsSync(p.filmPath)) return res.status(404).json({ error: "film not assembled" });
    const stat = fs.statSync(p.filmPath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Disposition", `inline; filename="qreal-${p.id}.mp4"`);
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    if (range && (range[1] || range[2])) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || end < start) {
        res.setHeader("Content-Range", `bytes */${stat.size}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", end - start + 1);
      return fs.createReadStream(p.filmPath, { start, end }).pipe(res);
    }
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(p.filmPath).pipe(res);
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "film failed" }); }
});

// «Создал → защитил»: провенанс-манифест уходит объектом в QRight —
// первый живой мост контента в Trust Graph платформы.
qrealRouter.post("/projects/:id/register", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    if (p.qrightObjectId) {
      return res.json({ ok: true, qrightObjectId: p.qrightObjectId, alreadyRegistered: true });
    }
    const manifest = provenanceManifest(p);
    const auth = verifyBearerOptional(req);
    const objectId = uid();
    await pool.query(`CREATE TABLE IF NOT EXISTS "QRightObject" (
      "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
      "kind" TEXT NOT NULL, "contentHash" TEXT NOT NULL,
      "ownerName" TEXT, "ownerEmail" TEXT, "ownerUserId" TEXT,
      "country" TEXT, "city" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    await pool.query(
      `INSERT INTO "QRightObject" ("id","title","description","kind","contentHash","ownerUserId")
       VALUES ($1,$2,$3,'ai-video',$4,$5)`,
      [
        objectId,
        p.title.slice(0, 200),
        `AEVION QReal film. AI-generated (${manifest.standard}). Shots: ${p.shots.length}. Brief: ${p.brief.slice(0, 300)}`,
        manifest.sha256,
        auth?.sub || p.userId,
      ]
    );
    p.qrightObjectId = objectId;
    p.updatedAt = nowIso();
    saveProject(p);
    res.status(201).json({ ok: true, qrightObjectId: objectId, contentHash: manifest.sha256, link: "/qright" });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "register failed" }); }
});

qrealRouter.get("/projects/:id/provenance", (req, res) => {
  const p = memProjects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json({ provenance: provenanceManifest(p) });
});
