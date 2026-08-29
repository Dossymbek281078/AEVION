import { Router } from "express";
import { pgIntId } from "../lib/queryNumber";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { requesterId } from "../lib/devhubGuest";
import { noteEmailSent } from "../lib/brevoQuota";
// Ограничитель дорогих ручек. Тот же помощник, что стоит на 27 соседних ручках в
// коммите d9cc19ce0 (28.07) — он ждёт мержа 22 дня, поэтому здесь пока только две
// ручки, которые тогда пропустили: /ask и /media/upload-image.
import { rateLimit } from "../lib/rateLimit";

/**
 * Предел для дорогих ручек этого модуля.
 *
 * Намеренно НЕ новый экспорт в lib: коммит d9cc19ce0 (28.07) вводит там
 * `generationLimit` и переводит на него 27 ручек, но ждёт мержа 22 дня. Свой
 * одноимённый помощник поспорил бы с ним при сведении, а локальная функция — нет.
 * Когда тот коммит придёт, эти два вызова заменяются на `generationLimit(...)`.
 *
 * Значение берётся из той же переменной, что и у него, чтобы поведение совпало.
 */
function dhCostlyLimit(keyPrefix: string) {
  const raw = Number(process.env.GENERATION_RATE_LIMIT);
  // Тернарник ВЫНЕСЕН из объекта намеренно. Внутри литерала опций
  // `raw > 0 ? raw : 30` выглядит для разборщика как поле «raw: 30», и сторож
  // rateLimitOptionsGuard справедливо по своему шаблону, но ложно по смыслу
  // сообщил о «лишней опции raw». Заодно читается лучше.
  const max = Number.isFinite(raw) && raw > 0 ? raw : 30;
  return rateLimit({
    windowMs: 60_000,
    max,
    keyPrefix,
    message: "Слишком много запросов к генерации. Подождите минуту.",
  });
}
import { getPool } from "../lib/dbPool";
import { ensureDevHubTables, isDevHubDbReady } from "../lib/ensureDevHubTables";
import { callProvider, getProviders, type ChatImage } from "../services/qcoreai/providers";
import { extractJsonObject, salvageCompleteArrayObjects } from "../services/qcoreai/jsonReply";
import { smartComplete } from "../services/qcoreai/smartComplete";
import { applyHealth, noteProviderFailure, noteProviderSuccess } from "../lib/providerHealth";
import { captureException } from "../lib/sentry";
import { degraded } from "../lib/degradedResponse";
import { classifyGithubResponse, githubUnreachable } from "../lib/githubFailure";
import { validateGeneratedFiles } from "../lib/syntaxCheck";
import { deployViaWrangler, warmWrangler } from "../lib/wranglerPagesDeploy";
import { checkPublicUrl } from "../lib/publicUrlOnly";

export const devhubRouter = Router();

/**
 * Предел на ОТПРАВЛЯЮЩИЕ ручки — одним объявлением, а не по одной.
 *
 * Что закрывает: аноним мог отправлять письма, SMS и сообщения WhatsApp с нашего
 * аккаунта произвольным получателям, без предела. Это не «дорого», это возможность
 * рассылать спам нашим именем, и от продуктового вопроса «DevHub — продукт или
 * внутренний инструмент» она не зависит: посторонним нельзя ни в одном из ответов.
 *
 * Почему списком, а не построчно у каждой ручки: коммит d9cc19ce0 (28.07) ставит
 * ограничитель ровно этим ручкам построчно и ждёт мержа 22 дня. Правка в те же
 * строки дала бы конфликт на его патче; отдельное объявление — нет. Когда он
 * придёт, оба предела просто сложатся, и это безвредно (сработает строгий).
 *
 * Ограничитель, а НЕ авторизация: авторизация решает, КОМУ можно, и это решение
 * основателя. Предел не решает ничего — он лишь не даёт злоупотреблять.
 *
 * Стоит ДО объявления маршрутов намеренно: express выполняет middleware в порядке
 * регистрации, и ниже маршрутов он бы не сработал вовсе.
 */
/**
 * Предел для отправки СТРОЖЕ, чем для генерации, и вот почему числом.
 *
 * Первая версия ставила здесь общий `dhCostlyLimit` — 30 в минуту. Это оказалось
 * слишком много: у Brevo на текущем плане потолок **300 писем в сутки** (записано
 * в CLAUDE.md окна запуска). То есть один адрес выжигал бы всю суточную квоту
 * платформы за десять минут, и подтверждения подписки перестали бы приходить
 * ВСЕМ — включая тех, кого мы ждём после запуска.
 *
 * Пять в минуту: своё приложение проверить хватает с запасом, а суточную квоту с
 * одного адреса так не выбрать (5 × 60 × 24 упирается в квоту у провайдера, а не
 * у нас, зато первые же попытки станут видны в журнале).
 *
 * Значение отдельной переменной, чтобы менять без правки кода; но по умолчанию
 * СТРОГОЕ — защита, включающаяся только при настройке, это защита, которой нет.
 */
function dhSendLimit() {
  const raw = Number(process.env.DEVHUB_SEND_RATE_LIMIT);
  const max = Number.isFinite(raw) && raw > 0 ? raw : 5;
  return rateLimit({
    windowMs: 60_000,
    max,
    keyPrefix: "dhsend",
    message: "Слишком много отправок подряд. Подождите минуту.",
  });
}

devhubRouter.use(
  ["/media/email", "/media/email-template-send", "/media/sms", "/media/whatsapp"],
  dhSendLimit(),
);

// GET /api/devhub/health — module health probe for aevion hub
devhubRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    module: "devhub",
    db: isDevHubDbReady() ? "postgres" : "in-memory",
    timestamp: new Date().toISOString(),
  });
});

// POST /api/devhub/ask — freeform dev assistant. Routes through the platform
// smartComplete layer (auto-router: quick factual lookups → a single flagship,
// open how-do-I / explain / design questions → the weight-graded Council), and
// feeds the shared cross-module savings tally. Returns { answer, routing } so
// the caller sees the cost/route. Distinct from /projects/:id/generate, which
// emits structured code JSON; this answers questions in prose.
// `/ask` зовёт платное дополнение (smartComplete) с входом до 16 000 знаков и была
// БЕЗ ограничителя, тогда как 27 соседних дорогих ручек его получили ещё 28.07 —
// эту просто пропустили. Ограничитель, а не авторизация, выбран намеренно: он не
// решает продуктовый вопрос «кому можно», он лишь не даёт анониму жечь наш бюджет
// ИИ без предела. Ключ отдельный: общий на все генерации означал бы, что один
// модуль расходует лимит другого (см. feedback_default_that_means_share).
devhubRouter.post("/ask", dhCostlyLimit("dhask"), async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 8000) : "";
  const context = typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 8000) : "";
  if (!question) return res.status(400).json({ error: "question required" });

  const userInput = context
    ? `Context (a developer's project/code):\n${context}\n\nQuestion: ${question}`
    : question;
  try {
    const { answer, routing } = await smartComplete({ userInput }, { module: "devhub" });
    return res.json({ answer, routing });
  } catch (e: any) {
    captureException(e);
    return res.status(502).json({ error: e?.message || "ask failed" });
  }
});

const pool = getPool();

// Bootstrap tables on first use
(async () => {
  try {
    await ensureDevHubTables(pool);
  } catch (e) {
    captureException(e, { route: "devhub/bootstrap", op: "ensureDevHubTables" });
    // in-memory fallback active
  }
  // Pay wrangler's first-run cost at boot, not inside a user's deploy.
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    try { warmWrangler(); } catch { /* best-effort */ }
  }
})();

// ── In-memory fallback stores ─────────────────────────────────────────────────
interface DevHubProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  stack: string;
  status: string;
  repoUrl: string | null;
  deployUrl: string | null;
  customDomain: string | null;
  envVars: Record<string, string>;
  collaborators: Array<{ userId: string; role: string }>;
  createdAt: string;
  updatedAt: string;
}

interface DevHubFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  language: string;
  updatedAt: string;
}

interface DevHubDeployment {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  deployUrl: string | null;
  buildLog: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

interface DevHubSnippet {
  id: string;
  userId: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

// One per AI-driven multi-file write (generate_code / workflow "code" step) —
// the prior content of every file it touched (null = the file didn't exist
// before, so reverting deletes it), so the whole write can be undone in one
// shot without regenerating anything.
interface DevHubCheckpoint {
  id: string;
  projectId: string;
  userId: string;
  label: string;
  files: Array<{ path: string; priorContent: string | null }>;
  createdAt: string;
}

const memProjects = new Map<string, DevHubProject>();
const memFiles = new Map<string, DevHubFile>();
const memDeployments = new Map<string, DevHubDeployment>();
const memSnippets = new Map<string, DevHubSnippet>();
const memCheckpoints = new Map<string, DevHubCheckpoint>();

// ── Credit metering ───────────────────────────────────────────────────────────
type CapabilityKey = "video" | "image" | "tts" | "music" | "deploy";
type StudioTier = "free" | "pro" | "enterprise";

const TIER_LIMITS: Record<StudioTier, Record<CapabilityKey, number>> = {
  free:       { video: 3,   image: 10,  tts: 100000, music: 5,   deploy: 10 },
  pro:        { video: 50,  image: 200, tts: 30000, music: 100, deploy: -1 },
  enterprise: { video: -1,  image: -1,  tts: -1,    music: -1,  deploy: -1 },
};

// In-memory fallback: "userId:month:capability" → count
const memUsage = new Map<string, number>();
const memTiers = new Map<string, StudioTier>();

function creditMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getUserTier(userId: string): Promise<StudioTier> {
  if (!isDevHubDbReady()) return memTiers.get(userId) ?? "free";
  try {
    const r = await pool.query(`SELECT "tier" FROM "DevHubTier" WHERE "userId"=$1`, [userId]);
    if (r.rows[0]?.tier) return r.rows[0].tier as StudioTier;
    // Check email-based tier (set by payment webhook before user registered)
    const er = await pool.query(`
      SELECT det."tier" FROM "AEVIONUser" au
      JOIN "DevHubEmailTier" det ON det."email" = LOWER(au."email")
      WHERE au."id" = $1 LIMIT 1
    `, [userId]);
    if (er.rows[0]?.tier && er.rows[0].tier !== "free") {
      const promoted = er.rows[0].tier as StudioTier;
      // Promote to userId-keyed row so future lookups are single-table
      await pool.query(`
        INSERT INTO "DevHubTier" ("userId","tier","updatedAt") VALUES ($1,$2,NOW())
        ON CONFLICT ("userId") DO UPDATE SET "tier"=$2, "updatedAt"=NOW()
      `, [userId, promoted]).catch(() => {});
      return promoted;
    }
    return "free";
  } catch { return "free"; }
}

async function setUserTier(userId: string, tier: StudioTier): Promise<void> {
  if (!isDevHubDbReady()) { memTiers.set(userId, tier); return; }
  try {
    await pool.query(`
      INSERT INTO "DevHubTier" ("userId","tier","updatedAt") VALUES ($1,$2,NOW())
      ON CONFLICT ("userId") DO UPDATE SET "tier"=$2, "updatedAt"=NOW()
    `, [userId, tier]);
  } catch { memTiers.set(userId, tier); }
}

async function getMonthUsage(userId: string, month: string, capability: CapabilityKey): Promise<number> {
  if (!isDevHubDbReady()) return memUsage.get(`${userId}:${month}:${capability}`) ?? 0;
  try {
    const r = await pool.query(
      `SELECT "used" FROM "DevHubUsage" WHERE "userId"=$1 AND "month"=$2 AND "capability"=$3`,
      [userId, month, capability]
    );
    return r.rows[0]?.used ?? 0;
  } catch (e) {
    // ПОВЕДЕНИЕ НЕ МЕНЯЕТСЯ, меняется только видимость отказа.
    //
    // Ноль здесь — не «израсходовано ноль», а «прочитать не удалось». Он
    // уходит в checkCredit как used, и месячный предел на семь ПЛАТНЫХ ручек
    // (видео, изображения, озвучка, музыка, три места выкатки) перестаёт
    // срабатывать: 0 + amount <= limit истинно почти всегда. Пока база не
    // отвечает, генерации идут без предела, и платим за них мы.
    //
    // Направление отказа — отдельное решение, и оно продуктовое: закрыться
    // значит остановить платящего клиента при сбое базы. Разумная граница —
    // закрывать НЕОБРАТИМОЕ (расход у внешнего поставщика), а не всё подряд.
    // Здесь этого не делаю: менять денежный путь молча нельзя.
    //
    // Но молчание чинится независимо и прямо сейчас. Без этой строки отказ
    // не оставлял следа НИГДЕ: ни в журнале, ни в ответе, ни в Sentry —
    // снаружи он неотличим от честного нулевого расхода.
    console.warn(
      `[devhub/credit] расход за месяц не прочитан — предел не применяется: ` +
      `user=${userId} month=${month} capability=${capability} :: ${(e as Error)?.message ?? e}`,
    );
    return 0;
  }
}

async function checkCredit(userId: string, capability: CapabilityKey, amount = 1): Promise<{ allowed: boolean; used: number; limit: number; tier: StudioTier }> {
  const tier = await getUserTier(userId);
  const limit = TIER_LIMITS[tier][capability];
  if (limit === -1) return { allowed: true, used: 0, limit: -1, tier };
  const month = creditMonth();
  const used = await getMonthUsage(userId, month, capability);
  return { allowed: used + amount <= limit, used, limit, tier };
}

async function debitCredit(userId: string, capability: CapabilityKey, amount = 1): Promise<void> {
  const month = creditMonth();
  const tier = await getUserTier(userId);
  if (!isDevHubDbReady()) {
    const key = `${userId}:${month}:${capability}`;
    memUsage.set(key, (memUsage.get(key) ?? 0) + amount);
    return;
  }
  try {
    const id = `${userId}-${month}-${capability}`;
    await pool.query(`
      INSERT INTO "DevHubUsage" ("id","userId","month","capability","used","tier","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT ("userId","month","capability")
      DO UPDATE SET "used"="DevHubUsage"."used"+$5, "tier"=$6, "updatedAt"=NOW()
    `, [id, userId, month, capability, amount, tier]);
  } catch {
    const key = `${userId}:${month}:${capability}`;
    memUsage.set(key, (memUsage.get(key) ?? 0) + amount);
  }
}

async function getAllMonthUsage(userId: string): Promise<{ tier: StudioTier; month: string; usage: Record<CapabilityKey, { used: number; limit: number }> }> {
  const tier = await getUserTier(userId);
  const month = creditMonth();
  const caps: CapabilityKey[] = ["video", "image", "tts", "music", "deploy"];
  const usage: Record<string, { used: number; limit: number }> = {};
  for (const cap of caps) {
    const used = await getMonthUsage(userId, month, cap);
    usage[cap] = { used, limit: TIER_LIMITS[tier][cap] };
  }
  return { tier, month, usage: usage as Record<CapabilityKey, { used: number; limit: number }> };
}

// ── Deferred post-deploy work ────────────────────────────────────────────────
// Deploy routes answer immediately and then verify, seconds later, that the
// deployed URL actually serves (backend CLAUDE.md §10). Those timers outlive
// the request — and in tests they outlive the test that started them, firing
// during a later one and consuming its mocked fetch. That is what made the
// backend suite fail on a different test each run (issue #982): a real
// timing dependency, not a mystery.
//
// Prod behaviour is unchanged; the timers are merely tracked so a test can
// drop the ones still pending.
const deferredTimers = new Set<ReturnType<typeof setTimeout>>();

function deferred(fn: () => void | Promise<void>, ms: number): void {
  const t = setTimeout(() => {
    deferredTimers.delete(t);
    void fn();
  }, ms);
  // A pending timer keeps Node alive on its own. A post-deploy check should
  // never be the reason a process refuses to exit.
  t.unref?.();
  deferredTimers.add(t);
}

/** Drop post-deploy verification still waiting to run. Tests only. */
export function __clearDeferredDevHubWork() {
  for (const t of deferredTimers) clearTimeout(t);
  deferredTimers.clear();
}

// ── Exported reset helpers for tests ─────────────────────────────────────────
export function __resetDevHubStore() {
  memProjects.clear();
  memFiles.clear();
  memDeployments.clear();
  memSnippets.clear();
  memUsage.clear();
  memTiers.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "project";
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", html: "html", css: "css", json: "json", md: "markdown",
    yaml: "yaml", yml: "yaml", sh: "bash", env: "plaintext",
  };
  return map[ext] || "plaintext";
}

// ── Collaborator access helpers ───────────────────────────────────────────────
function isCollaborator(project: DevHubProject, userId: string, minRole?: "editor"): boolean {
  const entry = project.collaborators.find((c) => c.userId === userId);
  if (!entry) return false;
  if (!minRole) return true;
  return entry.role === "editor";
}
function canAccess(project: DevHubProject, userId: string): boolean {
  return project.userId === userId || isCollaborator(project, userId);
}
function canEdit(project: DevHubProject, userId: string): boolean {
  return project.userId === userId || isCollaborator(project, userId, "editor");
}

// ── Project helpers (DB or memory) ────────────────────────────────────────────
async function dbListProjects(userId: string): Promise<DevHubProject[]> {
  if (!isDevHubDbReady()) {
    return [...memProjects.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubProject" WHERE "userId"=$1 ORDER BY "updatedAt" DESC`,
    [userId]
  );
  return r.rows.map(rowToProject);
}

async function dbGetProject(id: string): Promise<DevHubProject | null> {
  if (!isDevHubDbReady()) return memProjects.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "DevHubProject" WHERE "id"=$1`, [id]);
  return r.rows[0] ? rowToProject(r.rows[0]) : null;
}

async function dbSaveProject(p: DevHubProject): Promise<void> {
  if (!isDevHubDbReady()) { memProjects.set(p.id, p); return; }
  await pool.query(
    `INSERT INTO "DevHubProject" ("id","userId","name","description","stack","status","repoUrl","deployUrl","customDomain","envVars","collaborators","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)
     ON CONFLICT ("id") DO UPDATE SET
       "name"=$3,"description"=$4,"stack"=$5,"status"=$6,"repoUrl"=$7,"deployUrl"=$8,
       "customDomain"=$9,"envVars"=$10::jsonb,"collaborators"=$11::jsonb,"updatedAt"=$13`,
    [p.id, p.userId, p.name, p.description, p.stack, p.status, p.repoUrl, p.deployUrl,
     p.customDomain, JSON.stringify(p.envVars), JSON.stringify(p.collaborators), p.createdAt, p.updatedAt]
  );
}

async function dbDeleteProject(id: string): Promise<void> {
  if (!isDevHubDbReady()) {
    memProjects.delete(id);
    for (const [fid, f] of memFiles) { if (f.projectId === id) memFiles.delete(fid); }
    return;
  }
  await pool.query(`DELETE FROM "DevHubFile" WHERE "projectId"=$1`, [id]);
  await pool.query(`DELETE FROM "DevHubProject" WHERE "id"=$1`, [id]);
}

function rowToProject(row: any): DevHubProject {
  return {
    id: row.id, userId: row.userId, name: row.name, description: row.description,
    stack: row.stack, status: row.status, repoUrl: row.repoUrl, deployUrl: row.deployUrl,
    customDomain: row.customDomain, envVars: row.envVars || {},
    collaborators: row.collaborators || [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

// ── File helpers ──────────────────────────────────────────────────────────────
async function dbListFiles(projectId: string): Promise<DevHubFile[]> {
  if (!isDevHubDbReady()) {
    return [...memFiles.values()]
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => a.path.localeCompare(b.path));
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubFile" WHERE "projectId"=$1 ORDER BY "path" ASC`,
    [projectId]
  );
  return r.rows.map(rowToFile);
}

async function dbGetFile(projectId: string, path: string): Promise<DevHubFile | null> {
  if (!isDevHubDbReady()) {
    return [...memFiles.values()].find((f) => f.projectId === projectId && f.path === path) ?? null;
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubFile" WHERE "projectId"=$1 AND "path"=$2`,
    [projectId, path]
  );
  return r.rows[0] ? rowToFile(r.rows[0]) : null;
}

async function dbUpsertFile(f: DevHubFile): Promise<void> {
  if (!isDevHubDbReady()) {
    // Same "update existing by (projectId, path), else insert" contract as the
    // DB branch below — `f.id` is a freshly minted UUID on every call (the
    // caller doesn't know if the file already exists), so keying memFiles by
    // f.id here would create a duplicate entry per write instead of updating
    // the file: a stale, superseded version would sit in the map forever, and
    // dbGetFile's `.find()` would keep returning whichever one it inserted
    // first — a real "write looks like it worked, next read returns the old
    // content" bug, not just a memory-fallback formality.
    const existing = [...memFiles.values()].find((x) => x.projectId === f.projectId && x.path === f.path);
    if (existing) {
      existing.content = f.content;
      existing.language = f.language;
      existing.updatedAt = f.updatedAt;
    } else {
      memFiles.set(f.id, f);
    }
    return;
  }
  // try to update existing by (projectId, path)
  const existing = await pool.query(
    `SELECT "id" FROM "DevHubFile" WHERE "projectId"=$1 AND "path"=$2`,
    [f.projectId, f.path]
  );
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE "DevHubFile" SET "content"=$1,"language"=$2,"updatedAt"=$3 WHERE "id"=$4`,
      [f.content, f.language, f.updatedAt, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO "DevHubFile" ("id","projectId","path","content","language","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [f.id, f.projectId, f.path, f.content, f.language, f.updatedAt]
    );
  }
}

async function dbDeleteFile(projectId: string, path: string): Promise<void> {
  if (!isDevHubDbReady()) {
    for (const [fid, f] of memFiles) {
      if (f.projectId === projectId && f.path === path) { memFiles.delete(fid); break; }
    }
    return;
  }
  await pool.query(
    `DELETE FROM "DevHubFile" WHERE "projectId"=$1 AND "path"=$2`,
    [projectId, path]
  );
}

function rowToFile(row: any): DevHubFile {
  return {
    id: row.id, projectId: row.projectId, path: row.path,
    content: row.content, language: row.language,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

// ── Deployment helpers ────────────────────────────────────────────────────────
async function dbSaveDeployment(d: DevHubDeployment): Promise<void> {
  if (!isDevHubDbReady()) { memDeployments.set(d.id, d); return; }
  await pool.query(
    `INSERT INTO "DevHubDeployment" ("id","projectId","userId","status","deployUrl","buildLog","triggeredAt","completedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ("id") DO UPDATE SET
       "status"=$4,"deployUrl"=$5,"buildLog"=$6,"completedAt"=$8`,
    [d.id, d.projectId, d.userId, d.status, d.deployUrl, d.buildLog, d.triggeredAt, d.completedAt]
  );
}

async function dbListDeployments(projectId: string, limit = 10): Promise<DevHubDeployment[]> {
  if (!isDevHubDbReady()) {
    return [...memDeployments.values()]
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
      .slice(0, limit);
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubDeployment" WHERE "projectId"=$1 ORDER BY "triggeredAt" DESC LIMIT $2`,
    [projectId, limit]
  );
  return r.rows.map(rowToDeployment);
}

function rowToDeployment(row: any): DevHubDeployment {
  return {
    id: row.id, projectId: row.projectId, userId: row.userId, status: row.status,
    deployUrl: row.deployUrl, buildLog: row.buildLog,
    triggeredAt: row.triggeredAt instanceof Date ? row.triggeredAt.toISOString() : row.triggeredAt,
    completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt ?? null,
  };
}

// ── Checkpoint helpers ──────────────────────────────────────────────────────────
async function dbSaveCheckpoint(c: DevHubCheckpoint): Promise<void> {
  if (!isDevHubDbReady()) { memCheckpoints.set(c.id, c); return; }
  await pool.query(
    `INSERT INTO "DevHubCheckpoint" ("id","projectId","userId","label","files","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [c.id, c.projectId, c.userId, c.label, JSON.stringify(c.files), c.createdAt]
  );
}

async function dbLatestCheckpoint(projectId: string): Promise<DevHubCheckpoint | null> {
  if (!isDevHubDbReady()) {
    const latest = [...memCheckpoints.values()]
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest ?? null;
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubCheckpoint" WHERE "projectId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [projectId]
  );
  return r.rows[0] ? rowToCheckpoint(r.rows[0]) : null;
}

async function dbDeleteCheckpoint(id: string): Promise<void> {
  if (!isDevHubDbReady()) { memCheckpoints.delete(id); return; }
  await pool.query(`DELETE FROM "DevHubCheckpoint" WHERE "id"=$1`, [id]);
}

/** Newest-first, for the checkpoint-history UI and for restore-to-a-specific-
 * point (which walks this list from the top through the chosen entry). */
async function dbListCheckpoints(projectId: string, limit = 20): Promise<DevHubCheckpoint[]> {
  if (!isDevHubDbReady()) {
    return [...memCheckpoints.values()]
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubCheckpoint" WHERE "projectId"=$1 ORDER BY "createdAt" DESC LIMIT $2`,
    [projectId, limit]
  );
  return r.rows.map(rowToCheckpoint);
}

function rowToCheckpoint(row: any): DevHubCheckpoint {
  return {
    id: row.id, projectId: row.projectId, userId: row.userId, label: row.label,
    files: typeof row.files === "string" ? JSON.parse(row.files) : row.files,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

/** Snapshot the prior content of every file a generate_code write is about to
 * touch, so it can be undone in one shot. `existingFiles` is the same
 * project-file list already loaded for prompt context — no extra DB round trip. */
async function createCheckpoint(
  projectId: string,
  userId: string,
  label: string,
  targetPaths: string[],
  existingFiles: Array<{ path: string; content: string }>
): Promise<string | null> {
  if (targetPaths.length === 0) return null;
  const checkpoint: DevHubCheckpoint = {
    id: crypto.randomUUID(),
    projectId,
    userId,
    label,
    files: targetPaths.map((path) => ({
      path,
      priorContent: existingFiles.find((f) => f.path === path)?.content ?? null,
    })),
    createdAt: now(),
  };
  try { await dbSaveCheckpoint(checkpoint); } catch { memCheckpoints.set(checkpoint.id, checkpoint); }
  return checkpoint.id;
}

/** Reverts every file a single checkpoint touched to its prior content (or
 * deletes it, if the checkpoint recorded "didn't exist before"), then
 * consumes (deletes) the checkpoint. Shared by /generate/undo (always just
 * the latest checkpoint) and /checkpoints/:id/restore (applies a whole run
 * of consecutive checkpoints, newest first, so per-path writes converge on
 * the target checkpoint's own priorContent — the correct layered result). */
async function applyCheckpointRevert(projectId: string, checkpoint: DevHubCheckpoint): Promise<string[]> {
  const revertedFiles: string[] = [];
  for (const f of checkpoint.files) {
    if (f.priorContent === null) {
      try { await dbDeleteFile(projectId, f.path); }
      catch {
        for (const [fid, mf] of memFiles) {
          if (mf.projectId === projectId && mf.path === f.path) { memFiles.delete(fid); break; }
        }
      }
    } else {
      const restored: DevHubFile = {
        id: crypto.randomUUID(), projectId, path: f.path,
        content: f.priorContent, language: detectLanguage(f.path), updatedAt: now(),
      };
      try { await dbUpsertFile(restored); }
      catch {
        const existing = [...memFiles.values()].find((x) => x.projectId === projectId && x.path === f.path);
        if (existing) { existing.content = restored.content; existing.updatedAt = restored.updatedAt; }
        else memFiles.set(restored.id, restored);
      }
    }
    revertedFiles.push(f.path);
  }
  try { await dbDeleteCheckpoint(checkpoint.id); } catch { memCheckpoints.delete(checkpoint.id); }
  return revertedFiles;
}

// ── Built-in templates ────────────────────────────────────────────────────────
// Экспортируется ради проверки запускаемости начал: тест смотрит, есть ли у каждого
// точка входа своего стека и настроено ли то, чем оно собирается. Замер 19.08.2026
// показал, что у react-spa не было index.html — «готовое начало» не начиналось.
export const TEMPLATES = [
  {
    id: "next-app",
    name: "Next.js App",
    description: "Full-stack React with API routes",
    stack: "next",
    files: [
      {
        path: "pages/index.tsx",
        language: "typescript",
        content: `export default function Home() {\n  return (\n    <div style={{ fontFamily: "system-ui", padding: 40 }}>\n      <h1>Hello from Next.js</h1>\n      <p>Edit pages/index.tsx to get started</p>\n    </div>\n  );\n}\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-next-app", version: "0.1.0", scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "^14.0.0", react: "^18.0.0", "react-dom": "^18.0.0" } }, null, 2),
      },
      {
        path: "tsconfig.json",
        language: "json",
        content: JSON.stringify({ compilerOptions: { target: "es5", lib: ["dom", "esnext"], allowJs: true, strict: true, moduleResolution: "bundler", jsx: "preserve" } }, null, 2),
      },
    ],
  },
  {
    id: "express-api",
    name: "Express API",
    description: "REST API with TypeScript",
    stack: "express",
    files: [
      {
        path: "src/index.ts",
        language: "typescript",
        content: `import express from "express";\nconst app = express();\napp.use(express.json());\n\napp.get("/health", (_req, res) => res.json({ status: "ok" }));\n\napp.get("/api/hello", (_req, res) => {\n  res.json({ message: "Hello from Express API!" });\n});\n\napp.listen(4000, () => console.log("API running on port 4000"));\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-express-api", version: "0.1.0", scripts: { dev: "ts-node-dev src/index.ts", build: "tsc", start: "node dist/index.js" }, dependencies: { express: "^4.18.0" }, devDependencies: { typescript: "^5.0.0", "@types/express": "^4.17.0", "ts-node-dev": "^2.0.0" } }, null, 2),
      },
      // tsconfig.json добавлен 19.08.2026 вместе с зависимостью ts-node-dev: у этого
      // начала было ТРИ связанных дефекта, и каждый ломал свой шаг.
      //
      //   dev   зовёт ts-node-dev, а его не было в devDependencies — «команда не найдена»;
      //   build зовёт tsc без tsconfig — компилировалось бы рядом с исходником;
      //   start ждёт dist/index.js, которого такая сборка не создаёт вовсе.
      //
      // То есть «готовое начало» не проходило ни одного своего шага.
      {
        path: "tsconfig.json",
        language: "json",
        content: JSON.stringify({ compilerOptions: { target: "ES2020", module: "commonjs", outDir: "dist", rootDir: "src", strict: true, esModuleInterop: true, skipLibCheck: true }, include: ["src"] }, null, 2),
      },
    ],
  },
  {
    id: "landing",
    name: "Landing Page",
    description: "Static HTML/CSS/JS landing page",
    stack: "static",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n  <title>My Landing</title>\n  <link rel="stylesheet" href="style.css"/>\n</head>\n<body>\n  <main class="hero">\n    <h1>Welcome</h1>\n    <p>Build something amazing.</p>\n    <a href="#" class="cta">Get Started</a>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
      },
      {
        path: "style.css",
        language: "css",
        content: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }\n.hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; padding: 40px; }\nh1 { font-size: 3rem; font-weight: 800; }\np { font-size: 1.2rem; color: #64748b; }\n.cta { display: inline-block; padding: 12px 28px; background: #0d9488; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }\n`,
      },
      {
        path: "script.js",
        language: "javascript",
        content: `document.addEventListener("DOMContentLoaded", () => {\n  console.log("Landing page loaded");\n});\n`,
      },
    ],
  },
  {
    id: "react-spa",
    name: "React SPA",
    description: "Single page app with Vite",
    stack: "react",
    files: [
      {
        path: "src/App.tsx",
        language: "typescript",
        content: `import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ fontFamily: "system-ui", textAlign: "center", padding: 40 }}>\n      <h1>React SPA</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>\n    </div>\n  );\n}\n`,
      },
      {
        path: "src/main.tsx",
        language: "typescript",
        content: `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode><App /></React.StrictMode>\n);\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-react-spa", version: "0.1.0", scripts: { dev: "vite", build: "tsc && vite build" }, dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" }, devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.0.0", typescript: "^5.0.0" } }, null, 2),
      },
      // Три файла ниже добавлены 19.08.2026: без них «готовое начало» не начиналось.
      //
      // Было `src/App.tsx`, `src/main.tsx`, `package.json` — и всё. Для Vite точка
      // входа это index.html, без него `npm run dev` не стартует вовсе. А выкатка
      // отдаёт файлы проекта как статику: без index.html на корне нечего показать, то
      // есть загрузка прошла бы, а страница не открылась. Сборка при этом зовёт `tsc`
      // без tsconfig.json, а плагин React объявлен в зависимостях, но не подключён.
      //
      // Проверено: ни в одной из шести ветвей, правящих этот файл, index.html в
      // начале react-spa нет — дефект не был починен нигде.
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n  <title>React SPA</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
      },
      {
        path: "vite.config.ts",
        language: "typescript",
        content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n`,
      },
      {
        path: "tsconfig.json",
        language: "json",
        content: JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["ES2020", "DOM", "DOM.Iterable"], module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true }, include: ["src"] }, null, 2),
      },
    ],
  },
  {
    id: "dashboard",
    name: "Analytics Dashboard",
    description: "Charts and data visualization with Next.js",
    stack: "next",
    files: [
      {
        path: "pages/index.tsx",
        language: "typescript",
        content: `import { useState, useEffect } from "react";\n\nconst MOCK = [\n  { label: "Mon", value: 42 }, { label: "Tue", value: 65 },\n  { label: "Wed", value: 38 }, { label: "Thu", value: 80 },\n  { label: "Fri", value: 55 },\n];\n\nexport default function Dashboard() {\n  const [data] = useState(MOCK);\n  const max = Math.max(...data.map(d => d.value));\n  return (\n    <div style={{ fontFamily: "system-ui", padding: 40, background: "#f8fafc", minHeight: "100vh" }}>\n      <h1 style={{ marginBottom: 24 }}>Analytics Dashboard</h1>\n      <div style={{ display: "flex", gap: 16 }}>\n        {data.map(d => (\n          <div key={d.label} style={{ textAlign: "center" }}>\n            <div style={{ width: 40, height: \`\${(d.value / max) * 200}px\`, background: "#0d9488", borderRadius: 4 }} />\n            <div style={{ marginTop: 8, fontSize: 13 }}>{d.label}</div>\n            <div style={{ fontWeight: 700 }}>{d.value}</div>\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-dashboard", version: "0.1.0", scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "^14.0.0", react: "^18.0.0", "react-dom": "^18.0.0" } }, null, 2),
      },
    ],
  },
];

// ── AI code generation helper ─────────────────────────────────────────────────
interface GeneratedCodeResult {
  files: Array<{ path: string; content: string; language: string }>;
  aiGenerated: boolean; // false = no provider configured / call failed, caller got a placeholder stub
  // Present when the model's reply hit the token cap mid-write: complete files
  // were salvaged and one continuation call fetched (or tried to fetch) the
  // rest. Surfaces in the chat as an honest process note, not hidden.
  continued?: boolean;
  // Present (non-empty) only when a generated JS/TS/JSON file STILL fails a
  // syntax check after self-correction was attempted — the file is still
  // written (the model may have gotten close, and an empty diff is worse
  // than a broken-but-visible one), but callers get an honest signal instead
  // of a plain success for code that won't run.
  syntaxErrors?: Array<{ path: string; errors: string[] }>;
  // Present when the first attempt had syntax errors and a self-correction
  // retry fixed them — an honest "it wasn't perfect on try one" signal
  // distinct from a clean first-pass success, without being a failure either.
  selfCorrected?: number;
}

/** Extract the {"files":[...]} shape a generation call was asked for, with
 * the same "not valid JSON → treat the whole reply as one file" fallback on
 * both the first attempt and any self-correction retry. */
type ParsedGeneration = { files: Array<{ path: string; content: string; language: string }>; mode: "parsed" | "salvaged" | "fallback" };

function parseGeneratedFiles(reply: string, targetFiles: string[]): ParsedGeneration {
  // Extraction + truncation salvage live in the shared qcoreai/jsonReply
  // module now — this wrapper just maps the result onto DevHub's file shape.
  const raw = reply.trim();
  const parsedObj = extractJsonObject(raw) as { files?: unknown } | null;
  if (parsedObj && Array.isArray(parsedObj.files) && parsedObj.files.length > 0) {
    return {
      mode: "parsed",
      files: parsedObj.files.map((f: any) => ({
        path: String(f.path || "output.ts"),
        content: String(f.content || ""),
        language: String(f.language || detectLanguage(f.path || "")),
      })),
    };
  }
  // Truncation salvage: max_tokens can cut a reply mid-string (seen live —
  // 8.8KB reply ending inside a CSS value). Complete file objects are still
  // recoverable; the cut-off tail is dropped.
  const salvaged = salvageCompleteArrayObjects(raw, "files")
    .filter((o): o is { path: string; content: string; language?: string } =>
      !!o && typeof (o as any).path === "string" && typeof (o as any).content === "string")
    .map((o) => ({ path: o.path, content: o.content, language: String(o.language || detectLanguage(o.path)) }));
  if (salvaged.length > 0) return { files: salvaged, mode: "salvaged" };
  // Raw-dump fallback = a broken first impression for the user. Make every
  // occurrence visible in monitoring instead of waiting for someone to open
  // the file (that manual read is exactly how the truncation bug was found —
  // turn the accident into telemetry).
  captureException(new Error("devhub generate: reply unparseable, raw-dump fallback"), {
    route: "devhub/generate:parse", replyLength: reply.length, replyHead: reply.slice(0, 200),
  });
  const path = targetFiles[0] || "output.ts";
  return { files: [{ path, content: reply, language: detectLanguage(path) }], mode: "fallback" };
}


const MAX_SYNTAX_FIX_ATTEMPTS = 1;

/** Cap how much existing-project context rides in the prompt — enough for the
 * model to fit in, not enough to blow the context budget on a big project. */
const CONTEXT_MAX_FILES = 60;
const CONTEXT_MAX_FILE_CHARS = 8000;
const CONTEXT_MAX_FILE_CHARS_MULTI = 4000; // smaller per-file cap once several files are inlined at once
const CONTEXT_MAX_TARGET_FILES = 5; // coordinated multi-file edits stop inlining full content beyond this

/** Describe the project's existing files so generation edits in place / matches
 * conventions instead of overwriting blind. Empty string for a fresh project.
 * Inlines the current content of every targetFile that already exists, so a
 * multi-file request (e.g. an API route + the page that calls it) can see
 * both files at once and keep them consistent with each other. */
function buildFileContext(existingFiles: Array<{ path: string; content: string }>, targetFiles: string[] = []): string {
  if (existingFiles.length === 0) return "";
  const paths = existingFiles.slice(0, CONTEXT_MAX_FILES).map((f) => `- ${f.path}`).join("\n");
  const more = existingFiles.length > CONTEXT_MAX_FILES ? `\n- …and ${existingFiles.length - CONTEXT_MAX_FILES} more files` : "";
  let ctx = `\n\nExisting project files (match their conventions — imports, style, naming):\n${paths}${more}`;
  const perFileCap = targetFiles.length > 1 ? CONTEXT_MAX_FILE_CHARS_MULTI : CONTEXT_MAX_FILE_CHARS;
  for (const tf of targetFiles.slice(0, CONTEXT_MAX_TARGET_FILES)) {
    const current = existingFiles.find((f) => f.path === tf);
    if (current) {
      ctx += `\n\nCurrent content of ${tf} — edit this file in place, preserving anything unrelated to the request:\n\`\`\`\n${current.content.slice(0, perFileCap)}\n\`\`\``;
    }
  }
  return ctx;
}

const VISION_PROVIDERS = new Set(["anthropic", "gemini", "openai"]);

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** Fold prior dialog turns into plain prompt text. Wire-level multi-turn
 * would fight each provider's alternation rules; text survives everywhere. */
function foldHistory(history: ChatTurn[] | undefined): string {
  if (!history?.length) return "";
  const lines = history.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`);
  return `Conversation so far (for context — the current request may refer back to it):\n${lines.join("\n")}\n\n`;
}

async function generateCodeWithAI(
  prompt: string,
  stack: string,
  targetFiles: string[] = [],
  existingFiles: Array<{ path: string; content: string }> = [],
  images?: ChatImage[],
  history?: ChatTurn[],
  onProgress?: (stage: string) => void
): Promise<GeneratedCodeResult> {
  const providers = getProviders();
  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    // Fallback — one stub PER requested file, so multi-file callers (e.g.
    // /database/design asking for schema + client) get the same shape a real
    // generation would produce, just honestly marked aiGenerated:false.
    const paths = targetFiles.length
      ? targetFiles
      : [stack === "next" ? "pages/index.tsx" : stack === "express" ? "src/index.ts" : "index.html"];
    return {
      files: paths.map((path) => ({
        path,
        content: `// Generated stub for: ${prompt}\n// Configure an AI provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) for real AI generation\n`,
        language: detectLanguage(path),
      })),
      aiGenerated: false,
    };
  }
  // A screenshot needs a vision-capable model; the first configured provider
  // may be text-only. Pick honestly or refuse — never silently drop the image.
  let provider = configured[0];
  if (images?.length) {
    const vision = configured.find((pr) => VISION_PROVIDERS.has(pr.id));
    if (!vision) {
      throw new Error("NO_VISION_PROVIDER: attach-a-screenshot needs ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY — none configured");
    }
    provider = vision;
  }

  const systemPrompt =
    targetFiles.length === 1
      ? `You are an expert developer. Generate complete, working code for a single file. When given the file's current content, edit it in place rather than starting over. Return ONLY a JSON object: {"files": [{"path": "${targetFiles[0]}", "content": "...", "language": "..."}]}. No explanation, just JSON.`
      : targetFiles.length > 1
        ? `You are an expert developer. Generate complete, working code for MULTIPLE coordinated files that must work together: ${targetFiles.join(", ")}. When given a file's current content, edit it in place rather than starting over; keep the files consistent with each other (matching imports, types, endpoint paths, function names, etc). Return ONLY a JSON object: {"files": [{"path": "...", "content": "...", "language": "..."}, ...]} with exactly one entry per requested file. No explanation, just JSON.`
        : `You are an expert developer. Generate complete, working code. When given a list of existing project files, pick a path that fits the project's existing structure and match its conventions. Any file containing JSX must use a .jsx extension (.tsx for TypeScript) — the in-browser live preview keys off the extension. Return ONLY a JSON object: {"files": [{"path": "filename", "content": "...", "language": "..."}]}. No explanation, just JSON. Generate a scaffold for the ${stack} stack.`;

  const userMsg = `${foldHistory(history)}Generate code for: ${prompt}. Stack: ${stack}.${images?.length ? " Recreate the attached screenshot/design as closely as practical (layout, colors, spacing, text)." : ""}${buildFileContext(existingFiles, targetFiles)}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMsg },
  ];

  const GEN_MAX_TOKENS = 8192;
  onProgress?.("calling_model");
  let result;
  try {
    result = await callProvider(provider.id, messages, provider.defaultModel, 0.2, images, GEN_MAX_TOKENS);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NO_VISION_PROVIDER")) throw e;
    const path = targetFiles[0] || "generated.ts";
    return {
      files: [{ path, content: `// AI generation failed — configure a provider\n// Prompt: ${prompt}\n`, language: detectLanguage(path) }],
      aiGenerated: false,
    };
  }

  let wasContinued = false;
  let parsed = parseGeneratedFiles(result.reply, targetFiles);
  // Salvage means the reply was cut off and its tail file was lost — ask the
  // model to CONTINUE with just the missing files (one attempt; completed
  // files are named so it doesn't regenerate them).
  if (parsed.mode === "salvaged") {
    onProgress?.("continuation");
    try {
      const done = parsed.files.map((f) => f.path).join(", ");
      const contMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        ...messages,
        { role: "assistant", content: result.reply },
        {
          role: "user",
          content:
            `Your reply was cut off before it finished. These files arrived complete: ${done}. ` +
            `Return ONLY a JSON object {"files":[...]} with the REMAINING files (do not repeat the completed ones). No explanation.`,
        },
      ];
      const cont = await callProvider(provider.id, contMessages, provider.defaultModel, 0.2, images, GEN_MAX_TOKENS);
      const contParsed = parseGeneratedFiles(cont.reply, []);
      if (contParsed.mode !== "fallback") {
        const have = new Set(parsed.files.map((f) => f.path));
        parsed = { mode: "parsed", files: [...parsed.files, ...contParsed.files.filter((f) => !have.has(f.path))] };
      }
    } catch { /* keep the salvaged prefix — better than losing everything */ }
    wasContinued = true;
  }
  let files = parsed.files;
  onProgress?.("syntax_check");
  let syntaxProblems = await validateGeneratedFiles(files);

  // Self-correction: a generate-then-check-then-fix loop is a well-established
  // pattern in agentic coding systems (Claude Code, SWE-agent) — a single-shot
  // reply is much weaker than one that gets to see its own mistakes. Capped at
  // MAX_SYNTAX_FIX_ATTEMPTS so a stubborn model can't loop forever on our bill.
  let selfCorrected = 0;
  while (syntaxProblems.length > 0 && selfCorrected < MAX_SYNTAX_FIX_ATTEMPTS) {
    onProgress?.("self_correcting");
    messages.push({ role: "assistant", content: result.reply });
    messages.push({
      role: "user",
      content:
        `Your last output had syntax errors:\n` +
        syntaxProblems.map((p) => `${p.path}:\n${p.errors.join("\n")}`).join("\n\n") +
        `\n\nReturn the corrected, complete files in the same JSON format. No explanation, just JSON.`,
    });
    try {
      result = await callProvider(provider.id, messages, provider.defaultModel, 0.2, images, GEN_MAX_TOKENS);
    } catch {
      break; // keep the last (still-broken) attempt rather than losing it to a retry-call failure
    }
    files = parseGeneratedFiles(result.reply, targetFiles).files;
    syntaxProblems = await validateGeneratedFiles(files);
    selfCorrected += 1;
  }

  return {
    files,
    aiGenerated: true,
    ...(wasContinued ? { continued: true } : {}),
    ...(syntaxProblems.length > 0 ? { syntaxErrors: syntaxProblems } : {}),
    ...(selfCorrected > 0 && syntaxProblems.length === 0 ? { selfCorrected } : {}),
  };
}

interface ProjectPlan {
  ok: boolean;
  aiGenerated: boolean;
  summary: string;
  targetUsers: string;
  stack: string;
  mvpFeatures: string[];
  laterFeatures: string[];
  milestones: Array<{ title: string; prompt: string }>;
  firstPrompt: string;
}

/** Turn a raw idea into a staged build plan: MVP scope, explicitly deferred
 * scope, and an ordered list of ready-to-use generate_code prompts — the
 * "help me figure out what to build, in what order" layer that sits before
 * generate_code, not a replacement for it. Works with no open project
 * (greenfield) or accounts for an existing one's files when given. */
async function planProjectWithAI(idea: string, existingFiles: Array<{ path: string; content: string }>): Promise<ProjectPlan> {
  const fallback: ProjectPlan = {
    ok: true, aiGenerated: false,
    summary: idea, targetUsers: "", stack: "next",
    mvpFeatures: [], laterFeatures: [], milestones: [],
    firstPrompt: `Build a first version of: ${idea}`,
  };
  const providers = getProviders();
  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    return { ...fallback, targetUsers: "Configure an AI provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) for a real plan." };
  }
  const provider = configured[0];

  const existingContext = existingFiles.length > 0
    ? `\n\nThis project already has these files — build on them, don't restart from scratch:\n${existingFiles.slice(0, CONTEXT_MAX_FILES).map((f) => `- ${f.path}`).join("\n")}`
    : "";
  const systemPrompt =
    `You are a pragmatic product+tech lead scoping a new build. Given a raw idea, return ONLY a JSON object ` +
    `(no explanation) with this exact shape: {"summary": "one paragraph restating the idea clearly", ` +
    `"targetUsers": "who this is for, one sentence", "stack": one of "next"|"express"|"static"|"react"|"python", ` +
    `"mvpFeatures": ["smallest ranked feature list for a working v1, most important first, 3-6 items"], ` +
    `"laterFeatures": ["explicitly deferred features, so scope doesn't creep"], ` +
    `"milestones": [{"title": "short step name", "prompt": "a ready-to-use prompt for an AI code-generation tool ` +
    `to build exactly this step"}], "firstPrompt": "the exact prompt to hand to a code generator right now, matching milestones[0]"}. ` +
    `Order milestones so each is buildable and demoable on its own before the next.`;
  const userMsg = `Idea: ${idea}${existingContext}`;

  try {
    const result = await callProvider(provider.id, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ], provider.defaultModel, 0.3);
    const parsed = extractJsonObject(result.reply) as any;
    if (!parsed) throw new Error("unparseable plan reply");
    const milestones = Array.isArray(parsed.milestones)
      ? parsed.milestones.map((m: any) => ({ title: String(m?.title || ""), prompt: String(m?.prompt || "") }))
      : [];
    return {
      ok: true,
      aiGenerated: true,
      summary: String(parsed.summary || idea),
      targetUsers: String(parsed.targetUsers || ""),
      stack: String(parsed.stack || "next"),
      mvpFeatures: Array.isArray(parsed.mvpFeatures) ? parsed.mvpFeatures.map(String) : [],
      laterFeatures: Array.isArray(parsed.laterFeatures) ? parsed.laterFeatures.map(String) : [],
      milestones,
      firstPrompt: String(parsed.firstPrompt || milestones[0]?.prompt || `Build a first version of: ${idea}`),
    };
  } catch {
    // A provider call failure or an unparseable reply is a real failure, not
    // a plan with empty fields — same honesty contract as generateCodeWithAI's
    // aiGenerated flag, just expressed as ok:false since there's no partial
    // file output worth keeping here.
    return { ...fallback, ok: false };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Projects CRUD
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects
devhubRouter.post("/projects", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const { name, description, stack = "next" } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  const validStacks = ["next", "express", "static", "react", "python"];
  const resolvedStack = validStacks.includes(stack) ? stack : "next";
  const project: DevHubProject = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim(),
    description: description ? String(description).trim() : null,
    stack: resolvedStack,
    status: "draft",
    repoUrl: null,
    deployUrl: null,
    customDomain: null,
    envVars: {},
    collaborators: [],
    createdAt: now(),
    updatedAt: now(),
  };
  // Признак хранилища. До 19.08.2026 ответ был одинаков независимо от того,
  // легло ли сохранение в базу или в память процесса: `catch` тихо клал запись
  // в Map, и человек видел успех. При следующей выкатке — а их бывает шесть в
  // сутки — проекта или файла не оказывалось.
  //
  // Здесь признак нельзя вычислить из isDbReady(): запасной путь срабатывает по
  // ИСКЛЮЧЕНИЮ, а не по флагу готовности. Поэтому локальная переменная,
  // выставляемая ровно там, где подмена и происходит.
  let storage: "db" | "memory" = "db";
  try {
    await dbSaveProject(project);
  } catch (e: any) {
    captureException(e, { route: "devhub/projects:create", projectId: project.id });
    memProjects.set(project.id, project);
    storage = "memory";
  }
  res.status(201).json({ project, storage });
});

// GET /api/devhub/projects
/** True when the project has a live deployment but its files were edited
 * after the last deploy was triggered — the deployed page is stale. */
async function computeNeedsRedeploy(project: DevHubProject): Promise<boolean> {
  if (!project.deployUrl) return false;
  try {
    const [files, deployments] = await Promise.all([
      dbListFiles(project.id),
      dbListDeployments(project.id, 1),
    ]);
    const lastDeploy = deployments[0];
    if (!lastDeploy || !files.length) return false;
    const lastEdit = files.reduce((max, f) => (f.updatedAt > max ? f.updatedAt : max), "");
    return lastEdit > lastDeploy.triggeredAt;
  } catch {
    return false; // badge is advisory — never break the list over it
  }
}

/**
 * Проект по идентификатору, принадлежащий этому пользователю, — или ответ
 * клиенту, если его нельзя было прочитать. Возвращает null, когда ответ уже
 * отправлен: вызывающему остаётся выйти.
 *
 * Заменяет блок, скопированный в 26 местах:
 *
 *   try { project = await dbGetProject(id); }
 *   catch { project = memProjects.get(id) ?? null; }
 *   if (!project || project.userId !== userId) return res.status(404)...
 *
 * Отказ базы подменялся пустой памятью (в проде она пуста), и наружу уходило
 * «project not found». Для чтения это ложь о чужой записи; для удаления хуже —
 * человек читает 404 как «уже удалено» и уходит, а проект на месте.
 *
 * Проверено положительным контролем 21.08.2026: с работающей базой PATCH и
 * DELETE отвечают 200, с падающей — 404. Значит база на пути, и её отказ
 * подменялся отсутствием записи.
 *
 * Память ниже осмысленна, когда база не настроена вовсе: тогда она И ЕСТЬ
 * хранилище, и «не найдено» честно.
 */
/**
 * Признак того, что запись легла ТОЛЬКО в память процесса.
 *
 * Форма та же, что уже принята в модуле (поле `storage` в теле), а не
 * заголовок: второй способ говорить то же самое разошёлся бы с первым при
 * следующей правке. Я успел написать заголовок и откатил.
 */
const MEMORY_NOTE = {
  storage: "memory" as const,
  warning: "Хранилище недоступно: изменение сохранено только до перезапуска сервиса.",
};

/** Ответ на отказ хранилища — один текст на весь модуль. */
function replyStorageUnavailable(res: {
  status: (code: number) => { json: (body: unknown) => unknown };
}): void {
  res.status(503).json({
    error: "storage_unavailable",
    warning:
      "Хранилище временно недоступно. Это НЕ значит, что проекта нет — " +
      "прочитать его не удалось. Повторите запрос позже.",
  });
}

/**
 * Чтение проекта, отличающее «нет такого» от «не смогли спросить».
 *
 * Проверка владельца НЕ здесь: в файле их две разновидности — `userId !==` и
 * `canAccess(project, userId)`, и сводить их в одну — отдельное решение, не
 * моё. Помощник закрывает ровно то, что было сломано одинаково везде.
 */
async function readProject(
  id: string,
): Promise<{ project: DevHubProject | null; failed: boolean }> {
  try {
    return { project: await dbGetProject(id), failed: false };
  } catch {
    return { project: memProjects.get(id) ?? null, failed: true };
  }
}

async function loadOwnedProjectOrReply(
  id: string,
  userId: string,
  // Структурный тип, а не Response из express: в этом файле имя Response уже
  // занято глобальным ответом fetch, и импорт express-версии его перекрывает.
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
): Promise<DevHubProject | null> {
  let project: DevHubProject | null;
  let readFailed = false;
  try {
    project = await dbGetProject(id);
  } catch {
    project = memProjects.get(id) ?? null;
    readFailed = true;
  }
  if (!project && readFailed) {
    replyStorageUnavailable(res);
    return null;
  }
  if (!project || project.userId !== userId) {
    res.status(404).json({ error: "project not found" });
    return null;
  }
  return project;
}

devhubRouter.get("/projects", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  try {
    const projects = await dbListProjects(userId);
    const flags = await Promise.all(projects.map(computeNeedsRedeploy));
    res.json({ projects: projects.map((p, i) => ({ ...p, needsRedeploy: flags[i] })), total: projects.length });
  } catch (e: any) {
    captureException(e, { route: "devhub/projects:list", userId });
    // Раньше отсюда уходил список из запасной памяти — в проде пустой, — и
    // человек читал «у вас нет проектов». Ответ 200 с пустым списком не тревожит
    // никого: ни Sentry (ошибка проглочена выше), ни дежурного, ни самого
    // пользователя, который решит, что зашёл не под тем аккаунтом.
    //
    // Признак хранилища тут не спасает: страница показала бы «сохранено в
    // памяти» рядом с пустотой, а пустота и есть неверный ответ.
    const projects = [...memProjects.values()].filter((p) => p.userId === userId);
    if (projects.length === 0) {
      res.status(503).json({
        error: "storage_unavailable",
        warning:
          "Хранилище временно недоступно. Это НЕ значит, что проектов нет — " +
          "список не удалось получить. Повторите запрос позже.",
      });
      return;
    }
    // В памяти что-то есть (dev-режим или свежие правки этого процесса) —
    // отдаём, но честно называем источник.
    res.json({ projects, total: projects.length, storage: "memory" });
  }
});

// GET /api/devhub/projects/:id
devhubRouter.get("/projects/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  try {
    const project = await dbGetProject(req.params.id);
    if (!project || !canAccess(project, userId)) {
      return res.status(404).json({ error: "project not found" });
    }
    const files = await dbListFiles(project.id);
    const role = project.userId === userId ? "owner" : (project.collaborators.find(c => c.userId === userId)?.role ?? "viewer");
    res.json({ project, files, role });
  } catch (e: any) {
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /api/devhub/projects/:id
devhubRouter.patch("/projects/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { name, description, status, deployUrl, repoUrl, customDomain } = req.body || {};
  if (name !== undefined) project.name = String(name).trim();
  if (description !== undefined) project.description = description ? String(description).trim() : null;
  if (status !== undefined) project.status = String(status);
  if (deployUrl !== undefined) project.deployUrl = deployUrl ? String(deployUrl) : null;
  if (repoUrl !== undefined) project.repoUrl = repoUrl ? String(repoUrl) : null;
  if (customDomain !== undefined) project.customDomain = customDomain ? String(customDomain) : null;
  project.updatedAt = now();
  // Признак хранилища. До 19.08.2026 ответ был одинаков независимо от того,
  // легло ли сохранение в базу или в память процесса: `catch` тихо клал запись
  // в Map, и человек видел успех. При следующей выкатке — а их бывает шесть в
  // сутки — проекта или файла не оказывалось.
  //
  // Здесь признак нельзя вычислить из isDbReady(): запасной путь срабатывает по
  // ИСКЛЮЧЕНИЮ, а не по флагу готовности. Поэтому локальная переменная,
  // выставляемая ровно там, где подмена и происходит.
  let storage: "db" | "memory" = "db";
  try {
    await dbSaveProject(project);
  } catch (e) {
    captureException(e, { route: "devhub/projects:update", projectId: project.id });
    memProjects.set(project.id, project);
    storage = "memory";
  }
  res.json({ project, storage });
});

// DELETE /api/devhub/projects/:id
devhubRouter.delete("/projects/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  // Drop the project's database FIRST. A deleted project whose schema and
  // login role survive is worse than a leak: live credentials pointing at data
  // nobody owns any more, and nothing left in the UI to clean them up with.
  let databaseDropped: boolean | undefined;
  let databaseDropError: string | undefined;
  if (process.env.DEVHUB_DB_ADMIN_URL && project.envVars?.DATABASE_URL) {
    try {
      const { deprovisionProjectDatabase } = await import("../lib/devhubDbProvision");
      const dropped = await deprovisionProjectDatabase({ projectId: project.id });
      databaseDropped = dropped.ok;
      if (!dropped.ok) databaseDropError = dropped.error;
    } catch (e) {
      databaseDropped = false;
      databaseDropError = e instanceof Error ? e.message : String(e);
    }
    if (databaseDropped === false) {
      // Deleting the project anyway would orphan the schema with no way back
      // to it, so this fails loudly instead.
      captureException(new Error(`devhub: database deprovision failed: ${databaseDropError}`), {
        route: "devhub/projects:delete",
        projectId: project.id,
      });
      return res.status(502).json({
        error: `project not deleted — its database could not be dropped: ${databaseDropError}`,
        hint: "retry, or drop it explicitly with DELETE /projects/:id/database first",
      });
    }
  }

  // Same reasoning as the database above, with a bill attached: the project's
  // Railway service keeps running the user's code with the user's env on a
  // live domain, and once the project row is gone nothing points at it.
  let serviceDeleted: boolean | undefined;
  const orphanServiceId = project.envVars?.RAILWAY_SERVICE_ID;
  if (orphanServiceId && process.env.RAILWAY_API_TOKEN && process.env.DEVHUB_RAILWAY_PER_PROJECT) {
    let dropError: string | undefined;
    try {
      const { deleteProjectService } = await import("../lib/devhubRailwayDeploy");
      const dropped = await deleteProjectService({ serviceId: orphanServiceId });
      serviceDeleted = dropped.ok;
      if (!dropped.ok) dropError = dropped.error;
    } catch (e) {
      serviceDeleted = false;
      dropError = e instanceof Error ? e.message : String(e);
    }
    if (serviceDeleted === false) {
      captureException(new Error(`devhub: railway service delete failed: ${dropError}`), {
        route: "devhub/projects:delete",
        projectId: project.id,
      });
      return res.status(502).json({
        error: `project not deleted — its Railway service could not be removed: ${dropError}`,
        serviceId: orphanServiceId,
        hint: "retry, or delete that service in the Railway dashboard first — deleting the project now would leave it running and billable with nothing pointing at it",
      });
    }
  }

  try {
    await dbDeleteProject(req.params.id);
  } catch (e) {
    captureException(e, { route: "devhub/projects:delete", projectId: req.params.id });
    memProjects.delete(req.params.id);
    for (const [fid, f] of memFiles) {
      if (f.projectId === req.params.id) memFiles.delete(fid);
    }
  }
  res.json({
    ok: true,
    ...(databaseDropped !== undefined ? { databaseDropped } : {}),
    ...(serviceDeleted !== undefined ? { serviceDeleted } : {}),
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Files CRUD
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/files
devhubRouter.get("/projects/:id/files", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canAccess(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const files = await dbListFiles(req.params.id);
    res.json({ files });
  } catch {
    // Пустая память в проде превращала отказ в «проект без файлов» — человек
    // видит свою работу исчезнувшей после операции, которая всего лишь не
    // смогла прочитать список.
    const files = [...memFiles.values()].filter((f) => f.projectId === req.params.id);
    if (files.length === 0) return replyStorageUnavailable(res);
    res.json({ files, storage: "memory" });
  }
});

// GET /api/devhub/projects/:id/files/:filepath — get file by path
devhubRouter.get("/projects/:id/files/:filepath", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = req.params.filepath || "";
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canAccess(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const file = await dbGetFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "file not found" });
    res.json({ file });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/devhub/projects/:id/file — get file content by path in query string
devhubRouter.get("/projects/:id/file", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = String(req.query.path || "");
  if (!filePath) return res.status(400).json({ error: "path query param required" });
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canAccess(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const file = await dbGetFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "file not found" });
    res.json({ file });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// PUT /api/devhub/projects/:id/file — upsert file; path in body or query
devhubRouter.put("/projects/:id/file", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = String(req.body?.path || req.query.path || "");
  if (!filePath) return res.status(400).json({ error: "file path required" });
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canEdit(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  const { content = "", language } = req.body || {};
  const file: DevHubFile = {
    id: crypto.randomUUID(),
    projectId: req.params.id,
    path: filePath,
    content: String(content),
    language: language ? String(language) : detectLanguage(filePath),
    updatedAt: now(),
  };
  // Тот же признак: файл при отказе базы уходит в память, и до 19.08.2026
  // ответ был неотличим от настоящего сохранения. Для DevHub это код, который
  // человек написал и считает сохранённым.
  let storage: "db" | "memory" = "db";
  try {
    await dbUpsertFile(file);
  } catch (e) {
    captureException(e, { route: "devhub/files:put", projectId: req.params.id, path: filePath });
    const existing = [...memFiles.values()].find((f) => f.projectId === req.params.id && f.path === filePath);
    if (existing) {
      existing.content = file.content;
      existing.language = file.language;
      existing.updatedAt = file.updatedAt;
    } else {
      memFiles.set(file.id, file);
    }
    storage = "memory";
  }
  res.json({ file, storage });
});

// PUT /api/devhub/projects/:id/files/:filepath — upsert file with simple single-segment path
devhubRouter.put("/projects/:id/files/:filepath", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = req.params.filepath || "";
  if (!filePath) return res.status(400).json({ error: "file path required" });
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canEdit(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  const { content = "", language } = req.body || {};
  const file: DevHubFile = {
    id: crypto.randomUUID(),
    projectId: req.params.id,
    path: filePath,
    content: String(content),
    language: language ? String(language) : detectLanguage(filePath),
    updatedAt: now(),
  };
  // Тот же признак, что у соседней ручки сохранения файла: при отказе базы код
  // человека уходит в память и исчезает со следующей выкаткой.
  let storage: "db" | "memory" = "db";
  try {
    await dbUpsertFile(file);
  } catch (e) {
    captureException(e, { route: "devhub/files:putByPath", projectId: req.params.id, path: filePath });
    const existing = [...memFiles.values()].find((f) => f.projectId === req.params.id && f.path === filePath);
    if (existing) {
      existing.content = file.content;
      existing.language = file.language;
      existing.updatedAt = file.updatedAt;
    } else {
      memFiles.set(file.id, file);
    }
    storage = "memory";
  }
  res.json({ file, storage });
});

// DELETE /api/devhub/projects/:id/file — delete by path query param
devhubRouter.delete("/projects/:id/file", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = String(req.query.path || req.body?.path || "");
  if (!filePath) return res.status(400).json({ error: "path required" });
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  let removedFromDb = true;
  try {
    await dbDeleteFile(req.params.id, filePath);
  } catch {
    // Удаление из памяти НЕ равно удалению из базы. Раньше отсюда уходило
    // ok: true, и файл, оставшийся в хранилище, считался удалённым.
    removedFromDb = false;
    for (const [fid, f] of memFiles) {
      if (f.projectId === req.params.id && f.path === filePath) { memFiles.delete(fid); break; }
    }
  }
  if (!removedFromDb) return replyStorageUnavailable(res);
  res.json({ ok: true });
});

// DELETE /api/devhub/projects/:id/files/:filepath — delete single-segment file
devhubRouter.delete("/projects/:id/files/:filepath", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = req.params.filepath || "";
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  let removedFromDb = true;
  try {
    await dbDeleteFile(req.params.id, filePath);
  } catch {
    // Удаление из памяти НЕ равно удалению из базы. Раньше отсюда уходило
    // ok: true, и файл, оставшийся в хранилище, считался удалённым.
    removedFromDb = false;
    for (const [fid, f] of memFiles) {
      if (f.projectId === req.params.id && f.path === filePath) { memFiles.delete(fid); break; }
    }
  }
  if (!removedFromDb) return replyStorageUnavailable(res);
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — AI Code Generation
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/generate
devhubRouter.post("/projects/:id/generate", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { prompt, targetFile, targetFiles: targetFilesRaw, stack, imageBase64, imageMediaType, history: historyRaw } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }
  let images: ChatImage[] | undefined;
  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      return res.status(400).json({ error: "imageBase64 must be a non-empty base64 string" });
    }
    if (imageBase64.length > 7_000_000) {
      return res.status(400).json({ error: "image too large (max ~5MB)" });
    }
    const mediaType = typeof imageMediaType === "string" && imageMediaType ? imageMediaType : "image/png";
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType)) {
      return res.status(400).json({ error: "imageMediaType must be image/png, image/jpeg, image/webp or image/gif" });
    }
    images = [{ mediaType, dataBase64: imageBase64.replace(/^data:[^,]+,/, "") }];
  }
  // Prior dialog turns give follow-ups their referent ("make the button
  // blue" needs to know which button). Capped hard — context, not transcript.
  let history: ChatTurn[] | undefined;
  if (Array.isArray(historyRaw)) {
    history = historyRaw
      .filter((h: unknown): h is { role: string; text: string } =>
        !!h && typeof (h as any).role === "string" && typeof (h as any).text === "string")
      .filter((h) => h.role === "user" || h.role === "assistant")
      .slice(-8)
      .map((h) => ({ role: h.role as "user" | "assistant", text: h.text.slice(0, 500) }));
    if (history.length === 0) history = undefined;
  }
  // targetFiles (array) lets a caller request several coordinated files at once
  // (e.g. an API route + the page that calls it); targetFile (string) stays as
  // the single-file shorthand for back-compat.
  const targetFiles: string[] = Array.isArray(targetFilesRaw)
    ? targetFilesRaw.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0).map((f: string) => f.trim())
    : (typeof targetFile === "string" && targetFile.trim() ? [targetFile.trim()] : []);
  const resolvedStack = stack || project.stack;
  try {
    res.json(await runProjectGeneration(project, userId, prompt, resolvedStack, targetFiles, images, history));
  } catch (e: any) {
    if (typeof e?.message === "string" && e.message.startsWith("NO_VISION_PROVIDER")) {
      return res.status(503).json({ error: e.message.replace("NO_VISION_PROVIDER: ", "") });
    }
    res.status(500).json({ error: e?.message || "generation failed" });
  }
});

/** Shared by /generate and /database/design: generate → checkpoint → save. */
async function runProjectGeneration(project: DevHubProject, userId: string, prompt: string, stack: string, targetFiles: string[], images?: ChatImage[], history?: ChatTurn[], onProgress?: (stage: string) => void) {
  const existingFiles = await dbListFiles(project.id);
  const { files: generatedFiles, aiGenerated, continued, syntaxErrors, selfCorrected } = await generateCodeWithAI(prompt, stack, targetFiles, existingFiles, images, history, onProgress);
  onProgress?.("saving");
  const checkpointId = await createCheckpoint(project.id, userId, `AI: ${prompt.slice(0, 80)}`, generatedFiles.map((f) => f.path), existingFiles);
  for (const gf of generatedFiles) {
    const file: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path: gf.path,
      content: gf.content,
      language: gf.language || detectLanguage(gf.path),
      updatedAt: now(),
    };
    try {
      await dbUpsertFile(file);
    } catch {
      const existing = [...memFiles.values()].find((f) => f.projectId === project.id && f.path === gf.path);
      if (existing) {
        existing.content = file.content;
        existing.language = file.language;
        existing.updatedAt = file.updatedAt;
      } else {
        memFiles.set(file.id, file);
      }
    }
  }
  return {
    files: generatedFiles, aiGenerated, ...(continued ? { continued } : {}),
    ...(syntaxErrors ? { syntaxErrors } : {}), ...(selfCorrected ? { selfCorrected } : {}),
    checkpointId, projectId: project.id,
  };
}

// POST /api/devhub/projects/:id/generate/stream — the same generation as
// /generate, but with SSE status events so the 1-3 minutes of model time
// aren't a silent spinner. Events: {type:"status", stage} at each phase
// (calling_model → [continuation] → syntax_check → [self_correcting] →
// saving), then {type:"result", ...same payload as /generate} or
// {type:"error", error}. Honest stages only — every event corresponds to
// something actually happening, never a fake progress animation.
devhubRouter.post("/projects/:id/generate/stream", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { prompt, targetFile, targetFiles: targetFilesRaw, stack, imageBase64, imageMediaType, history: historyRaw } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }
  let images: ChatImage[] | undefined;
  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      return res.status(400).json({ error: "imageBase64 must be a non-empty base64 string" });
    }
    if (imageBase64.length > 7_000_000) {
      return res.status(400).json({ error: "image too large (max ~5MB)" });
    }
    const mediaType = typeof imageMediaType === "string" && imageMediaType ? imageMediaType : "image/png";
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType)) {
      return res.status(400).json({ error: "imageMediaType must be image/png, image/jpeg, image/webp or image/gif" });
    }
    images = [{ mediaType, dataBase64: imageBase64.replace(/^data:[^,]+,/, "") }];
  }
  let history: ChatTurn[] | undefined;
  if (Array.isArray(historyRaw)) {
    history = historyRaw
      .filter((h: unknown): h is { role: string; text: string } =>
        !!h && typeof (h as any).role === "string" && typeof (h as any).text === "string")
      .filter((h) => h.role === "user" || h.role === "assistant")
      .slice(-8)
      .map((h) => ({ role: h.role as "user" | "assistant", text: h.text.slice(0, 500) }));
    if (history.length === 0) history = undefined;
  }
  const targetFiles: string[] = Array.isArray(targetFilesRaw)
    ? targetFilesRaw.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0).map((f: string) => f.trim())
    : (typeof targetFile === "string" && targetFile.trim() ? [targetFile.trim()] : []);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = (event: Record<string, unknown>) => {
    try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* socket closed */ }
  };
  try {
    const result = await runProjectGeneration(
      project, userId, prompt, stack || project.stack, targetFiles, images, history,
      (stage) => send({ type: "status", stage })
    );
    send({ type: "result", ...result });
  } catch (e: any) {
    if (typeof e?.message === "string" && e.message.startsWith("NO_VISION_PROVIDER")) {
      send({ type: "error", error: e.message.replace("NO_VISION_PROVIDER: ", "") });
    } else {
      send({ type: "error", error: e?.message || "generation failed" });
    }
  }
  res.end();
});

// POST /api/devhub/projects/:id/database/design — schema-by-prompt (Lovable-gap
// feature #3, honest MVP): turns a plain-language description into db/schema.sql
// + a typed client wired to the project's own DATABASE_URL. It does NOT
// provision a live database — hosting needs a real isolation design and is a
// separate feature; generating files that pretend otherwise would be the same
// class of lie the deploy paths just got cured of.
devhubRouter.post("/projects/:id/database/design", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { description } = req.body || {};
  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "description is required" });
  }
  if (description.trim().length > 4000) {
    return res.status(400).json({ error: "description too long (max 4000 chars)" });
  }
  const clientFile = project.stack === "python" ? "db/client.py" : "db/client.ts";
  const prompt =
    `Design a PostgreSQL database for this application: ${description.trim()}\n\n` +
    `Produce exactly two files:\n` +
    `1. db/schema.sql — idempotent DDL (CREATE TABLE IF NOT EXISTS) with primary keys, ` +
    `foreign keys with ON DELETE behavior, sensible column types, NOT NULL where appropriate, ` +
    `created_at/updated_at timestamps, and indexes for the obvious query paths. Add a short comment above each table.\n` +
    `2. ${clientFile} — a minimal typed data-access helper that reads the connection string from ` +
    `process.env.DATABASE_URL (or os.environ for Python), creates one shared pool, exports a function ` +
    `to apply schema.sql, and one example CRUD function per table. No ORM — plain parameterized queries.`;
  try {
    const result = await runProjectGeneration(project, userId, prompt, project.stack, ["db/schema.sql", clientFile]);
    const canProvision = !!process.env.DEVHUB_DB_ADMIN_URL;
    res.json({
      ...result,
      canProvision,
      note: canProvision
        ? "Files generated — POST /database/provision to create the real database and get DATABASE_URL."
        : "Files generated — set DATABASE_URL in Env Vars and run the schema to go live. No database was provisioned.",
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "database design failed" });
  }
});

// POST /api/devhub/projects/:id/database/provision — create the real database.
// One schema + one login role per project on an instance dedicated to user
// projects (see lib/devhubDbProvision.ts). Applies db/schema.sql if the project
// has one, then stores DATABASE_URL in the project's env vars.
devhubRouter.post("/projects/:id/database/provision", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  if (!process.env.DEVHUB_DB_ADMIN_URL) {
    return res.status(503).json({
      error: "database provisioning is not configured — set DEVHUB_DB_ADMIN_URL on the server",
      envVar: "DEVHUB_DB_ADMIN_URL",
    });
  }

  // Apply the project's own schema if it designed one — that is the whole
  // point of the flow: design → provision → the tables actually exist.
  let schemaSql: string | null = null;
  try {
    const f = await dbGetFile(project.id, "db/schema.sql");
    schemaSql = f?.content ?? null;
  } catch {
    schemaSql = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === "db/schema.sql")?.content ?? null;
  }

  const { provisionProjectDatabase } = await import("../lib/devhubDbProvision");
  const result = await provisionProjectDatabase({ projectId: project.id, schemaSql });
  if (!result.ok) return res.status(502).json({ error: result.error });

  project.envVars = { ...(project.envVars || {}), DATABASE_URL: result.databaseUrl };
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }

  // The URL contains the credential — returned once so the caller can show it,
  // never logged.
  res.json({
    ok: true,
    schema: result.schema,
    role: result.role,
    appliedSchemaSql: result.appliedSchemaSql,
    databaseUrl: result.databaseUrl,
    note: result.appliedSchemaSql
      ? "Database created, schema applied, DATABASE_URL saved to this project's env vars."
      : "Database created and DATABASE_URL saved. No db/schema.sql found, so no tables were created yet.",
  });
});

// GET /api/devhub/projects/:id/database — what this project's database is
// actually using. Measured, so quota talk is never a guess.
devhubRouter.get("/projects/:id/database", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const provisioned = !!project.envVars?.DATABASE_URL;
  if (!process.env.DEVHUB_DB_ADMIN_URL || !provisioned) {
    return res.json({ provisioned: false, connectionLimit: Number(process.env.DEVHUB_DB_CONNECTION_LIMIT) || 5 });
  }
  const { projectSchemaSizeBytes } = await import("../lib/devhubDbProvision");
  const size = await projectSchemaSizeBytes({ projectId: project.id });
  if (!size.ok) return res.status(502).json({ provisioned: true, error: size.error });
  res.json({
    provisioned: true,
    tables: size.tables,
    bytes: size.bytes,
    megabytes: Math.round((size.bytes / 1048576) * 100) / 100,
    connectionLimit: Number(process.env.DEVHUB_DB_CONNECTION_LIMIT) || 5,
  });
});

// DELETE /api/devhub/projects/:id/database — drop the project's schema, role
// and stored DATABASE_URL. Destructive and irreversible, hence its own route.
devhubRouter.delete("/projects/:id/database", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  if (!process.env.DEVHUB_DB_ADMIN_URL) {
    return res.status(503).json({ error: "database provisioning is not configured" });
  }

  const { deprovisionProjectDatabase } = await import("../lib/devhubDbProvision");
  const result = await deprovisionProjectDatabase({ projectId: project.id });
  if (!result.ok) return res.status(502).json({ error: result.error });

  const { DATABASE_URL: _dropped, ...rest } = project.envVars || {};
  project.envVars = rest;
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.json({ ok: true, note: "Schema, role and DATABASE_URL removed. The data is gone." });
});

// POST /api/devhub/projects/:id/generate/undo — revert the project's most
// recent AI-driven multi-file write in one shot (restores every file it
// touched to its prior content, or deletes it if generate_code created it
// fresh) without regenerating anything. Consumes the checkpoint so a second
// undo reaches the one before it, not the same state again.
devhubRouter.post("/projects/:id/generate/undo", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canEdit(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const checkpoint = await dbLatestCheckpoint(project.id);
    if (!checkpoint) {
      return res.json({ ok: false, message: "No AI change to undo for this project" });
    }
    const revertedFiles = await applyCheckpointRevert(project.id, checkpoint);
    return res.json({ ok: true, revertedFiles, label: checkpoint.label });
  } catch (e: any) {
    captureException(e, { route: "devhub/generate:undo", projectId: project.id });
    return res.status(500).json({ error: e?.message || "undo failed" });
  }
});

// GET /api/devhub/projects/:id/checkpoints — history of AI-driven writes for
// the checkpoint-history UI (labels + timestamps + touched paths only, no
// file content — that's only needed at restore time).
devhubRouter.get("/projects/:id/checkpoints", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canAccess(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const checkpoints = await dbListCheckpoints(project.id, 20);
    return res.json({
      checkpoints: checkpoints.map((c) => ({
        id: c.id, label: c.label, createdAt: c.createdAt, paths: c.files.map((f) => f.path),
      })),
    });
  } catch (e: any) {
    captureException(e, { route: "devhub/checkpoints:list", projectId: project.id });
    return res.status(500).json({ error: e?.message || "failed to list checkpoints" });
  }
});

// POST /api/devhub/projects/:id/checkpoints/:checkpointId/restore — jumps
// straight to a specific point in AI-change history instead of calling
// /generate/undo N times. Applies every checkpoint from the newest down
// through (and including) the chosen one, newest first, so per-path writes
// converge on the target checkpoint's own priorContent — the same result
// sequential single-step undos would reach, just in one call.
devhubRouter.post("/projects/:id/checkpoints/:checkpointId/restore", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canEdit(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const history = await dbListCheckpoints(project.id, 200);
    const targetIndex = history.findIndex((c) => c.id === req.params.checkpointId);
    if (targetIndex === -1) {
      return res.json({ ok: false, message: "Checkpoint not found — it may already have been consumed by an earlier undo/restore" });
    }
    const toApply = history.slice(0, targetIndex + 1);
    const targetLabel = history[targetIndex].label;
    const revertedFiles = new Set<string>();
    for (const checkpoint of toApply) {
      const paths = await applyCheckpointRevert(project.id, checkpoint);
      paths.forEach((p) => revertedFiles.add(p));
    }
    return res.json({ ok: true, revertedFiles: [...revertedFiles], restoredToLabel: targetLabel, stepsApplied: toApply.length });
  } catch (e: any) {
    captureException(e, { route: "devhub/checkpoints:restore", projectId: project.id });
    return res.status(500).json({ error: e?.message || "restore failed" });
  }
});

// POST /api/devhub/plan — turn a raw idea into a staged build plan. NOT
// project-scoped (no /projects/:id/ prefix): works standalone for someone
// who hasn't created a project yet, and optionally accounts for an existing
// project's files when `projectId` is given in the body.
devhubRouter.post("/plan", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const { idea, projectId } = req.body || {};
  if (!idea || typeof idea !== "string" || !idea.trim()) {
    return res.status(400).json({ error: "idea is required" });
  }

  let existingFiles: Array<{ path: string; content: string }> = [];
  if (typeof projectId === "string" && projectId.trim()) {
    try {
      let project: DevHubProject | null;
      try { project = await dbGetProject(projectId.trim()); }
      catch { project = memProjects.get(projectId.trim()) ?? null; }
      if (project && canAccess(project, userId)) {
        existingFiles = await dbListFiles(projectId.trim());
      }
    } catch { /* planning still works without project context */ }
  }

  try {
    const plan = await planProjectWithAI(idea.trim(), existingFiles);
    return res.json(plan);
  } catch (e: any) {
    captureException(e, { route: "devhub/plan" });
    return res.status(500).json({ error: e?.message || "planning failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Deploy (V2: Railway API + SSE build log streaming)
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/deploy
devhubRouter.post("/projects/:id/deploy", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;

  const deployCredit = await checkCredit(userId, "deploy");
  if (!deployCredit.allowed) {
    return res.status(402).json({
      error: "Monthly deploy limit reached",
      tier: deployCredit.tier, used: deployCredit.used, limit: deployCredit.limit,
      upgrade: "/studio#upgrade",
    });
  }
  await debitCredit(userId, "deploy").catch(() => {});

  const deploymentId = crypto.randomUUID();
  const deploySlug = slugify(project.name) + "-" + project.id.slice(0, 8);
  const deployUrl = `https://${deploySlug}.aevion.app`;

  const deployment: DevHubDeployment = {
    id: deploymentId,
    projectId: project.id,
    userId,
    status: "pending",
    deployUrl: null,
    buildLog: null,
    triggeredAt: now(),
    completedAt: null,
  };
  try {
    await dbSaveDeployment(deployment);
  } catch {
    memDeployments.set(deployment.id, deployment);
  }

  const railwayToken = process.env.RAILWAY_API_TOKEN;
  const railwayProjectId = process.env.RAILWAY_PROJECT_ID;
  const railwayServiceId = process.env.RAILWAY_SERVICE_ID;

  // Per-project deploys: the project's own Railway service, built from its own
  // GitHub repo, carrying its own env vars (DATABASE_URL included). Behind a
  // flag because enabling it makes every user click start a billable container.
  if (process.env.DEVHUB_RAILWAY_PER_PROJECT) {
    const { deployProjectToRailway } = await import("../lib/devhubRailwayDeploy");
    const result = await deployProjectToRailway({
      projectId: project.id,
      repoUrl: project.repoUrl,
      envVars: project.envVars || {},
      existingServiceId: project.envVars?.RAILWAY_SERVICE_ID || null,
    });
    if (!result.ok) {
      deployment.status = "failed";
      deployment.buildLog = result.error;
      deployment.completedAt = now();
      try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
      return res.status(502).json({ error: result.error, deploymentId: deployment.id });
    }

    // Remember the service so a redeploy reuses it instead of creating a new
    // billable container on every click.
    project.envVars = { ...(project.envVars || {}), RAILWAY_SERVICE_ID: result.serviceId };
    project.updatedAt = now();
    try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }

    const url = `https://${result.domain}`;
    deployment.buildLog = `Railway service ${result.serviceId} ${result.created ? "created" : "reused"} from ${project.repoUrl}`;
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }

    // Same rule as every other deploy path: live only once the page answers.
    (async () => {
      const serves = await verifyDeploymentServes(url);
      deployment.status = serves ? "live" : "failed";
      deployment.deployUrl = serves ? url : null;
      deployment.buildLog = serves
        ? `${deployment.buildLog}
Serving at ${url}`
        : `${deployment.buildLog}
Built, but ${url} did not answer 2xx in time`;
      deployment.completedAt = now();
      try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
      if (serves) {
        project.deployUrl = url;
        project.updatedAt = now();
        try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }
      }
    })().catch(() => {});

    return res.json({ ok: true, deploymentId: deployment.id, status: "building", url, serviceId: result.serviceId, reusedService: !result.created });
  }
  // SAFETY: this route never deployed the user's code. It fired
  // deploymentCreate at whatever RAILWAY_SERVICE_ID happens to be — and on
  // production that variable is the AEVION backend's own service id, so every
  // click of "Deploy" in someone's project restarted our production API. The
  // returned <slug>.aevion.app URL was invented and never pointed at anything.
  //
  // Refusing outright until per-project deploys exist (github push -> new
  // Railway service -> project env vars). Static projects already have a real,
  // serve-verified path through Cloudflare Pages.
  const targetsOurOwnService = !railwayServiceId || railwayServiceId === process.env.RAILWAY_SELF_SERVICE_ID || !process.env.DEVHUB_RAILWAY_PER_PROJECT;
  if (targetsOurOwnService) {
    deployment.status = "failed";
    deployment.buildLog = "Backend deploys are not available yet: the Railway path would have redeployed the AEVION platform service rather than this project.";
    deployment.completedAt = now();
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
    return res.status(501).json({
      error: "Backend deploys are not available yet",
      detail: "This button used to trigger a redeploy of the AEVION platform service instead of your project — it has been disabled rather than left lying.",
      alternative: "Static projects deploy for real via Cloudflare Pages (Deploy → Pages), including a verified *.aevion.build subdomain.",
      deploymentId: deployment.id,
    });
  }

  if (railwayToken && railwayProjectId && railwayServiceId) {
    // Real Railway API deployment via GraphQL mutation
    (async () => {
      try {
        const gqlResp = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${railwayToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `mutation { deploymentCreate(input: { projectId: "${railwayProjectId}", serviceId: "${railwayServiceId}" }) { id status } }`,
          }),
        });
        const gqlData = await gqlResp.json() as any;
        const railwayDeploymentId = gqlData?.data?.deploymentCreate?.id as string | undefined;
        const railwayErrors = Array.isArray(gqlData?.errors) ? gqlData.errors : null;

        // GraphQL returns HTTP 200 even when the mutation itself failed — errors
        // (or a missing deployment id) ride in the body, not the status code.
        // Without this check a broken/expired Railway token or bad project/service
        // id would still flip the deployment to "building" then "live" on a
        // fabricated *.up.railway.app URL that never actually deployed anything.
        if (!gqlResp.ok || railwayErrors || !railwayDeploymentId) {
          const errMsg = railwayErrors?.map((e: any) => e?.message).filter(Boolean).join("; ")
            || `Railway API returned no deployment id (HTTP ${gqlResp.status})`;
          deployment.status = "failed";
          deployment.buildLog = `Railway deploy failed: ${errMsg}`;
          deployment.completedAt = now();
          try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
          captureException(new Error(`Railway deploymentCreate failed: ${errMsg}`), { route: "devhub/deploy:railway", projectId: project!.id });
          return;
        }

        const railwayDeployUrl = `https://${deploySlug}.up.railway.app`;

        deployment.status = "building";
        deployment.deployUrl = railwayDeployUrl;
        deployment.buildLog = railwayDeploymentId ?? null;
        try {
          await dbSaveDeployment(deployment);
        } catch {
          memDeployments.set(deployment.id, deployment);
        }

        // Verify the page actually serves before calling it live — same
        // honesty rule as the CF Pages / Vercel paths.
        deferred(async () => {
          const d = memDeployments.get(deployment.id) ?? deployment;
          const serves = await verifyDeploymentServes(railwayDeployUrl);
          if (serves) {
            d.status = "live";
          } else {
            d.status = "failed";
            d.buildLog = (d.buildLog || "") + " | verify: deployed page is not serving (non-2xx after retries)";
          }
          d.completedAt = now();
          try {
            await dbSaveDeployment(d);
          } catch {
            memDeployments.set(d.id, d);
          }
          if (project && serves) {
            project.status = "live";
            project.deployUrl = railwayDeployUrl;
            project.updatedAt = now();
            try {
              await dbSaveProject(project);
            } catch {
              memProjects.set(project.id, project);
            }
          }
        }, 5000);
      } catch (e: any) {
        // Railway API unreachable. This used to SIMULATE a successful build
        // on a fabricated URL — a deploy that never happened reported as
        // live. Honest now: the deployment failed, with the reason.
        deployment.status = "failed";
        deployment.buildLog = `Railway API unreachable: ${e?.message || "network error"}`;
        deployment.completedAt = now();
        try {
          await dbSaveDeployment(deployment);
        } catch {
          memDeployments.set(deployment.id, deployment);
        }
      }
    })();
  } else {
    // Simulate build asynchronously — no Railway token
    deferred(async () => {
      deployment.status = "live";
      deployment.deployUrl = deployUrl;
      deployment.buildLog = `Build started at ${deployment.triggeredAt}\nInstalling dependencies...\nBuilding...\nDeployment complete!\nLive at: ${deployUrl}`;
      deployment.completedAt = now();
      try {
        await dbSaveDeployment(deployment);
      } catch {
        memDeployments.set(deployment.id, deployment);
      }
      if (project) {
        project.status = "live";
        project.deployUrl = deployUrl;
        project.updatedAt = now();
        try {
          await dbSaveProject(project);
        } catch {
          memProjects.set(project.id, project);
        }
      }
    }, 3000);
  }

  res.json({ deploymentId, status: "building", deployUrl, message: "Deployment started" });
});

// GET /api/devhub/projects/:id/deployments/:deployId/log — SSE build log stream
devhubRouter.get("/projects/:id/deployments/:deployId/log", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;

  const deploySlug = slugify(project.name) + "-" + project.id.slice(0, 8);
  const deployUrl = `https://${deploySlug}.aevion.app`;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const LOG_STEPS = [
    "[1/5] Installing dependencies...",
    "[2/5] Type checking...",
    "[3/5] Building application...",
    "[4/5] Deploying to edge...",
    "[5/5] Health check passed",
  ];

  let step = 0;
  const interval = setInterval(() => {
    if (step < LOG_STEPS.length) {
      res.write(`data: ${JSON.stringify({ line: LOG_STEPS[step] })}\n\n`);
      step++;
    } else {
      res.write(`data: ${JSON.stringify({ done: true, deployUrl })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on("close", () => {
    clearInterval(interval);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Collaborators (V2)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/collaborators
devhubRouter.get("/projects/:id/collaborators", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canAccess(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  res.json({ collaborators: project.collaborators });
});

// POST /api/devhub/projects/:id/collaborators
devhubRouter.post("/projects/:id/collaborators", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  // Only project owner can manage collaborators
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  // Studio Pro required to add collaborators
  const tier = await getUserTier(userId);
  if (tier === "free") {
    return res.status(403).json({ error: "Studio Pro required to add collaborators", upgrade: true });
  }
  const { userId: rawInput, role } = req.body || {};
  if (!rawInput || typeof rawInput !== "string") {
    return res.status(400).json({ error: "userId or email is required" });
  }
  const validRoles = ["editor", "viewer"];
  const resolvedRole = validRoles.includes(role) ? role : "editor";

  // Resolve email → userId via AEVIONUser if input looks like an email
  let collabUserId = rawInput.trim();
  let displayEmail = "";
  if (collabUserId.includes("@") && isDevHubDbReady()) {
    try {
      const ur = await pool.query(
        `SELECT "id","email" FROM "AEVIONUser" WHERE LOWER("email")=$1 LIMIT 1`,
        [collabUserId.toLowerCase()]
      );
      if (ur.rows[0]?.id) {
        displayEmail = ur.rows[0].email;
        collabUserId = ur.rows[0].id;
      }
      // If not found, store the email as a placeholder so the invite persists
    } catch { /* keep rawInput as userId */ }
  }

  if (collabUserId === userId) {
    return res.status(400).json({ error: "cannot add project owner as collaborator" });
  }
  project.collaborators = project.collaborators.filter((c) => c.userId !== collabUserId);
  project.collaborators.push({ userId: collabUserId, role: resolvedRole });
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch (e) {
    captureException(e, { route: "devhub/collaborators:post", projectId: project.id });
    memProjects.set(project.id, project);
  }
  res.status(201).json({ collaborators: project.collaborators, resolved: displayEmail || collabUserId });
});

// DELETE /api/devhub/projects/:id/collaborators/:userId
devhubRouter.delete("/projects/:id/collaborators/:collabUserId", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { collabUserId } = req.params;
  project.collaborators = project.collaborators.filter((c) => c.userId !== collabUserId);
  project.updatedAt = now();
  let storageFallback = false;
  try {
    await dbSaveProject(project);
  } catch (e) {
    captureException(e, { route: "devhub/collaborators:delete", projectId: project.id });
    memProjects.set(project.id, project);
    storageFallback = true;
  }
  res.json({ ok: true, collaborators: project.collaborators, ...(storageFallback ? MEMORY_NOTE : {}) });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — GitHub Integration
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/github/push
devhubRouter.post("/projects/:id/github/push", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.json({
      ok: false,
      message: "Set GITHUB_TOKEN in project Env Vars or server env to enable GitHub integration",
      setupUrl: "https://github.com/settings/tokens",
    });
  }
  try {
    const projectSlug = slugify(project.name) + "-" + project.id.slice(0, 8);

    // 1. Get authenticated GitHub username
    const userResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
      },
    });
    if (!userResp.ok) {
      const errText = await userResp.text();
      return res.json({ ok: false, message: `GitHub auth error: ${errText}` });
    }
    const ghUser = await userResp.json() as { login: string };
    const username = ghUser.login;

    // 2. Create repo
    const createResp = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "AEVION-DevHub",
      },
      body: JSON.stringify({
        name: projectSlug,
        description: project.description || "Created by AEVION DevHub",
        private: false,
        auto_init: true,
      }),
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      return res.json({ ok: false, message: `GitHub repo create error: ${errText}` });
    }
    const repoData = await createResp.json() as { html_url: string };
    const repoUrl = repoData.html_url;
    const repoName = projectSlug;

    // 3. Push each project file
    const files = await dbListFiles(project.id);
    let pushedFiles = 0;
    for (const file of files) {
      try {
        const fileResp = await fetch(
          `https://api.github.com/repos/${username}/${repoName}/contents/${file.path}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              "Content-Type": "application/json",
              "User-Agent": "AEVION-DevHub",
            },
            body: JSON.stringify({
              message: "Initial commit from AEVION DevHub",
              content: Buffer.from(file.content).toString("base64"),
            }),
          },
        );
        if (fileResp.ok) pushedFiles += 1;
      } catch {
        // continue with other files
      }
    }

    // 4. Update project repoUrl
    project.repoUrl = repoUrl;
    project.updatedAt = now();
    try {
      await dbSaveProject(project);
    } catch (e) {
      captureException(e, { route: "devhub/github:push", projectId: project.id });
      memProjects.set(project.id, project);
    }

    return res.json({ ok: true, repoUrl, pushedFiles });
  } catch (e: any) {
    return res.json({ ok: false, message: e?.message || "GitHub push failed" });
  }
});

// POST /api/devhub/projects/:id/github/pull-request — open a PR with the
// project's current files on a new branch, targeting the repo's default branch.
// Requires the project to already be linked to GitHub (via /github/push).
// POST /api/devhub/projects/:id/github/sync — pull the linked repo's current
// default-branch state INTO the project (roadmap #5: sync was push-only).
// A checkpoint is taken before anything is written, so a bad sync is one
// undo away — same safety contract as AI generations.
const SYNC_BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|zip|gz|tar|pdf|mp[34]|wasm|jar|exe|dll|so|dylib)$/i;
const SYNC_MAX_FILES = 100;
const SYNC_MAX_FILE_BYTES = 200_000;

devhubRouter.post("/projects/:id/github/sync", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  if (!project.repoUrl) {
    return res.json({ ok: false, message: "No GitHub repo linked yet — push to GitHub first (POST /github/push)" });
  }
  const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return res.json({ ok: false, message: "repoUrl is not a recognizable GitHub URL" });
  }
  const [, owner, repo] = match;
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.json({ ok: false, message: "Set GITHUB_TOKEN in project Env Vars or server env to enable GitHub integration" });
  }
  const ghHeaders = { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json", "User-Agent": "aevion-devhub" };
  try {
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
    const repoData = await repoResp.json() as { default_branch?: string; message?: string };
    if (!repoResp.ok) return res.status(502).json({ error: `GitHub: ${repoData.message || repoResp.status}` });
    const branch = repoData.default_branch || "main";

    const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers: ghHeaders });
    const treeData = await treeResp.json() as { tree?: Array<{ path: string; type: string; sha: string; size?: number }>; message?: string };
    if (!treeResp.ok || !Array.isArray(treeData.tree)) {
      return res.status(502).json({ error: `GitHub tree: ${treeData.message || treeResp.status}` });
    }

    const skipped: string[] = [];
    const candidates = treeData.tree.filter((n) => {
      if (n.type !== "blob") return false;
      if (SYNC_BINARY_EXT.test(n.path) || (n.size ?? 0) > SYNC_MAX_FILE_BYTES) { skipped.push(n.path); return false; }
      return true;
    });
    if (candidates.length > SYNC_MAX_FILES) {
      skipped.push(...candidates.slice(SYNC_MAX_FILES).map((n) => n.path));
      candidates.length = SYNC_MAX_FILES;
    }

    const existing = await dbListFiles(project.id);
    const byPath = new Map(existing.map((f) => [f.path, f]));
    const updated: string[] = [];
    const created: string[] = [];
    let unchanged = 0;
    const toWrite: Array<{ path: string; content: string }> = [];

    for (const node of candidates) {
      const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${node.sha}`, { headers: ghHeaders });
      if (!blobResp.ok) { skipped.push(node.path); continue; }
      const blob = await blobResp.json() as { content?: string; encoding?: string };
      if (blob.encoding !== "base64" || typeof blob.content !== "string") { skipped.push(node.path); continue; }
      const content = Buffer.from(blob.content, "base64").toString("utf8");
      const current = byPath.get(node.path);
      if (!current) { created.push(node.path); toWrite.push({ path: node.path, content }); }
      else if (current.content !== content) { updated.push(node.path); toWrite.push({ path: node.path, content }); }
      else unchanged++;
    }

    let checkpointId: string | null = null;
    if (toWrite.length > 0) {
      checkpointId = await createCheckpoint(
        project.id, userId, `GitHub sync from ${owner}/${repo}@${branch}`,
        toWrite.map((f) => f.path), existing
      );
      for (const f of toWrite) {
        const file: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: f.path,
          content: f.content, language: detectLanguage(f.path), updatedAt: now(),
        };
        try { await dbUpsertFile(file); }
        catch {
          const cur = [...memFiles.values()].find((x) => x.projectId === project!.id && x.path === f.path);
          if (cur) { cur.content = file.content; cur.language = file.language; cur.updatedAt = file.updatedAt; }
          else memFiles.set(file.id, file);
        }
      }
    }

    res.json({
      ok: true, branch, updated, created, unchanged,
      ...(skipped.length ? { skipped } : {}),
      ...(checkpointId ? { checkpointId } : {}),
      message: toWrite.length
        ? `Synced ${owner}/${repo}@${branch}: ${updated.length} updated, ${created.length} new (undo restores the pre-sync state)`
        : `Already in sync with ${owner}/${repo}@${branch}`,
    });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || "GitHub sync failed" });
  }
});

devhubRouter.post("/projects/:id/github/pull-request", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { title, body: prBody, branch: branchInput } = req.body || {};
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title is required" });
  }
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.json({
      ok: false,
      message: "Set GITHUB_TOKEN in project Env Vars or server env to enable GitHub integration",
      setupUrl: "https://github.com/settings/tokens",
    });
  }
  if (!project.repoUrl) {
    return res.json({ ok: false, message: "No GitHub repo linked yet — push to GitHub first (POST /github/push)" });
  }
  const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return res.json({ ok: false, message: "repoUrl is not a recognizable GitHub URL" });
  }
  const [, owner, repo] = match;
  const ghHeaders = { Authorization: `Bearer ${githubToken}`, "User-Agent": "AEVION-DevHub" };

  try {
    // 1. Resolve the default branch + its current commit sha.
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { ...ghHeaders, Accept: "application/vnd.github+json" },
    });
    if (!repoResp.ok) {
      return res.json({ ok: false, message: `GitHub repo lookup error: ${(await repoResp.text()).slice(0, 300)}` });
    }
    const repoData = await repoResp.json() as { default_branch: string };
    const baseBranch = repoData.default_branch;

    const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, {
      headers: { ...ghHeaders, Accept: "application/vnd.github+json" },
    });
    if (!refResp.ok) {
      return res.json({ ok: false, message: `GitHub base branch lookup error: ${(await refResp.text()).slice(0, 300)}` });
    }
    const refData = await refResp.json() as { object: { sha: string } };
    const baseSha = refData.object.sha;

    // 2. Create a new branch from the base commit.
    const branch = (typeof branchInput === "string" && branchInput.trim()) ? branchInput.trim() : `aevion-agent-${Date.now()}`;
    const createRefResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
    if (!createRefResp.ok) {
      return res.json({ ok: false, message: `GitHub branch create error: ${(await createRefResp.text()).slice(0, 300)}` });
    }

    // 3. Commit the project's current files onto the new branch (each file
    // already exists there as a copy of the base commit, so its current sha
    // must be looked up before overwriting it — Contents API rejects a PUT
    // without sha for an existing file).
    const files = await dbListFiles(project.id);
    let pushedFiles = 0;
    for (const file of files) {
      try {
        const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
        let sha: string | undefined;
        const getResp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
          { headers: ghHeaders }
        );
        if (getResp.ok) {
          const existing = await getResp.json() as { sha?: string };
          sha = existing.sha;
        }
        const putResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, {
          method: "PUT",
          headers: { ...ghHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: title,
            content: Buffer.from(file.content).toString("base64"),
            branch,
            ...(sha ? { sha } : {}),
          }),
        });
        if (putResp.ok) pushedFiles += 1;
      } catch {
        // continue with other files
      }
    }
    if (files.length > 0 && pushedFiles === 0) {
      return res.json({ ok: false, message: "Branch created but no files could be committed", branch });
    }

    // 4. Open the pull request.
    const prResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ title, head: branch, base: baseBranch, body: prBody || "" }),
    });
    if (!prResp.ok) {
      return res.json({ ok: false, message: `GitHub PR create error: ${(await prResp.text()).slice(0, 300)}`, branch, pushedFiles });
    }
    const prData = await prResp.json() as { html_url: string; number: number };
    return res.json({ ok: true, prUrl: prData.html_url, prNumber: prData.number, branch, pushedFiles });
  } catch (e: any) {
    captureException(e, { route: "devhub/github:pull-request", projectId: project.id });
    return res.json({ ok: false, message: e?.message || "GitHub pull request creation failed" });
  }
});

// POST /api/devhub/projects/:id/github/pull-request/:number/merge
devhubRouter.post("/projects/:id/github/pull-request/:number/merge", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const prNumber = pgIntId(req.params.number);
  if (prNumber === null) {
    return res.status(400).json({ error: "invalid pull request number" });
  }
  const mergeMethodInput = typeof req.body?.mergeMethod === "string" ? req.body.mergeMethod : "squash";
  const mergeMethod = (["merge", "squash", "rebase"] as const).includes(mergeMethodInput as any) ? mergeMethodInput : "squash";

  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.json({
      ok: false,
      message: "Set GITHUB_TOKEN in project Env Vars or server env to enable GitHub integration",
      setupUrl: "https://github.com/settings/tokens",
    });
  }
  if (!project.repoUrl) {
    return res.json({ ok: false, message: "No GitHub repo linked yet — push to GitHub first (POST /github/push)" });
  }
  const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return res.json({ ok: false, message: "repoUrl is not a recognizable GitHub URL" });
  }
  const [, owner, repo] = match;
  const ghHeaders = { Authorization: `Bearer ${githubToken}`, "User-Agent": "AEVION-DevHub" };

  try {
    const mergeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ merge_method: mergeMethod }),
    });
    const mergeData = await mergeResp.json().catch(() => ({})) as { merged?: boolean; sha?: string; message?: string };
    // GitHub's merge endpoint can return a non-2xx (405 not mergeable, 409 sha
    // mismatch, 404) — but even a 2xx response carries `merged: false` in some
    // edge cases, so both must be checked, not just the HTTP status.
    if (!mergeResp.ok || mergeData.merged !== true) {
      return res.json({ ok: false, message: mergeData.message || `GitHub merge error: HTTP ${mergeResp.status}` });
    }
    return res.json({ ok: true, merged: true, sha: mergeData.sha, message: mergeData.message });
  } catch (e: any) {
    captureException(e, { route: "devhub/github:merge-pull-request", projectId: project.id });
    return res.json({ ok: false, message: e?.message || "GitHub pull request merge failed" });
  }
});

// GET /api/devhub/projects/:id/github/status — check if repo exists on GitHub
devhubRouter.get("/projects/:id/github/status", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!project.repoUrl || !githubToken) {
    return res.json({ exists: false });
  }
  try {
    const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return res.json({ exists: false });
    const [, owner, repo] = match;
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
      },
    });
    // `exists: false` alone said "no such repository" for a revoked token too.
    // The reason travels with it so the screen can tell the two apart.
    if (!ghResp.ok) {
      const { errorKind, error } = classifyGithubResponse(ghResp.status, ghResp.headers);
      return res.json({ exists: false, errorKind, error });
    }
    const ghData = await ghResp.json() as {
      stargazers_count?: number;
      open_issues_count?: number;
      pushed_at?: string;
    };
    return res.json({
      exists: true,
      stars: ghData.stargazers_count ?? 0,
      openIssues: ghData.open_issues_count ?? 0,
      lastPush: ghData.pushed_at ?? null,
    });
  } catch (e: any) {
    const { errorKind, error } = githubUnreachable(e?.message);
    return res.json({ exists: false, errorKind, error });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Templates (Commit 3)

// GET /api/devhub/projects/:id/github/branches — list branches of linked repo
devhubRouter.get("/projects/:id/github/branches", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!project.repoUrl || !githubToken) {
    return res.json({ branches: [], connected: false });
  }
  try {
    const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return res.json({ branches: [], connected: false });
    const [, owner, repo] = match;
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
        Accept: "application/vnd.github+json",
      },
    });
    // This line used to read `connected: true` for every failure: a revoked
    // token, a repo the token cannot see and a GitHub outage all reached the
    // screen as "connected, 0 branches". `connected` now means GitHub answered.
    if (!resp.ok) return res.json({ branches: [], ...classifyGithubResponse(resp.status, resp.headers) });
    const data = await resp.json() as Array<{ name: string; commit: { sha: string } }>;
    return res.json({
      connected: true,
      repoUrl: project.repoUrl,
      branches: data.map((b) => ({ name: b.name, sha: b.commit.sha.slice(0, 7) })),
    });
  } catch (e: any) {
    // A thrown fetch says nothing about the token, so it must not read as one.
    return res.json({ branches: [], ...githubUnreachable(e?.message) });
  }
});

// A second POST /projects/:id/github/sync used to be declared here, returning
// the repo's default branch, star count and last-push date. Express matches the
// FIRST handler registered for a path, so it never ran once — the pull-files
// handler above always answered instead. Nothing consumed its shape (the UI
// reads `updated`/`created`), and `/github/status` already serves stars and
// last push, so it was removed rather than given a second path. The duplicate
// is guarded by a test: devhub-github-connection-truth.test.ts.

// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/templates
devhubRouter.get("/templates", (_req, res) => {
  res.json({ templates: TEMPLATES });
});

// POST /api/devhub/projects/:id/apply-template
devhubRouter.post("/projects/:id/apply-template", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { templateId } = req.body || {};
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return res.status(404).json({ error: "template not found" });

  const savedFiles: DevHubFile[] = [];
  for (const tf of template.files) {
    const file: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path: tf.path,
      content: tf.content,
      language: tf.language || detectLanguage(tf.path),
      updatedAt: now(),
    };
    try {
      await dbUpsertFile(file);
    } catch {
      const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === tf.path);
      if (existing) {
        existing.content = file.content;
        existing.language = file.language;
        existing.updatedAt = file.updatedAt;
      } else {
        memFiles.set(file.id, file);
      }
    }
    savedFiles.push(file);
  }
  res.json({ ok: true, files: savedFiles, template: template.id });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Environment Variables
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/env
devhubRouter.get("/projects/:id/env", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  // Return keys with masked values
  const masked = Object.keys(project.envVars).map((key) => ({
    key,
    value: "***",
    set: true,
  }));
  res.json({ env: masked, count: masked.length });
});

// PUT /api/devhub/projects/:id/env
devhubRouter.put("/projects/:id/env", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { key, value } = req.body || {};
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key is required" });
  project.envVars[String(key)] = String(value ?? "");
  project.updatedAt = now();
  let storageFallback = false;
  try {
    await dbSaveProject(project);
  } catch (e) {
    captureException(e, { route: "devhub/env:put", projectId: project.id });
    memProjects.set(project.id, project);
    storageFallback = true;
  }
  res.json({ ok: true, key, ...(storageFallback ? MEMORY_NOTE : {}) });
});

// DELETE /api/devhub/projects/:id/env/:key
devhubRouter.delete("/projects/:id/env/:key", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const key = req.params.key;
  delete project.envVars[key];
  project.updatedAt = now();
  let storageFallback = false;
  try {
    await dbSaveProject(project);
  } catch (e) {
    captureException(e, { route: "devhub/env:delete", projectId: project.id });
    memProjects.set(project.id, project);
    storageFallback = true;
  }
  res.json({ ok: true, key, ...(storageFallback ? MEMORY_NOTE : {}) });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Custom Domain
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/domain
devhubRouter.post("/projects/:id/domain", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  const { domain } = req.body || {};
  if (!domain || typeof domain !== "string") return res.status(400).json({ error: "domain is required" });
  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain.trim())) {
    return res.status(400).json({ error: "invalid domain format" });
  }
  project.customDomain = domain.trim();
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch (e) {
    captureException(e, { route: "devhub/domain:post", projectId: project.id });
    memProjects.set(project.id, project);
  }
  res.json({
    ok: true,
    domain: project.customDomain,
    cname: "devhub.aevion.app",
    message: "Point your CNAME to devhub.aevion.app",
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Deployment History
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/deployments
devhubRouter.get("/projects/:id/deployments", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;
  try {
    const deployments = await dbListDeployments(req.params.id, 10);
    res.json({ deployments });
  } catch {
    const deployments = [...memDeployments.values()]
      .filter((d) => d.projectId === req.params.id)
      .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
      .slice(0, 10);
    res.json({ deployments });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Snippet Shelf (publicly shareable code snippets, gist-style)
// ═════════════════════════════════════════════════════════════════════════════

function rowToSnippet(row: any): DevHubSnippet {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    language: row.language,
    tags: Array.isArray(row.tags) ? row.tags : [],
    stars: typeof row.stars === "number" ? row.stars : Number(row.stars) || 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

async function dbListSnippets(opts: { tag?: string; userId?: string; limit?: number }): Promise<DevHubSnippet[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  if (!isDevHubDbReady()) {
    let arr = [...memSnippets.values()];
    if (opts.userId) arr = arr.filter((s) => s.userId === opts.userId);
    if (opts.tag) {
      const tag = opts.tag.toLowerCase();
      arr = arr.filter((s) => s.tags.some((t) => t.toLowerCase() === tag));
    }
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  const params: any[] = [];
  const conds: string[] = [];
  if (opts.userId) {
    params.push(opts.userId);
    conds.push(`"userId" = $${params.length}`);
  }
  if (opts.tag) {
    params.push(JSON.stringify([opts.tag]));
    conds.push(`"tags" @> $${params.length}::jsonb`);
  }
  params.push(limit);
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const r = await pool.query(
    `SELECT * FROM "DevHubSnippet" ${where} ORDER BY "createdAt" DESC LIMIT $${params.length}`,
    params
  );
  return r.rows.map(rowToSnippet);
}

async function dbGetSnippet(id: string): Promise<DevHubSnippet | null> {
  if (!isDevHubDbReady()) return memSnippets.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "DevHubSnippet" WHERE "id" = $1`, [id]);
  return r.rows[0] ? rowToSnippet(r.rows[0]) : null;
}

async function dbSaveSnippet(s: DevHubSnippet): Promise<void> {
  if (!isDevHubDbReady()) { memSnippets.set(s.id, s); return; }
  await pool.query(
    `INSERT INTO "DevHubSnippet" ("id","userId","title","content","language","tags","stars","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
     ON CONFLICT ("id") DO UPDATE SET
       "title"=$3,"content"=$4,"language"=$5,"tags"=$6::jsonb,"stars"=$7,"updatedAt"=$9`,
    [s.id, s.userId, s.title, s.content, s.language, JSON.stringify(s.tags), s.stars, s.createdAt, s.updatedAt]
  );
}

async function dbDeleteSnippet(id: string): Promise<void> {
  if (!isDevHubDbReady()) { memSnippets.delete(id); return; }
  await pool.query(`DELETE FROM "DevHubSnippet" WHERE "id" = $1`, [id]);
}

/**
 * Публичный вид сниппета: БЕЗ личности автора.
 *
 * Полка сниппетов видна всем, и раньше вместе с кодом наружу уезжало поле
 * userId. Пока все разлогиненные были одним "anonymous", это ничего не
 * значило. С личным идентификатором гостя (lib/devhubGuest.ts) это стало бы
 * дырой: опубликовав сниппет, посетитель публиковал бы и свой идентификатор,
 * а по нему любой мог назваться им — и удалить его проекты.
 *
 * Вместо личности отдаём `mine`: клиенту нужно ровно одно — показывать ли
 * кнопку удаления.
 */
function publicSnippet(s: DevHubSnippet, viewerId: string) {
  const { userId, ...rest } = s;
  return { ...rest, mine: userId === viewerId };
}

// GET /api/devhub/snippets — public list, optional ?tag=X&user=Y&limit=N
devhubRouter.get("/snippets", async (req, res) => {
  const viewerId = requesterId(req, verifyBearerOptional(req)?.sub);
  const tag = req.query.tag ? String(req.query.tag).trim() : undefined;
  const userId = req.query.user ? String(req.query.user).trim() : undefined;
  const limit = req.query.limit ? Math.min(Math.max(parseInt(String(req.query.limit), 10) || 50, 1), 200) : 50;
  try {
    const snippets = await dbListSnippets({ tag, userId, limit });
    res.json({ snippets: snippets.map((s) => publicSnippet(s, viewerId)), total: snippets.length });
  } catch {
    let arr = [...memSnippets.values()];
    if (userId) arr = arr.filter((s) => s.userId === userId);
    if (tag) {
      const t = tag.toLowerCase();
      arr = arr.filter((s) => s.tags.some((tg) => tg.toLowerCase() === t));
    }
    const snippets = arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    res.json({ snippets: snippets.map((s) => publicSnippet(s, viewerId)), total: snippets.length });
  }
});

// POST /api/devhub/snippets — create a snippet
devhubRouter.post("/snippets", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const { title, content, language, tags } = req.body || {};
  if (!title || typeof title !== "string") return res.status(400).json({ error: "title is required" });
  if (typeof content !== "string") return res.status(400).json({ error: "content must be a string" });
  const normTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
    : [];
  const snippet: DevHubSnippet = {
    id: crypto.randomUUID(),
    userId,
    title: title.trim().slice(0, 200),
    content: String(content).slice(0, 100_000),
    language: language ? String(language).trim().slice(0, 40) : "plaintext",
    tags: normTags,
    stars: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  let storageFallback = false;
  try {
    await dbSaveSnippet(snippet);
  } catch (e) {
    captureException(e, { route: "devhub/snippets:create", snippetId: snippet.id });
    memSnippets.set(snippet.id, snippet);
    storageFallback = true;
  }
  res.status(201).json({
    snippet: publicSnippet(snippet, userId),
    ...(storageFallback ? MEMORY_NOTE : {}),
  });
});

// GET /api/devhub/snippets/:id — fetch single snippet
devhubRouter.get("/snippets/:id", async (req, res) => {
  const viewerId = requesterId(req, verifyBearerOptional(req)?.sub);
  try {
    const snippet = await dbGetSnippet(req.params.id);
    if (!snippet) return res.status(404).json({ error: "snippet not found" });
    res.json({ snippet: publicSnippet(snippet, viewerId) });
  } catch {
    // База упала. Память в проде пуста, и «snippet not found» стало бы ложью
    // о существующем фрагменте.
    const snippet = memSnippets.get(req.params.id);
    if (!snippet) return replyStorageUnavailable(res);
    // Обезличиваем и здесь: это запасной путь, добавленный их веткой, и без
    // publicSnippet он отдавал бы наружу личность автора — по ней можно
    // назваться им (см. lib/devhubGuest.ts).
    res.json({ snippet: publicSnippet(snippet, viewerId), storage: "memory" });
  }
});

// DELETE /api/devhub/snippets/:id — снять СВОЙ сниппет с публичной полки
devhubRouter.delete("/snippets/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  let snippet: DevHubSnippet | null;
  try {
    snippet = await dbGetSnippet(req.params.id);
  } catch {
    snippet = memSnippets.get(req.params.id) ?? null;
  }
  // 404, а не 403: иначе ответ подтверждал бы существование чужого сниппета
  // тому, кто им не владеет.
  if (!snippet || snippet.userId !== userId) {
    return res.status(404).json({ error: "snippet not found" });
  }
  try {
    await dbDeleteSnippet(snippet.id);
  } catch (e) {
    // Молчаливый успех здесь хуже отказа: человек увидел бы, что сниппет снят,
    // а он остался бы на публичной полке.
    captureException(e, { route: "devhub/snippets:delete", snippetId: snippet.id });
    return res.status(500).json({ error: "delete failed" });
  }
  memSnippets.delete(snippet.id);
  res.json({ ok: true, id: snippet.id });
});

// POST /api/devhub/snippets/:id/star — increment star count
devhubRouter.post("/snippets/:id/star", async (req, res) => {
  let snippet: DevHubSnippet | null;
  let readFailed = false;
  try {
    snippet = await dbGetSnippet(req.params.id);
  } catch {
    snippet = memSnippets.get(req.params.id) ?? null;
    readFailed = true;
  }
  // «snippet not found» на упавшей базе — ложь о существующем фрагменте, и
  // звезда при этом молча не ставится.
  if (!snippet && readFailed) return replyStorageUnavailable(res);
  if (!snippet) return res.status(404).json({ error: "snippet not found" });
  snippet.stars += 1;
  snippet.updatedAt = now();
  try {
    await dbSaveSnippet(snippet);
  } catch (e) {
    captureException(e, { route: "devhub/snippets:star", snippetId: snippet.id });
    memSnippets.set(snippet.id, snippet);
  }
  res.json({ ok: true, stars: snippet.stars });
});

// GET /api/devhub/projects/:id/env/validate — check required env vars
devhubRouter.get("/projects/:id/env/validate", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;

  // Required env vars per stack
  const requiredByStack: Record<string, string[]> = {
    next: ["NODE_ENV"],
    express: ["PORT"],
    python: ["PYTHON_VERSION"],
    react: ["NODE_ENV"],
    static: [],
  };
  const required = requiredByStack[project.stack] ?? [];
  const missing = required.filter((key) => !(key in project!.envVars));
  res.json({ valid: missing.length === 0, missing });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Media (ElevenLabs TTS)
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/media/tts — text-to-speech via ElevenLabs
devhubRouter.post("/media/tts", async (req, res) => {
  const ttsAuth = verifyBearerOptional(req);
  const ttsUserId = requesterId(req, ttsAuth?.sub);
  const { text, voice = "Rachel" } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.trim().length > 5000) {
    return res.status(400).json({ error: "text too long (max 5000 chars)" });
  }

  const ttsCredit = await checkCredit(ttsUserId, "tts", text.trim().length);
  if (!ttsCredit.allowed) {
    return res.status(402).json({
      error: "Monthly TTS character limit reached",
      tier: ttsCredit.tier, used: ttsCredit.used, limit: ttsCredit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "ElevenLabs not configured — set ELEVENLABS_API_KEY",
      setupUrl: "https://elevenlabs.io/api",
    });
  }

  // Map voice name → ElevenLabs voice ID (common voices)
  const VOICE_IDS: Record<string, string> = {
    Rachel: "21m00Tcm4TlvDq8ikWAM",
    Adam:   "pNInz6obpgDQGcFmaJgB",
    Antoni: "ErXwobaYiN019PkySvjV",
    Arnold: "VR6AewLTigWG4xSOukaG",
    Bella:  "EXAVITQu4vr4xnSDxMaL",
    Domi:   "AZnzlk1XvdvUeBnXmlld",
    Elli:   "MF3mGyEYCl7XYWbV9V6O",
    Josh:   "TxGEqnHWrfWFTfGW9XjX",
    Sam:    "yoZ06aMxZJJ28mfd3POQ",
  };
  const voiceId = VOICE_IDS[voice as string] ?? VOICE_IDS["Rachel"];

  try {
    const elResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    // A retired model id is a provider-side change we cannot prevent, only
    // survive: retry down the fallback chain before failing the user.
    let finalResp = elResp;
    let usedModel = TTS_MODEL;
    if (!finalResp.ok) {
      const firstErr = await finalResp.text();
      if (/unsupported_model|deprecat/i.test(firstErr)) {
        for (const alt of TTS_MODEL_FALLBACKS) {
          const retry = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
            body: JSON.stringify({ text: text.trim(), model_id: alt }),
          });
          if (retry.ok) { finalResp = retry; usedModel = alt; break; }
        }
      }
      if (!finalResp.ok) {
        return res.status(finalResp.status).json({ error: `ElevenLabs error: ${firstErr.slice(0, 200)}`, triedModels: [TTS_MODEL, ...TTS_MODEL_FALLBACKS] });
      }
    }

    const audioBuffer = Buffer.from(await finalResp.arrayBuffer());
    res.setHeader("X-Tts-Model", usedModel);
    await debitCredit(ttsUserId, "tts", text.trim().length).catch(() => {});
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "TTS generation failed" });
  }
});

// POST /api/devhub/media/email — send email via Brevo
devhubRouter.post("/media/email", async (req, res) => {
  const { to, subject, htmlBody, from } = req.body || {};
  if (!to || typeof to !== "string") return res.status(400).json({ error: "to (email) required" });
  if (!subject || typeof subject !== "string") return res.status(400).json({ error: "subject required" });
  if (!htmlBody || typeof htmlBody !== "string") return res.status(400).json({ error: "htmlBody required" });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(to.trim())) return res.status(400).json({ error: "invalid recipient email" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Brevo not configured — set BREVO_API_KEY",
      setupUrl: "https://app.brevo.com/settings/keys/api",
    });
  }

  const senderEmail = (from && typeof from === "string" && emailRe.test(from.trim()))
    ? from.trim()
    : (process.env.BREVO_DEFAULT_SENDER || "noreply@aevion.app");

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "AEVION DevHub" },
        to: [{ email: to.trim() }],
        subject: subject.trim().slice(0, 200),
        htmlContent: htmlBody.slice(0, 100_000),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    const messageId = (data as any)?.messageId ?? null;
    // Считаем в ОБЩУЮ суточную квоту: у Brevo потолок 300 писем в сутки, и он один
    // на всю платформу. Этот путь шлёт письма минуя lib/constitutionBrevo, поэтому
    // без этой строки счётчик занижал бы расход и тревога пришла бы поздно — класс
    // «сторож занижал свой охват». SMS и WhatsApp сюда НЕ входят: у них отдельная
    // квота, и смешивать их значило бы врать обоими числами.
    noteEmailSent();
    res.json({
      ok: true, messageId,
      ...(messageId ? {} : degraded("Brevo accepted the request but returned no messageId — delivery not confirmed")),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Email send failed" });
  }
});

// POST /api/devhub/media/payment-link — create Lemon Squeezy checkout link
devhubRouter.post("/media/payment-link", async (req, res) => {
  const { name, amountCents, description, successUrl } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
  const amt = Number(amountCents);
  if (!Number.isFinite(amt) || amt < 50) return res.status(400).json({ error: "amountCents must be ≥ 50" });

  const lsKey = process.env.LEMON_SQUEEZY_API_KEY?.trim();
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID?.trim();
  const variantId = process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID?.trim();

  if (!lsKey || !storeId || !variantId) {
    return res.status(503).json({
      error: "Lemon Squeezy not configured — set LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID, LEMON_SQUEEZY_DEFAULT_VARIANT_ID",
      setupUrl: "https://app.lemonsqueezy.com",
    });
  }

  const frontendUrl = (process.env.FRONTEND_URL || "https://aevion.app").replace(/\/+$/, "");

  try {
    const body = {
      data: {
        type: "checkouts",
        attributes: {
          custom_price: Math.round(amt),
          checkout_options: { embed: false, media: false, logo: true },
          product_options: {
            name: name.trim().slice(0, 200),
            description: (description || name).trim().slice(0, 500),
            redirect_url: successUrl || `${frontendUrl}/devhub?payment=success`,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    };

    const r = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lsKey}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(r.status).json({ error: `Lemon Squeezy error: ${errText.slice(0, 500)}` });
    }

    const data = await r.json() as { data?: { id?: string; attributes?: { url?: string } } };
    const checkoutUrl = data.data?.attributes?.url;
    const checkoutId = data.data?.id;
    if (!checkoutUrl) return res.status(500).json({ error: "no checkout URL from Lemon Squeezy" });

    res.json({ ok: true, provider: "lemonsqueezy", checkoutId, url: checkoutUrl });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Payment link creation failed" });
  }
});

// POST /api/devhub/media/image — generate image via OpenAI DALL-E 3
devhubRouter.post("/media/image", async (req, res) => {
  const imgAuth = verifyBearerOptional(req);
  const imgUserId = requesterId(req, imgAuth?.sub);
  const { prompt, size = "1024x1024", quality = "standard" } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt required" });
  }
  if (prompt.trim().length > 4000) {
    return res.status(400).json({ error: "prompt too long (max 4000 chars)" });
  }
  const validSizes = ["1024x1024", "1792x1024", "1024x1792"];
  if (!validSizes.includes(size)) {
    return res.status(400).json({ error: `size must be one of ${validSizes.join(", ")}` });
  }

  const imgCredit = await checkCredit(imgUserId, "image");
  if (!imgCredit.allowed) {
    return res.status(402).json({
      error: "Monthly image limit reached",
      tier: imgCredit.tier, used: imgCredit.used, limit: imgCredit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  // Provider fallback chain: OpenAI → Cloudflare Workers AI → Together (FLUX
  // free tier). One paid provider hitting its billing wall must not take the
  // whole feature down when a $0 alternative is already configured.
  type ImageAttempt = { provider: string; status: number; error: string };
  type ImageResult = { provider: string; url?: string; b64?: string; revisedPrompt?: string | null };
  const [width, height] = size.split("x").map(Number);
  const attempts: ImageAttempt[] = [];
  let result: ImageResult | null = null;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    // gpt-image-1 quality values: low/medium/high/auto (not standard/hd)
    const gptQuality = quality === "hd" ? "high" : quality === "standard" ? "medium" : (quality || "medium");
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-image-1", prompt: prompt.trim(), n: 1, size, quality: gptQuality }),
      });
      if (!r.ok) {
        attempts.push({ provider: "openai", status: r.status, error: `DALL-E error: ${(await r.text()).slice(0, 300)}` });
      } else {
        const data = await r.json() as { data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };
        const first = data.data?.[0];
        if (first?.url || first?.b64_json) {
          result = { provider: "openai", url: first.url, b64: first.b64_json, revisedPrompt: first.revised_prompt || null };
        } else {
          attempts.push({ provider: "openai", status: 500, error: "no image in response" });
        }
      }
    } catch (e: any) {
      attempts.push({ provider: "openai", status: 500, error: e?.message || "request failed" });
    }
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!result && cfToken && cfAccount) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), width, height }),
      });
      if (!r.ok) {
        attempts.push({ provider: "workers-ai", status: r.status, error: `Workers AI error: ${(await r.text()).slice(0, 300)}` });
      } else {
        const data = await r.json() as { result?: { image?: string } };
        if (data.result?.image) {
          result = { provider: "workers-ai", b64: data.result.image, revisedPrompt: null };
        } else {
          attempts.push({ provider: "workers-ai", status: 500, error: "no image in response" });
        }
      }
    } catch (e: any) {
      attempts.push({ provider: "workers-ai", status: 500, error: e?.message || "request failed" });
    }
  }

  const togetherKey = process.env.TOGETHER_API_KEY;
  if (!result && togetherKey) {
    try {
      const r = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${togetherKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell-Free", prompt: prompt.trim(), n: 1, width, height, response_format: "b64_json" }),
      });
      if (!r.ok) {
        attempts.push({ provider: "together", status: r.status, error: `Together error: ${(await r.text()).slice(0, 300)}` });
      } else {
        const data = await r.json() as { data?: Array<{ b64_json?: string; url?: string }> };
        const first = data.data?.[0];
        if (first?.b64_json || first?.url) {
          result = { provider: "together", url: first.url, b64: first.b64_json, revisedPrompt: null };
        } else {
          attempts.push({ provider: "together", status: 500, error: "no image in response" });
        }
      }
    } catch (e: any) {
      attempts.push({ provider: "together", status: 500, error: e?.message || "request failed" });
    }
  }

  if (!result) {
    if (attempts.length === 0) {
      return res.status(503).json({
        error: "No image provider configured — set OPENAI_API_KEY, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Workers AI), or TOGETHER_API_KEY",
        setupUrl: "https://platform.openai.com/api-keys",
      });
    }
    // Single provider: preserve its upstream status + error text verbatim
    // (billing limits and quota messages must stay visible to the user).
    if (attempts.length === 1) {
      return res.status(attempts[0].status).json({ error: attempts[0].error, attempts });
    }
    // Every provider in the chain failed — the shop window must stop calling
    // this "live" until one of them works again.
    noteProviderFailure("image", attempts.map((a) => `${a.provider}: ${a.status}`).join("; ") || "all providers failed");
    // Distinguish "your prompt failed" from "nobody is paying the bill".
    // Today all three arms are the latter: OpenAI billing hard limit,
    // Workers AI 401, no Together key — and "All image providers failed"
    // told the user nothing they could act on.
    const blob = attempts.map((a) => `${a.provider}:${a.status}:${a.error || ""}`).join(" | ").toLowerCase();
    const billing = /billing|quota|insufficient|payment|402/.test(blob);
    const auth = /401|403|authentication|unauthorized/.test(blob);
    const fixes: string[] = [];
    if (billing) fixes.push("top up the OpenAI account");
    if (auth) fixes.push("the Cloudflare token needs the Workers AI permission");
    if (!process.env.TOGETHER_API_KEY) fixes.push("or set TOGETHER_API_KEY (free tier) as a fallback");
    return res.status(502).json({
      error: fixes.length
        ? `Image generation is unavailable — every provider is blocked, not your prompt. Fix: ${fixes.join("; ")}.`
        : "All image providers failed",
      providersBlocked: fixes.length > 0,
      attempts,
    });
  }

  // Prefer a permanent Cloudflare Images URL: upstream URLs expire within
  // hours and b64 becomes a multi-megabyte data: URI if saved into a page.
  let imageUrl: string | null = null;
  let storage: "cloudflare" | "upstream" | "inline" = "upstream";
  if (result.url) {
    const permanent = await tryAutoUploadToCloudflare(result.url);
    imageUrl = permanent ?? result.url;
    storage = permanent ? "cloudflare" : "upstream";
  } else if (result.b64) {
    const permanent = await tryAutoUploadImageBufferToCloudflare(Buffer.from(result.b64, "base64"), `devhub-image-${Date.now()}.png`);
    imageUrl = permanent ?? `data:image/png;base64,${result.b64}`;
    storage = permanent ? "cloudflare" : "inline";
  }
  if (!imageUrl) return res.status(500).json({ error: "no image data in response" });
  // A provider in the chain worked — clear any earlier failure so the shop
  // window goes green again on its own.
  noteProviderSuccess("image");
  await debitCredit(imgUserId, "image").catch(() => {});
  res.json({
    ok: true, url: imageUrl, storage, provider: result.provider,
    ...(attempts.length ? { fallbackFrom: attempts.map((a) => a.provider) } : {}),
    revisedPrompt: result.revisedPrompt, creditsUsed: 1,
    creditsRemaining: imgCredit.limit === -1 ? -1 : imgCredit.limit - imgCredit.used - 1,
  });
});

// POST /api/devhub/media/sfx — ElevenLabs sound effect
devhubRouter.post("/media/sfx", async (req, res) => {
  const { text, durationSeconds, promptInfluence } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text (sfx description) required" });
  }
  if (text.trim().length > 1000) {
    return res.status(400).json({ error: "text too long (max 1000 chars)" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "ElevenLabs not configured — set ELEVENLABS_API_KEY",
      setupUrl: "https://elevenlabs.io/api",
    });
  }

  const body: Record<string, unknown> = { text: text.trim() };
  const dur = Number(durationSeconds);
  if (Number.isFinite(dur) && dur >= 0.5 && dur <= 22) body.duration_seconds = dur;
  const inf = Number(promptInfluence);
  if (Number.isFinite(inf) && inf >= 0 && inf <= 1) body.prompt_influence = inf;

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `ElevenLabs SFX error: ${errText.slice(0, 300)}` });
    }
    const audioBuffer = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "SFX generation failed" });
  }
});

// POST /api/devhub/media/music — ElevenLabs music compose
devhubRouter.post("/media/music", async (req, res) => {
  const musicAuth = verifyBearerOptional(req);
  const musicUserId = requesterId(req, musicAuth?.sub);
  const { prompt, musicLengthMs } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt (music description) required" });
  }
  if (prompt.trim().length > 2000) {
    return res.status(400).json({ error: "prompt too long (max 2000 chars)" });
  }

  const musicCredit = await checkCredit(musicUserId, "music");
  if (!musicCredit.allowed) {
    return res.status(402).json({
      error: "Monthly music generation limit reached",
      tier: musicCredit.tier, used: musicCredit.used, limit: musicCredit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  // Music had exactly one provider and no fallback: an ElevenLabs timeout
  // (repeatedly seen on prod) meant no music at all. MusicGen runs on the
  // Replicate token already configured.
  const musicGenFallback = async (reason: string) => {
    if (!replicateToken) return null;
    const secs = Number.isFinite(Number(musicLengthMs)) ? Math.round(Number(musicLengthMs) / 1000) : 8;
    const rr = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${replicateToken}`, "Content-Type": "application/json", Prefer: "respond-async" },
      body: JSON.stringify({
        version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
        input: { prompt: prompt.trim(), duration: Math.min(Math.max(secs || 8, 3), 30), model_version: "stereo-melody-large", output_format: "mp3" },
      }),
    });
    if (!rr.ok) return null;
    const pred = await rr.json() as { id: string; status: string };
    await debitCredit(musicUserId, "music").catch(() => {});
    // Async unlike the ElevenLabs path — say so instead of handing back a
    // body the caller cannot play.
    return { ok: true, provider: "replicate/musicgen", async: true, predictionId: pred.id, status: pred.status, fallbackFrom: reason };
  };

  if (!apiKey) {
    const fb = await musicGenFallback("ELEVENLABS_API_KEY not set");
    if (fb) return res.json(fb);
    return res.status(503).json({
      error: "Music not configured — set ELEVENLABS_API_KEY or REPLICATE_API_TOKEN",
      setupUrl: "https://elevenlabs.io/api",
    });
  }

  const body: Record<string, unknown> = { prompt: prompt.trim() };
  const len = Number(musicLengthMs);
  if (Number.isFinite(len) && len >= 10_000 && len <= 300_000) {
    body.music_length_ms = Math.round(len);
  }

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/music/compose", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text();
      const fb = await musicGenFallback(`ElevenLabs ${r.status}`);
      if (fb) return res.json(fb);
      return res.status(r.status).json({ error: `ElevenLabs Music error: ${errText.slice(0, 300)}` });
    }
    const audioBuffer = Buffer.from(await r.arrayBuffer());
    await debitCredit(musicUserId, "music").catch(() => {});
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (e: any) {
    const fb = await musicGenFallback(e?.message || "ElevenLabs request failed").catch(() => null);
    if (fb) return res.json(fb);
    res.status(500).json({ error: e?.message || "Music compose failed" });
  }
});

// POST /api/devhub/projects/:id/domain/auto-setup — Cloudflare DNS CNAME
devhubRouter.post("/projects/:id/domain/auto-setup", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  if (!project.customDomain) {
    return res.status(400).json({ error: "project has no customDomain set" });
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!cfToken || !cfZoneId) {
    return res.status(503).json({
      error: "Cloudflare not configured — set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID",
      setupUrl: "https://dash.cloudflare.com/profile/api-tokens",
      manualInstruction: `Add CNAME ${project.customDomain} → devhub.aevion.app`,
    });
  }

  const target = "devhub.aevion.app";
  const domain = project.customDomain;

  try {
    const listResp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(domain)}`,
      { headers: { Authorization: `Bearer ${cfToken}`, Accept: "application/json" } }
    );
    if (!listResp.ok) {
      const t = await listResp.text();
      return res.status(listResp.status).json({ error: `Cloudflare list error: ${t.slice(0, 300)}` });
    }
    const listData = await listResp.json() as { result: Array<{ id: string; content: string }> };
    const existing = listData.result?.[0];

    if (existing) {
      if (existing.content === target) {
        return res.json({ ok: true, action: "already-configured", domain, cname: target, recordId: existing.id });
      }
      const upResp = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records/${existing.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ type: "CNAME", name: domain, content: target, ttl: 1, proxied: true }),
        }
      );
      if (!upResp.ok) {
        const t = await upResp.text();
        return res.status(upResp.status).json({ error: `Cloudflare update error: ${t.slice(0, 300)}` });
      }
      return res.json({ ok: true, action: "updated", domain, cname: target, recordId: existing.id });
    }

    const createResp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CNAME", name: domain, content: target, ttl: 1, proxied: true }),
      }
    );
    if (!createResp.ok) {
      const t = await createResp.text();
      return res.status(createResp.status).json({ error: `Cloudflare create error: ${t.slice(0, 300)}` });
    }
    const created = await createResp.json() as { result: { id: string } };
    res.json({ ok: true, action: "created", domain, cname: target, recordId: created.result.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Domain setup failed" });
  }
});

// ── Voice clone helpers ─────────────────────────────────────────────────────

function buildVoiceCloneMultipart(opts: { name: string; description?: string; mimeType: string; audio: Buffer }): { body: Buffer; boundary: string } {
  const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
  const parts: Buffer[] = [];
  const push = (s: string) => parts.push(Buffer.from(s, "utf8"));
  push(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${opts.name}\r\n`);
  if (opts.description) push(`--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n${opts.description}\r\n`);
  push(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="sample.${opts.mimeType.includes("wav") ? "wav" : "mp3"}"\r\nContent-Type: ${opts.mimeType}\r\n\r\n`);
  parts.push(opts.audio);
  push(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat(parts), boundary };
}

// POST /api/devhub/media/voice-clone — ElevenLabs custom voice from sample (requires confirm:true after preview)
devhubRouter.post("/media/voice-clone", async (req, res) => {
  const { name, description, sampleBase64, mimeType = "audio/mpeg", confirm } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name required" });
  if (!sampleBase64 || typeof sampleBase64 !== "string") return res.status(400).json({ error: "sampleBase64 (audio file) required" });
  if (sampleBase64.length > 12_000_000) return res.status(400).json({ error: "sample too large (max ~9 MB base64)" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured — set ELEVENLABS_API_KEY", setupUrl: "https://elevenlabs.io/api" });

  if (confirm !== true) {
    return res.status(400).json({ error: "preview first — pass confirm:true after listening to /media/voice-clone/preview", needsConfirm: true });
  }

  try {
    const audioBuffer = Buffer.from(sampleBase64, "base64");
    const { body, boundary } = buildVoiceCloneMultipart({
      name: name.trim(), description: description ? String(description).slice(0, 500) : undefined,
      mimeType, audio: audioBuffer,
    });
    const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Voice clone error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { voice_id: string; requires_verification?: boolean };
    res.json({ ok: true, voiceId: data.voice_id, requiresVerification: data.requires_verification ?? false });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Voice clone failed" });
  }
});

// POST /api/devhub/media/voice-clone/preview — clone temp voice → TTS sample → delete voice
// Body: { sampleBase64, mimeType?, previewText? }
// Response: audio/mpeg of `previewText` rendered with the cloned voice
devhubRouter.post("/media/voice-clone/preview", async (req, res) => {
  const { sampleBase64, mimeType = "audio/mpeg", previewText } = req.body || {};
  if (!sampleBase64 || typeof sampleBase64 !== "string") return res.status(400).json({ error: "sampleBase64 (audio file) required" });
  if (sampleBase64.length > 12_000_000) return res.status(400).json({ error: "sample too large (max ~9 MB base64)" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured — set ELEVENLABS_API_KEY", setupUrl: "https://elevenlabs.io/api" });

  const text = String(previewText || "AEVION voice preview — your custom voice is ready").slice(0, 500);
  const tempName = `aevion-preview-${crypto.randomBytes(4).toString("hex")}`;
  let voiceId: string | null = null;

  try {
    const audioBuffer = Buffer.from(sampleBase64, "base64");

    // 1. Clone voice (temporary)
    const cloneReq = buildVoiceCloneMultipart({ name: tempName, mimeType, audio: audioBuffer });
    const cloneResp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${cloneReq.boundary}` },
      body: cloneReq.body as unknown as BodyInit,
    });
    if (!cloneResp.ok) {
      const errText = await cloneResp.text();
      return res.status(cloneResp.status).json({ error: `Clone (preview) failed: ${errText.slice(0, 300)}` });
    }
    const cloneData = await cloneResp.json() as { voice_id: string };
    voiceId = cloneData.voice_id;
    if (!voiceId) return res.status(500).json({ error: "no voice_id returned for preview" });

    // 2. Render preview TTS with the cloned voice
    const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
    });
    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      // Best-effort cleanup before bailing
      fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { method: "DELETE", headers: { "xi-api-key": apiKey } }).catch(() => {});
      return res.status(ttsResp.status).json({ error: `Preview TTS failed: ${errText.slice(0, 300)}` });
    }
    const audio = Buffer.from(await ttsResp.arrayBuffer());

    // 3. Best-effort delete to avoid leaking temp voices in the user's account
    try {
      await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: "DELETE", headers: { "xi-api-key": apiKey },
      });
    } catch { /* leak is acceptable — preview already returned */ }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.setHeader("X-Aevion-Preview-Bytes", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (e: any) {
    if (voiceId) {
      fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { method: "DELETE", headers: { "xi-api-key": apiKey } }).catch(() => {});
    }
    res.status(500).json({ error: e?.message || "Voice preview failed" });
  }
});

// POST /api/devhub/media/stt — ElevenLabs Speech-to-Text (scribe-v1)
devhubRouter.post("/media/stt", async (req, res) => {
  const { audioBase64, mimeType = "audio/mpeg", language } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== "string") return res.status(400).json({ error: "audioBase64 required" });
  if (audioBase64.length > 30_000_000) return res.status(400).json({ error: "audio too large (max ~22 MB base64)" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured — set ELEVENLABS_API_KEY" });

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [];
    const push = (s: string) => parts.push(Buffer.from(s, "utf8"));
    push(`--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n`);
    if (language) push(`--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\n${String(language).slice(0, 10)}\r\n`);
    push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${mimeType.includes("wav") ? "wav" : "mp3"}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
    parts.push(audioBuffer);
    push(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(parts);
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `STT error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { text?: string; language_code?: string; language_probability?: number };
    res.json({ ok: true, text: data.text || "", language: data.language_code || null, confidence: data.language_probability ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "STT failed" });
  }
});

// POST /api/devhub/media/drive-search — Google Drive file search
devhubRouter.post("/media/drive-search", async (req, res) => {
  const { query = "", limit = 20 } = req.body || {};
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: "Google Drive not configured — set GOOGLE_DRIVE_ACCESS_TOKEN (OAuth Bearer)",
      setupUrl: "https://developers.google.com/drive/api/quickstart/js",
    });
  }
  try {
    const q = String(query).trim();
    const params = new URLSearchParams({
      pageSize: String(Math.min(Math.max(Number(limit) || 20, 1), 100)),
      fields: "files(id,name,mimeType,modifiedTime,size)",
    });
    if (q) params.set("q", `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`);
    else params.set("q", "trashed = false");
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Drive error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string; size?: string }> };
    res.json({ ok: true, files: data.files || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Drive search failed" });
  }
});

// POST /api/devhub/projects/:id/drive/import — import Drive file into project files
devhubRouter.post("/projects/:id/drive/import", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { fileId, targetPath } = req.body || {};
  if (!fileId || typeof fileId !== "string") return res.status(400).json({ error: "fileId required" });
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Google Drive not configured — set GOOGLE_DRIVE_ACCESS_TOKEN" });

  try {
    const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaResp.ok) {
      const t = await metaResp.text();
      return res.status(metaResp.status).json({ error: `Drive metadata error: ${t.slice(0, 200)}` });
    }
    const meta = await metaResp.json() as { name: string; mimeType: string };
    const isGoogleDoc = meta.mimeType.startsWith("application/vnd.google-apps");
    let contentResp: Response;
    if (isGoogleDoc) {
      const exportMime = meta.mimeType.includes("document") ? "text/markdown"
                      : meta.mimeType.includes("spreadsheet") ? "text/csv"
                      : "text/plain";
      contentResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      contentResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (!contentResp.ok) {
      const t = await contentResp.text();
      return res.status(contentResp.status).json({ error: `Drive content error: ${t.slice(0, 200)}` });
    }
    const content = await contentResp.text();
    const path = String(targetPath || meta.name).replace(/^\/+/, "").slice(0, 200) || meta.name;
    const file: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path,
      content,
      language: detectLanguage(path),
      updatedAt: now(),
    };
    // Признак хранилища: при отказе базы файл живёт в памяти процесса и
    // пропадёт со следующей выкаткой, а ответ до 19.08.2026 об этом молчал.
    let storage: "db" | "memory" = "db";
    try { await dbUpsertFile(file); }
    catch {
      const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === path);
      if (existing) { existing.content = file.content; existing.language = file.language; existing.updatedAt = file.updatedAt; }
      else memFiles.set(file.id, file);
      storage = "memory";
    }
    res.json({ ok: true, path, bytes: content.length, mimeType: meta.mimeType, storage });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Drive import failed" });
  }
});

// ── Visual Edit preview proxy (non-static stacks) ───────────────────────────
//
// Static projects render in the IDE via srcdoc; Next/React/Express projects
// need their deployed page instead. Fetching it client-side is impossible
// (cross-origin iframe = no overlay injection), so this proxies the project's
// OWN deployUrl — never a caller-supplied URL, which would be SSRF — and
// injects a runtime tagger + the same postMessage overlay contract the static
// path uses. Served same-origin, sandboxed by the IDE as allow-scripts only.
const PREVIEW_PROXY_OVERLAY = `
(function(){
  function init(){
    var counter = 0;
    var SKIP = { SCRIPT: 1, STYLE: 1 };
    var all = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < all.length; i++) {
      if (!SKIP[all[i].tagName]) all[i].setAttribute('data-vid', String(counter++));
    }
    var hovered = null;
    function withVid(el){ while (el && !(el.getAttribute && el.getAttribute('data-vid'))) el = el.parentElement; return el; }
    function brief(el){ return { vid: el.getAttribute('data-vid'), tagName: el.tagName }; }
    function select(el){
      var cs = getComputedStyle(el);
      var ancestors = [];
      for (var p = el.parentElement; p && ancestors.length < 6; p = p.parentElement) {
        if (p.getAttribute && p.getAttribute('data-vid')) ancestors.push(brief(p));
      }
      var children = [];
      for (var i = 0; i < el.children.length && children.length < 8; i++) {
        if (el.children[i].getAttribute('data-vid')) children.push(brief(el.children[i]));
      }
      parent.postMessage({
        source: 'devhub-visual-edit', vid: el.getAttribute('data-vid'), tagName: el.tagName, text: el.textContent || '',
        styles: { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, textAlign: cs.textAlign },
        src: el.getAttribute('src') || '',
        proxied: true,
        ancestors: ancestors, children: children
      }, '*');
    }
    document.addEventListener('mouseover', function(e){
      var el = withVid(e.target);
      if (hovered && hovered !== el) hovered.style.outline = '';
      hovered = el;
      if (hovered) { hovered.style.outline = '2px solid #0d9488'; hovered.style.outlineOffset = '1px'; }
    }, true);
    document.addEventListener('mouseout', function(){ if (hovered) { hovered.style.outline = ''; hovered = null; } }, true);
    document.addEventListener('click', function(e){
      var el = withVid(e.target);
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      select(el);
    }, true);
    window.addEventListener('message', function(e){
      var d = e.data;
      if (d && d.source === 'devhub-visual-edit-select') {
        var target = document.querySelector('[data-vid="' + d.vid + '"]');
        if (target) select(target);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
`;

devhubRouter.get("/projects/:id/preview-proxy", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || !canAccess(project, userId)) {
    return res.status(404).json({ error: "project not found" });
  }
  const deployUrl = (project.deployUrl || "").replace(/^(https?:\/\/)+(?=https?:\/\/)/, "");
  if (!deployUrl || !deployUrl.startsWith("https://")) {
    return res.status(409).json({ error: "project has no https deployment yet — deploy first to use Visual Edit on this stack" });
  }
  try {
    const r = await fetch(deployUrl, { headers: { Accept: "text/html" }, redirect: "follow" });
    if (!r.ok) {
      return res.status(502).json({ error: `deployed page responded ${r.status}` });
    }
    let html = await r.text();
    // <base> makes the page's relative assets resolve against the real deploy
    // origin even though the document itself is served from ours.
    const baseTag = `<base href="${deployUrl.replace(/"/g, "%22")}${deployUrl.endsWith("/") ? "" : "/"}">`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
    } else {
      html = baseTag + html;
    }
    const overlayTag = `<script>${PREVIEW_PROXY_OVERLAY}</script>`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${overlayTag}</body>`) : html + overlayTag;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (e: any) {
    res.status(502).json({ error: e?.message || "failed to fetch deployed page" });
  }
});

// ── Agent workflow step execution ───────────────────────────────────────────
//
// One step-runner shared by the sync and SSE workflow routes (previously two
// ~200-line copies of the same if/else chain). Each step catches its own
// error and RETURNS a result rather than throwing, so callers can run a batch
// of independent steps through Promise.all without one failure aborting the
// others (matches the existing "report per-step errors, don't abort" contract).
type WorkflowStepResult = { step: number; type: string; ok: boolean; output?: any; error?: string; savedAs?: string };

async function executeWorkflowStep(
  project: DevHubProject,
  userId: string,
  step: any,
  i: number
): Promise<WorkflowStepResult> {
  const type = String(step?.type || "");
  try {
    if (type === "code") {
      const prompt = String(step.prompt || "");
      if (!prompt) throw new Error("prompt required for code step");
      const stack = String(step.stack || project.stack);
      const targetFiles: string[] = Array.isArray(step.saveAs)
        ? step.saveAs.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0).map((f: string) => f.trim())
        : (step.saveAs ? [String(step.saveAs)] : []);
      const existingFiles = await dbListFiles(project.id);
      const { files, aiGenerated, syntaxErrors, selfCorrected } = await generateCodeWithAI(prompt, stack, targetFiles, existingFiles);
      const checkpointId = await createCheckpoint(project.id, userId, `AI workflow step ${i}: ${prompt.slice(0, 60)}`, files.map((f) => f.path), existingFiles);
      for (const gf of files) {
        const f: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: gf.path,
          content: gf.content, language: gf.language || detectLanguage(gf.path), updatedAt: now(),
        };
        try { await dbUpsertFile(f); }
        catch {
          const existing = [...memFiles.values()].find((x) => x.projectId === project.id && x.path === gf.path);
          if (existing) { existing.content = f.content; existing.language = f.language; existing.updatedAt = f.updatedAt; }
          else memFiles.set(f.id, f);
        }
      }
      return { step: i, type, ok: true, output: { files: files.map((f) => f.path), aiGenerated, ...(syntaxErrors ? { syntaxErrors } : {}), ...(selfCorrected ? { selfCorrected } : {}), checkpointId } };
    }
    if (type === "image") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");
      const prompt = String(step.prompt || "");
      if (!prompt) throw new Error("prompt required for image step");
      const dResp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: step.size || "1024x1024" }),
      });
      if (!dResp.ok) throw new Error(`DALL-E error: ${(await dResp.text()).slice(0, 200)}`);
      const d = await dResp.json() as { data: Array<{ url: string }> };
      const oaiUrl = d.data?.[0]?.url;
      if (!oaiUrl) throw new Error("no image url returned");
      const permanentUrl = await tryAutoUploadToCloudflare(oaiUrl);
      const url = permanentUrl || oaiUrl;
      const savedAs = step.saveAs ? String(step.saveAs) : `public/image-${i}.url.txt`;
      const f: DevHubFile = {
        id: crypto.randomUUID(), projectId: project.id, path: savedAs,
        content: url, language: detectLanguage(savedAs), updatedAt: now(),
      };
      try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
      return { step: i, type, ok: true, output: { url }, savedAs };
    }
    if (type === "tts") {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
      const text = String(step.text || "");
      if (!text) throw new Error("text required for tts step");
      const VOICE_IDS: Record<string, string> = {
        Rachel: "21m00Tcm4TlvDq8ikWAM", Adam: "pNInz6obpgDQGcFmaJgB",
        Antoni: "ErXwobaYiN019PkySvjV", Bella: "EXAVITQu4vr4xnSDxMaL",
      };
      const voiceId = VOICE_IDS[String(step.voice || "Rachel")] || VOICE_IDS.Rachel;
      const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: TTS_MODEL }),
      });
      if (!ttsResp.ok) throw new Error(`TTS error: ${(await ttsResp.text()).slice(0, 200)}`);
      const audioBuf = Buffer.from(await ttsResp.arrayBuffer());
      const r2Key = `audio/${project.id}/tts-${i}-${Date.now()}.mp3`;
      const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
      if (cdnUrl) {
        const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/voice-${i}.url.txt`;
        const f: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: savedAs,
          content: cdnUrl, language: "plaintext", updatedAt: now(),
        };
        try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
        return { step: i, type, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs };
      }
      const savedAs = step.saveAs ? String(step.saveAs) : `public/voice-${i}.mp3.b64`;
      const f: DevHubFile = {
        id: crypto.randomUUID(), projectId: project.id, path: savedAs,
        content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
      };
      try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
      return { step: i, type, ok: true, output: { bytes: audioBuf.length }, savedAs };
    }
    if (type === "sfx") {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
      const text = String(step.text || "");
      if (!text) throw new Error("text required for sfx step");
      const body: Record<string, unknown> = { text };
      const dur = Number(step.durationSeconds);
      if (Number.isFinite(dur) && dur >= 0.5 && dur <= 22) body.duration_seconds = dur;
      const sfxResp = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify(body),
      });
      if (!sfxResp.ok) throw new Error(`SFX error: ${(await sfxResp.text()).slice(0, 200)}`);
      const audioBuf = Buffer.from(await sfxResp.arrayBuffer());
      const r2Key = `audio/${project.id}/sfx-${i}-${Date.now()}.mp3`;
      const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
      if (cdnUrl) {
        const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/sfx-${i}.url.txt`;
        const f: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: savedAs,
          content: cdnUrl, language: "plaintext", updatedAt: now(),
        };
        try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
        return { step: i, type, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs };
      }
      const savedAs = step.saveAs ? String(step.saveAs) : `public/sfx-${i}.mp3.b64`;
      const f: DevHubFile = {
        id: crypto.randomUUID(), projectId: project.id, path: savedAs,
        content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
      };
      try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
      return { step: i, type, ok: true, output: { bytes: audioBuf.length }, savedAs };
    }
    if (type === "music") {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
      const prompt = String(step.prompt || step.text || "");
      if (!prompt) throw new Error("prompt required for music step");
      const body: Record<string, unknown> = { prompt };
      const lenSec = Number(step.lengthSeconds);
      if (Number.isFinite(lenSec) && lenSec >= 10 && lenSec <= 300) {
        body.music_length_ms = Math.round(lenSec * 1000);
      }
      const musicResp = await fetch("https://api.elevenlabs.io/v1/music/compose", {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify(body),
      });
      if (!musicResp.ok) throw new Error(`Music error: ${(await musicResp.text()).slice(0, 200)}`);
      const audioBuf = Buffer.from(await musicResp.arrayBuffer());
      const r2Key = `audio/${project.id}/music-${i}-${Date.now()}.mp3`;
      const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
      if (cdnUrl) {
        const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/music-${i}.url.txt`;
        const f: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: savedAs,
          content: cdnUrl, language: "plaintext", updatedAt: now(),
        };
        try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
        return { step: i, type, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs };
      }
      const savedAs = step.saveAs ? String(step.saveAs) : `public/music-${i}.mp3.b64`;
      const f: DevHubFile = {
        id: crypto.randomUUID(), projectId: project.id, path: savedAs,
        content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
      };
      try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
      return { step: i, type, ok: true, output: { bytes: audioBuf.length }, savedAs };
    }
    return { step: i, type, ok: false, error: `unknown step type: ${type}` };
  } catch (e: any) {
    return { step: i, type, ok: false, error: e?.message || "step failed" };
  }
}

/** Groups step indices for execution: a "code" step always runs alone (each
 * one reads dbListFiles fresh, so a later code step must see an earlier
 * code step's write — they cannot run concurrently with each other). Runs of
 * consecutive non-code steps (image/tts/sfx/music) are batched together,
 * since none of them read another step's output — safe to run via
 * Promise.all instead of paying their latency sequentially. */
function groupWorkflowSteps(steps: any[]): number[][] {
  const groups: number[][] = [];
  let batch: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (String(steps[i]?.type || "") === "code") {
      if (batch.length) { groups.push(batch); batch = []; }
      groups.push([i]);
    } else {
      batch.push(i);
    }
  }
  if (batch.length) groups.push(batch);
  return groups;
}

// POST /api/devhub/projects/:id/agent/workflow — orchestrate multi-step AI workflow
devhubRouter.post("/projects/:id/agent/workflow", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { steps } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: "steps array required" });
  if (steps.length > 20) return res.status(400).json({ error: "max 20 steps per workflow" });

  const results: WorkflowStepResult[] = new Array(steps.length);
  for (const group of groupWorkflowSteps(steps)) {
    if (group.length === 1) {
      const i = group[0];
      results[i] = await executeWorkflowStep(project, userId, steps[i], i);
    } else {
      // Independent non-code steps (image/tts/sfx/music) — none reads
      // another's output, so run them concurrently instead of paying their
      // latency one after another.
      const settled = await Promise.all(group.map((i) => executeWorkflowStep(project, userId, steps[i], i)));
      for (const r of settled) results[r.step] = r;
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({
    ok: okCount === results.length,
    totalSteps: results.length,
    successCount: okCount,
    failureCount: results.length - okCount,
    results,
  });
});

// ── Agent workflow templates ────────────────────────────────────────────────
const AGENT_WORKFLOW_TEMPLATES = [
  {
    id: "landing",
    name: "Landing page",
    description: "Hero + headline + CTA + voiceover + sound effect",
    steps: [
      { type: "code", prompt: "Modern landing page: hero section with headline, subheadline, and CTA button. Tailwind, dark theme.", saveAs: "pages/index.tsx" },
      { type: "image", prompt: "Futuristic abstract gradient, purple and teal, soft glow, hero background", size: "1792x1024", saveAs: "public/hero.url.txt" },
      { type: "tts", text: "Welcome to AEVION — the unified AI platform. Build, deploy, and scale your ideas in one place.", voice: "Rachel", saveAs: "public/welcome.mp3.b64" },
      { type: "sfx", text: "Subtle whoosh transition, modern UI sound", durationSeconds: 1.5, saveAs: "public/whoosh.mp3.b64" },
      { type: "music", prompt: "Ambient electronic background, soft synth pads, hopeful, looped — for landing page hero", lengthSeconds: 30, saveAs: "public/landing-bg.mp3.b64" },
    ],
  },
  {
    id: "blog",
    name: "Blog post",
    description: "Article with header image + audio narration",
    steps: [
      { type: "code", prompt: "Blog post page with title, date, hero image, and markdown article body in Next.js", saveAs: "pages/post.tsx" },
      { type: "image", prompt: "Editorial illustration, flat design, vibrant colors, abstract concept", size: "1024x1024", saveAs: "public/article-hero.url.txt" },
      { type: "tts", text: "Welcome to our weekly article. Today, we explore the future of AI-assisted development.", voice: "Adam", saveAs: "public/narration.mp3.b64" },
    ],
  },
  {
    id: "dashboard",
    name: "Analytics dashboard",
    description: "Stats cards + chart + onboarding voice",
    steps: [
      { type: "code", prompt: "Analytics dashboard: 4 stat cards (users, revenue, sessions, conversion) + bar chart of last 7 days. Mock data, light theme.", saveAs: "pages/dashboard.tsx" },
      { type: "image", prompt: "Minimal dashboard UI mockup, light theme, clean typography", size: "1024x1024", saveAs: "public/dashboard-preview.url.txt" },
      { type: "tts", text: "Your dashboard is ready. Track users, revenue, and conversion in real time.", voice: "Bella", saveAs: "public/dashboard-intro.mp3.b64" },
    ],
  },
];

// GET /api/devhub/agent/templates
devhubRouter.get("/agent/templates", (_req, res) => {
  res.json({ templates: AGENT_WORKFLOW_TEMPLATES });
});

// POST /api/devhub/projects/:id/agent/workflow/stream — SSE per-step progress
devhubRouter.post("/projects/:id/agent/workflow/stream", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { steps } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: "steps array required" });
  if (steps.length > 20) return res.status(400).json({ error: "max 20 steps per workflow" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (event: any) => {
    try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* socket closed */ }
  };

  emit({ type: "start", totalSteps: steps.length });

  let okCount = 0;
  const emitStepDone = (r: WorkflowStepResult) => {
    emit(r.ok
      ? { type: "step-done", index: r.step, ok: true, output: r.output, ...(r.savedAs ? { savedAs: r.savedAs } : {}) }
      : { type: "step-done", index: r.step, ok: false, error: r.error });
    if (r.ok) okCount++;
  };

  for (const group of groupWorkflowSteps(steps)) {
    group.forEach((i) => emit({ type: "step-start", index: i, stepType: String(steps[i]?.type || "") }));
    if (group.length === 1) {
      const i = group[0];
      emitStepDone(await executeWorkflowStep(project, userId, steps[i], i));
    } else {
      // Independent non-code steps — emit each step-done the moment IT
      // finishes rather than waiting for the whole batch, so the client sees
      // genuinely concurrent progress instead of a fake sequential trickle.
      await Promise.all(group.map((i) =>
        executeWorkflowStep(project, userId, steps[i], i).then(emitStepDone)
      ));
    }
  }

  emit({ type: "complete", totalSteps: steps.length, successCount: okCount, failureCount: steps.length - okCount });
  res.end();
});

// POST /api/devhub/media/sms — Brevo transactional SMS
devhubRouter.post("/media/sms", async (req, res) => {
  const { recipient, content, sender } = req.body || {};
  if (!recipient || typeof recipient !== "string") return res.status(400).json({ error: "recipient (E.164 phone) required" });
  if (!/^\+\d{6,18}$/.test(recipient.trim())) return res.status(400).json({ error: "recipient must be E.164 format (e.g. +14155552671)" });
  if (!content || typeof content !== "string") return res.status(400).json({ error: "content required" });
  if (content.length > 612) return res.status(400).json({ error: "content too long (max 612 chars, 4 SMS segments)" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Brevo not configured — set BREVO_API_KEY",
      setupUrl: "https://app.brevo.com/settings/keys/api",
    });
  }

  const senderName = (typeof sender === "string" && sender.trim()) ? sender.trim().slice(0, 11) : (process.env.BREVO_SMS_SENDER || "AEVION");

  try {
    const r = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type: "transactional",
        sender: senderName,
        recipient: recipient.trim(),
        content: content.slice(0, 612),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo SMS error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    const messageId = (data as any)?.messageId ?? null;
    res.json({
      ok: true,
      reference: (data as any)?.reference ?? null,
      messageId,
      smsCount: (data as any)?.smsCount ?? null,
      ...(messageId ? {} : degraded("Brevo accepted the request but returned no messageId — delivery not confirmed")),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "SMS send failed" });
  }
});

// POST /api/devhub/media/whatsapp — Brevo WhatsApp template message
devhubRouter.post("/media/whatsapp", async (req, res) => {
  const { contactNumber, templateId, params } = req.body || {};
  if (!contactNumber || typeof contactNumber !== "string") return res.status(400).json({ error: "contactNumber (E.164 phone) required" });
  if (!/^\+?\d{6,18}$/.test(contactNumber.trim())) return res.status(400).json({ error: "contactNumber must be E.164 format" });
  if (!templateId || (typeof templateId !== "string" && typeof templateId !== "number")) return res.status(400).json({ error: "templateId required (approved WABA template)" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });
  }

  const senderNumberId = process.env.BREVO_WHATSAPP_SENDER_ID;
  if (!senderNumberId) {
    return res.status(503).json({
      error: "Brevo WhatsApp sender not configured — set BREVO_WHATSAPP_SENDER_ID",
      setupUrl: "https://app.brevo.com/whatsapp",
    });
  }

  try {
    const r = await fetch("https://api.brevo.com/v3/whatsapp/sendMessage", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        senderNumberId,
        contactNumbers: [contactNumber.trim().replace(/^\+/, "")],
        templateId: Number(templateId) || templateId,
        ...(params && typeof params === "object" ? { params } : {}),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo WhatsApp error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    const messageId = (data as any)?.messageId ?? null;
    res.json({
      ok: true, messageId,
      ...(messageId ? {} : degraded("Brevo accepted the request but returned no messageId — delivery not confirmed")),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "WhatsApp send failed" });
  }
});

// POST /api/devhub/media/gumroad-checkout — build a Gumroad product checkout URL
// for a DevHub-built product. Gumroad is the only live processor (Stripe/Paddle
// are blocked by KYC). Price is fixed in the Gumroad product itself, not passed
// here — same public-URL scheme as lib/payment/gumroadProvider. No API key needed
// to generate the link (the URL is a public product page).
// Body: { permalink: string (slug or full Gumroad URL), email?: string }
devhubRouter.post("/media/gumroad-checkout", async (req, res) => {
  const { permalink, email } = req.body || {};
  if (!permalink || typeof permalink !== "string" || !permalink.trim()) return res.status(400).json({ error: "permalink required (Gumroad product slug, e.g. 'my-product')" });
  // Accept a raw slug or a full https://app.gumroad.com/l/<slug> URL.
  const slug = permalink.trim().replace(/^https?:\/\/[^/]+\/l\//i, "").replace(/^\/+|[/?#].*$/g, "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return res.status(400).json({ error: "permalink must be a Gumroad product slug (letters, digits, -, _)" });
  if (email != null && (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) return res.status(400).json({ error: "email must be a valid address" });

  const url = email
    ? `https://app.gumroad.com/l/${slug}?wanted_email=${encodeURIComponent(String(email).trim())}`
    : `https://app.gumroad.com/l/${slug}`;
  res.json({ ok: true, url, provider: "gumroad" });
});

// POST /api/devhub/media/upload-image — upload image to Cloudflare Images (permanent CDN URL)
// Body: { sourceUrl?: string } OR { base64: string, mimeType?: string }
// Загрузка в Cloudflare Images — платная услуга, а ручка была анонимной и без
// предела: расход и квоту мог жечь кто угодно. Ограничитель, как у соседних
// дорогих ручек.
//
// Отдельно, чтобы следующий читатель не искал того, чего нет: `sourceUrl` НЕ даёт
// обхода в нашу сеть. Адрес уходит в Cloudflare полем формы `url`, и по нему идёт
// ИХ сервис, а не наш сервер. Я начинал разбор с обратной гипотезы и проверил её
// прежде, чем записывать.
devhubRouter.post("/media/upload-image", dhCostlyLimit("dhmedia_upload"), async (req, res) => {
  const { sourceUrl, base64, mimeType = "image/png" } = req.body || {};
  if (!sourceUrl && !base64) {
    return res.status(400).json({ error: "sourceUrl or base64 required" });
  }

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken || !accountId) {
    return res.status(503).json({
      error: "Cloudflare Images not configured — set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID",
      setupUrl: "https://dash.cloudflare.com/profile/api-tokens",
    });
  }

  try {
    // Cloudflare Images API: multipart form, "url" OR "file" field
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [];
    const push = (s: string) => parts.push(Buffer.from(s, "utf8"));

    if (sourceUrl) {
      push(`--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${String(sourceUrl)}\r\n`);
    } else {
      const ext = mimeType.includes("png") ? "png" : mimeType.includes("jpg") || mimeType.includes("jpeg") ? "jpg" : "bin";
      push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
      parts.push(Buffer.from(base64, "base64"));
      push(`\r\n`);
    }
    push(`--${boundary}--\r\n`);
    const body = Buffer.concat(parts);

    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Cloudflare Images error: ${errText.slice(0, 400)}` });
    }
    const data = await r.json() as { result?: { id: string; variants: string[]; uploaded: string } };
    if (!data.result?.id) {
      return res.status(500).json({ error: "no image id returned from Cloudflare" });
    }
    res.json({
      ok: true,
      imageId: data.result.id,
      url: data.result.variants?.[0] || null,
      variants: data.result.variants || [],
      uploaded: data.result.uploaded,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Image upload failed" });
  }
});

// ── Helper: auto-upload DALL-E URL to Cloudflare Images if env set ───────────
/** Polls a freshly deployed URL until it returns 2xx (5 tries, 5s apart).
 * Exported for tests. attemptDelayMs is overridable so tests don't sleep. */
export async function verifyDeploymentServes(url: string, attemptDelayMs = 5000): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const check = await fetch(url, { method: "GET", redirect: "follow" });
      if (check.ok) return true;
    } catch { /* network — retry */ }
    if (attempt < 4) await new Promise((r) => setTimeout(r, attemptDelayMs));
  }
  return false;
}

/** Same Cloudflare Images upload as tryAutoUploadToCloudflare, but for raw
 * bytes (gpt-image-1 returns b64_json — there is no upstream URL to import). */
async function tryAutoUploadImageBufferToCloudflare(buf: Buffer, filename: string): Promise<string | null> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken || !accountId) return null;
  try {
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`, "utf8"),
      buf,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
    ];
    const body = Buffer.concat(parts);
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) return null;
    const data = await r.json() as { result?: { variants?: string[] } };
    return data.result?.variants?.[0] ?? null;
  } catch { return null; }
}

async function tryAutoUploadToCloudflare(sourceUrl: string): Promise<string | null> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken || !accountId) return null;
  try {
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${sourceUrl}\r\n--${boundary}--\r\n`, "utf8"));
    const body = Buffer.concat(parts);
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) return null;
    const data = await r.json() as { result?: { variants?: string[] } };
    return data.result?.variants?.[0] ?? null;
  } catch { return null; }
}

// POST /api/devhub/media/translate — DeepL text translation
devhubRouter.post("/media/translate", async (req, res) => {
  const { text, targetLang, sourceLang, formality } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
  if (!targetLang || typeof targetLang !== "string") return res.status(400).json({ error: "targetLang required (e.g. EN, RU, DE, ES, FR)" });
  if (text.length > 128_000) return res.status(400).json({ error: "text too long (max 128k chars)" });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "DeepL not configured — set DEEPL_API_KEY",
      setupUrl: "https://www.deepl.com/account/summary",
    });
  }
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", targetLang.toUpperCase().slice(0, 5));
    if (sourceLang) params.append("source_lang", String(sourceLang).toUpperCase().slice(0, 5));
    if (formality && ["default", "more", "less", "prefer_more", "prefer_less"].includes(String(formality))) {
      params.append("formality", String(formality));
    }
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!r.ok) {
      const errText = await r.text();
      // 456 is DeepL's quota code. Worth naming, because their /v2/usage
      // endpoint happily reports 0 of 1,000,000 characters used while every
      // translate call is refused — the account state is only visible from a
      // real call (verified against our own key, 2026-07-26).
      if (r.status === 456) {
        return res.status(456).json({
          error: "Translation unavailable — the DeepL account is out of quota. Their usage page can still show 0 used, so check the account or swap DEEPL_API_KEY.",
          provider: "deepl",
          accountUrl: "https://www.deepl.com/account/usage",
        });
      }
      return res.status(r.status).json({ error: `DeepL error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { translations: Array<{ text: string; detected_source_language: string }> };
    const first = data.translations?.[0];
    if (!first) return res.status(500).json({ error: "no translation returned" });
    res.json({
      ok: true,
      text: first.text,
      detectedSource: first.detected_source_language,
      targetLang: targetLang.toUpperCase(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Translation failed" });
  }
});

// POST /api/devhub/projects/:id/files/translate — translate project file → save as new file
devhubRouter.post("/projects/:id/files/translate", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { path, targetLang, saveAs } = req.body || {};
  if (!path || typeof path !== "string") return res.status(400).json({ error: "path required" });
  if (!targetLang || typeof targetLang !== "string") return res.status(400).json({ error: "targetLang required" });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "DeepL not configured — set DEEPL_API_KEY" });

  let file: DevHubFile | null;
  let readFailed = false;
  try { file = await dbGetFile(project.id, path); }
  catch {
    readFailed = true;
    file = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === path) ?? null;
  }
  // «Файла нет в проекте» на упавшей базе — ложь о существующем файле.
  if (!file && readFailed) return replyStorageUnavailable(res);
  if (!file) return res.status(404).json({ error: "file not found in project" });

  const endpoint = apiKey.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  try {
    const params = new URLSearchParams();
    params.append("text", file.content);
    params.append("target_lang", targetLang.toUpperCase().slice(0, 5));
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!r.ok) {
      const errText = await r.text();
      // 456 is DeepL's quota code. Worth naming, because their /v2/usage
      // endpoint happily reports 0 of 1,000,000 characters used while every
      // translate call is refused — the account state is only visible from a
      // real call (verified against our own key, 2026-07-26).
      if (r.status === 456) {
        return res.status(456).json({
          error: "Translation unavailable — the DeepL account is out of quota. Their usage page can still show 0 used, so check the account or swap DEEPL_API_KEY.",
          provider: "deepl",
          accountUrl: "https://www.deepl.com/account/usage",
        });
      }
      return res.status(r.status).json({ error: `DeepL error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { translations: Array<{ text: string }> };
    const translated = data.translations?.[0]?.text;
    if (!translated) return res.status(500).json({ error: "no translation returned" });

    const lang = targetLang.toLowerCase();
    const newPath = String(saveAs || path.replace(/(\.[^./]+)$/, `.${lang}$1`) || `${path}.${lang}`).slice(0, 200);
    const out: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path: newPath,
      content: translated,
      language: file.language,
      updatedAt: now(),
    };
    let storage: "db" | "memory" = "db";
    try { await dbUpsertFile(out); }
    catch {
      // Перевод сохранён только в памяти процесса и не переживёт перезапуск.
      // Раньше ответ был неотличим от настоящего сохранения.
      storage = "memory";
      const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === newPath);
      if (existing) { existing.content = out.content; existing.updatedAt = out.updatedAt; }
      else memFiles.set(out.id, out);
    }
    res.json({
      ok: true,
      path: newPath,
      bytes: translated.length,
      targetLang: targetLang.toUpperCase(),
      storage,
      ...(storage === "memory"
        ? { warning: "Хранилище недоступно: перевод сохранён только до перезапуска сервиса." }
        : {}),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "File translation failed" });
  }
});

// GET /api/devhub/media/email-templates — list Brevo SMTP templates
devhubRouter.get("/media/email-templates", async (req, res) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const r = await fetch(`https://api.brevo.com/v3/smtp/templates?limit=${limit}&offset=${offset}`, {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { templates?: Array<{ id: number; name: string; subject: string; isActive: boolean; createdAt: string }>; count?: number };
    res.json({
      ok: true,
      total: data.count ?? 0,
      templates: (data.templates || []).map((t) => ({
        id: t.id, name: t.name, subject: t.subject, isActive: t.isActive, createdAt: t.createdAt,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Templates fetch failed" });
  }
});

// POST /api/devhub/media/email-template-send — send transac email by template ID with params
devhubRouter.post("/media/email-template-send", async (req, res) => {
  const { templateId, to, params } = req.body || {};
  if (!templateId || (typeof templateId !== "number" && typeof templateId !== "string")) {
    return res.status(400).json({ error: "templateId required" });
  }
  if (!to || typeof to !== "string") return res.status(400).json({ error: "to (email) required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) return res.status(400).json({ error: "invalid recipient email" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        templateId: Number(templateId) || templateId,
        to: [{ email: to.trim() }],
        ...(params && typeof params === "object" ? { params } : {}),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    noteEmailSent(); // тот же общий потолок 300 писем в сутки, см. выше
    res.json({ ok: true, messageId: (data as any)?.messageId ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Template send failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Binary file serving (decode .b64 → audio/image MIME)
// ═════════════════════════════════════════════════════════════════════════════

const B64_BINARY_MIME: Record<string, string> = {
  ".mp3.b64": "audio/mpeg",
  ".wav.b64": "audio/wav",
  ".ogg.b64": "audio/ogg",
  ".png.b64": "image/png",
  ".jpg.b64": "image/jpeg",
  ".webp.b64": "image/webp",
};

function detectB64Mime(path: string): string | null {
  for (const [suffix, mime] of Object.entries(B64_BINARY_MIME)) {
    if (path.toLowerCase().endsWith(suffix)) return mime;
  }
  return null;
}

// GET /api/devhub/projects/:id/file-binary?path=... — decode base64 file and serve as binary
devhubRouter.get("/projects/:id/file-binary", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const filePath = String(req.query.path || "");
  if (!filePath) return res.status(400).json({ error: "path query param required" });

  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  let file: DevHubFile | null;
  let readFailed = false;
  try { file = await dbGetFile(project.id, filePath); }
  catch {
    readFailed = true;
    file = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === filePath) ?? null;
  }
  // «Файл не найден» на упавшей базе — ложь о существующем файле.
  if (!file && readFailed) return replyStorageUnavailable(res);
  if (!file) return res.status(404).json({ error: "file not found" });

  const mime = detectB64Mime(filePath) || "application/octet-stream";
  try {
    const buf = Buffer.from(file.content, "base64");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch {
    res.status(500).json({ error: "failed to decode base64 content" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Bulk DeepL translate (multi-file × multi-lang)
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/projects/:id/files/translate-bulk", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { paths, targetLangs } = req.body || {};
  if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: "paths array required" });
  if (!Array.isArray(targetLangs) || targetLangs.length === 0) return res.status(400).json({ error: "targetLangs array required" });
  if (paths.length * targetLangs.length > 50) return res.status(400).json({ error: "max 50 translations per bulk call" });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "DeepL not configured — set DEEPL_API_KEY" });
  const endpoint = apiKey.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";

  const results: Array<{ path: string; targetLang: string; ok: boolean; outputPath?: string; bytes?: number; error?: string }> = [];

  for (const p of paths) {
    let file: DevHubFile | null;
    try { file = await dbGetFile(project.id, String(p)); }
    catch { file = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === String(p)) ?? null; }
    if (!file) {
      for (const lang of targetLangs) {
        results.push({ path: String(p), targetLang: String(lang), ok: false, error: "file not found" });
      }
      continue;
    }
    for (const lang of targetLangs) {
      try {
        const params = new URLSearchParams();
        params.append("text", file.content);
        params.append("target_lang", String(lang).toUpperCase().slice(0, 5));
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        if (!r.ok) {
          const errText = await r.text();
          results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: false, error: errText.slice(0, 200) });
          continue;
        }
        const data = await r.json() as { translations: Array<{ text: string }> };
        const translated = data.translations?.[0]?.text;
        if (!translated) {
          results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: false, error: "no translation returned" });
          continue;
        }
        const langLower = String(lang).toLowerCase();
        const newPath = file.path.replace(/(\.[^./]+)$/, `.${langLower}$1`) || `${file.path}.${langLower}`;
        const out: DevHubFile = {
          id: crypto.randomUUID(),
          projectId: project.id,
          path: newPath,
          content: translated,
          language: file.language,
          updatedAt: now(),
        };
        try { await dbUpsertFile(out); }
        catch {
          const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === newPath);
          if (existing) { existing.content = out.content; existing.updatedAt = out.updatedAt; }
          else memFiles.set(out.id, out);
        }
        results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: true, outputPath: newPath, bytes: translated.length });
      } catch (e: any) {
        results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: false, error: e?.message || "step failed" });
      }
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({
    ok: okCount === results.length,
    total: results.length,
    successCount: okCount,
    failureCount: results.length - okCount,
    results,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SDK generation (TypeScript client from project's Express routes)
// ═════════════════════════════════════════════════════════════════════════════

interface DetectedRoute { method: string; path: string; sourceFile: string }

function detectExpressRoutes(files: DevHubFile[]): DetectedRoute[] {
  const routes: DetectedRoute[] = [];
  const routeRe = /(?:app|router)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  for (const f of files) {
    if (!/\.(ts|js|tsx|jsx|mjs)$/i.test(f.path)) continue;
    let m: RegExpExecArray | null;
    while ((m = routeRe.exec(f.content)) !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2], sourceFile: f.path });
    }
  }
  return routes;
}

function generateSDK(projectName: string, baseUrl: string, routes: DetectedRoute[]): string {
  const lines: string[] = [];
  lines.push(`// Auto-generated SDK for ${projectName}`);
  lines.push(`// Detected ${routes.length} endpoint(s) via AEVION DevHub`);
  lines.push(`// DO NOT EDIT — re-generate via /api/devhub/projects/:id/sdk`);
  lines.push("");
  lines.push(`export interface SdkOptions {`);
  lines.push(`  baseUrl?: string;`);
  lines.push(`  token?: string;`);
  lines.push(`  fetch?: typeof globalThis.fetch;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export function createClient(opts: SdkOptions = {}) {`);
  lines.push(`  const baseUrl = (opts.baseUrl || ${JSON.stringify(baseUrl)}).replace(/\\/$/, "");`);
  lines.push(`  const f = opts.fetch || globalThis.fetch;`);
  lines.push(`  const headers: Record<string, string> = { "Content-Type": "application/json" };`);
  lines.push(`  if (opts.token) headers.Authorization = \`Bearer \${opts.token}\`;`);
  lines.push("");
  lines.push(`  async function call(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean>) {`);
  lines.push(`    let url = baseUrl + path;`);
  lines.push(`    if (query && Object.keys(query).length) {`);
  lines.push(`      const qs = new URLSearchParams();`);
  lines.push(`      for (const [k, v] of Object.entries(query)) qs.set(k, String(v));`);
  lines.push(`      url += "?" + qs.toString();`);
  lines.push(`    }`);
  lines.push(`    const r = await f(url, {`);
  lines.push(`      method,`);
  lines.push(`      headers,`);
  lines.push(`      body: body !== undefined && method !== "GET" ? JSON.stringify(body) : undefined,`);
  lines.push(`    });`);
  lines.push(`    if (!r.ok) {`);
  lines.push(`      const txt = await r.text();`);
  lines.push(`      throw new Error(\`\${method} \${path} → \${r.status}: \${txt.slice(0, 200)}\`);`);
  lines.push(`    }`);
  lines.push(`    const ct = r.headers.get("content-type") || "";`);
  lines.push(`    return ct.includes("application/json") ? r.json() : r.text();`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  return {`);
  // De-dupe routes by method+path
  const seen = new Set<string>();
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Make a JS-safe identifier from method + path
    const fnName = r.method.toLowerCase() +
      r.path.replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .replace(/^(\d)/, "_$1") || "root";
    const hasParams = r.path.includes(":");
    const params = hasParams ? r.path.match(/:(\w+)/g)?.map((s) => s.slice(1)) || [] : [];
    const paramArgs = params.map((p) => `${p}: string | number`).join(", ");
    const pathExpr = hasParams
      ? '`' + r.path.replace(/:(\w+)/g, "${$1}") + '`'
      : JSON.stringify(r.path);
    const bodyArg = ["POST", "PUT", "PATCH"].includes(r.method) ? `body?: unknown` : "";
    const queryArg = `query?: Record<string, string | number | boolean>`;
    const allArgs = [paramArgs, bodyArg, queryArg].filter(Boolean).join(", ");
    lines.push(`    /** ${r.method} ${r.path} — from ${r.sourceFile} */`);
    lines.push(`    ${fnName}(${allArgs}) {`);
    lines.push(`      return call(${JSON.stringify(r.method)}, ${pathExpr}, ${bodyArg ? "body" : "undefined"}, query);`);
    lines.push(`    },`);
  }
  lines.push(`  };`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export type Client = ReturnType<typeof createClient>;`);
  return lines.join("\n");
}

// GET /api/devhub/projects/:id/sdk — return TypeScript SDK
devhubRouter.get("/projects/:id/sdk", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const files = await dbListFiles(project.id);
  const routes = detectExpressRoutes(files);
  const baseUrl = project.deployUrl || `https://${slugify(project.name)}-${project.id.slice(0, 8)}.aevion.app`;
  const sdk = generateSDK(project.name, baseUrl, routes);

  if (req.query.download === "1") {
    res.setHeader("Content-Type", "text/typescript");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(project.name)}-sdk.ts"`);
    res.send(sdk);
  } else {
    res.json({
      ok: true,
      projectName: project.name,
      baseUrl,
      detectedRoutes: routes,
      sdkBytes: sdk.length,
      sdk,
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Project export as ZIP (minimal stored-mode ZIP, no external deps)
// ═════════════════════════════════════════════════════════════════════════════

const CRC32_TABLE: Uint32Array = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP general purpose bit 11 — "the file name is encoded in UTF-8". */
const UTF8_NAME_FLAG = 0x0800;

/** True when the bytes really are UTF-8 — a lossy decode would introduce
 * U+FFFD, so a round-trip that changes the bytes proves they were not. */
function isValidUtf8(buf: Buffer): boolean {
  return Buffer.compare(Buffer.from(buf.toString("utf8"), "utf8"), buf) === 0;
}

export function buildZipStored(entries: Array<{ path: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, "utf8");
    const dataBuf = entry.content;
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    // Local file header (30 bytes + name + data)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    // Bit 11 = UTF-8 name. Names are written as UTF-8 above, and without this
    // flag APPNOTE 4.4.4 says a reader must treat them as CP437 — which is why
    // "src/компоненты/Таймер.jsx" unzipped as "src/╨║╨╛╨╝╨┐╨╛╨╜╨╡╨╜╤é╤ï/…"
    // in every standard tool (confirmed against prod, 2026-07-26).
    local.writeUInt16LE(UTF8_NAME_FLAG, 6); // flags
    local.writeUInt16LE(0, 8); // method (0=stored)
    local.writeUInt16LE(0, 10); // mtime
    local.writeUInt16LE(0, 12); // mdate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // name length
    local.writeUInt16LE(0, 28); // extra length

    const localHeader = Buffer.concat([local, nameBuf, dataBuf]);
    localParts.push(localHeader);

    // Central directory entry (46 bytes + name)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(UTF8_NAME_FLAG, 8); // flags — must match the local header
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // mtime
    central.writeUInt16LE(0, 14); // mdate
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(Buffer.concat([central, nameBuf]));
    offset += localHeader.length;
  }

  const localBlock = Buffer.concat(localParts);
  const centralBlock = Buffer.concat(centralParts);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where CD starts
  eocd.writeUInt16LE(entries.length, 8); // num entries this disk
  eocd.writeUInt16LE(entries.length, 10); // total num entries
  eocd.writeUInt32LE(centralBlock.length, 12); // size of CD
  eocd.writeUInt32LE(localBlock.length, 16); // CD offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBlock, centralBlock, eocd]);
}

// GET /api/devhub/projects/:id/export — download project as ZIP
devhubRouter.get("/projects/:id/export", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  try {
    const files = await dbListFiles(project.id);
    if (files.length === 0) return res.status(400).json({ error: "project has no files to export" });

    const entries = files.map((f) => {
      // Decode .b64 files back to binary
      const isB64 = detectB64Mime(f.path);
      let content: Buffer;
      let outPath = f.path;
      if (isB64) {
        try { content = Buffer.from(f.content, "base64"); }
        catch { content = Buffer.from(f.content, "utf8"); }
        outPath = f.path.replace(/\.b64$/i, "");
      } else {
        content = Buffer.from(f.content, "utf8");
      }
      return { path: outPath, content };
    });

    // Include a metadata file
    const meta = {
      projectName: project.name,
      description: project.description,
      stack: project.stack,
      exportedAt: new Date().toISOString(),
      fileCount: files.length,
      generatedBy: "AEVION DevHub",
    };
    entries.push({ path: "aevion-export.json", content: Buffer.from(JSON.stringify(meta, null, 2), "utf8") });

    const zip = buildZipStored(entries);
    const filename = `${slugify(project.name)}-${project.id.slice(0, 8)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", zip.length);
    res.send(zip);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "export failed" });
  }
});

// POST /api/devhub/projects/:id/deploy/vercel — deploy to Vercel
devhubRouter.post("/projects/:id/deploy/vercel", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const project = await loadOwnedProjectOrReply(req.params.id, userId, res);
  if (!project) return;

  const vercelToken = process.env.VERCEL_API_TOKEN;
  if (!vercelToken) {
    return res.status(503).json({
      error: "Vercel not configured — set VERCEL_API_TOKEN",
      setupUrl: "https://vercel.com/account/tokens",
    });
  }

  const vercelDeployCredit = await checkCredit(userId, "deploy");
  if (!vercelDeployCredit.allowed) {
    return res.status(402).json({
      error: "Monthly deploy limit reached",
      tier: vercelDeployCredit.tier, used: vercelDeployCredit.used, limit: vercelDeployCredit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  const deploymentId = crypto.randomUUID();
  const deploySlug = slugify(project.name) + "-" + project.id.slice(0, 8);

  const deployment: DevHubDeployment = {
    id: deploymentId,
    projectId: project.id,
    userId,
    status: "pending",
    deployUrl: null,
    buildLog: null,
    triggeredAt: now(),
    completedAt: null,
  };
  try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }

  try {
    const files = await dbListFiles(project.id);
    // Vercel Deployments API v13 — inline file payload
    const vercelFiles = files.map((f) => ({
      file: f.path,
      data: Buffer.from(f.content).toString("base64"),
      encoding: "base64",
    }));

    const vResp = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: deploySlug,
        files: vercelFiles,
        target: "production",
        projectSettings: {
          framework: project.stack === "next" ? "nextjs"
                   : project.stack === "react" ? "vite"
                   : project.stack === "express" ? null
                   : null,
        },
      }),
    });

    if (!vResp.ok) {
      const errText = await vResp.text();
      deployment.status = "failed";
      deployment.buildLog = `Vercel error: ${errText.slice(0, 500)}`;
      deployment.completedAt = now();
      try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
      return res.status(vResp.status).json({ ok: false, error: `Vercel deploy error: ${errText.slice(0, 300)}` });
    }

    const vData = await vResp.json() as { id: string; url: string };
    const liveUrl = `https://${vData.url}`;

    deployment.status = "building";
    deployment.deployUrl = liveUrl;
    deployment.buildLog = `Vercel deployment ${vData.id} created`;
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }

    // Verify the page actually serves before calling it live — same honesty
    // rule as the CF Pages path (a deploy that never serves is a failure).
    deferred(async () => {
      const d = memDeployments.get(deployment.id) ?? deployment;
      const serves = await verifyDeploymentServes(liveUrl);
      if (serves) {
        d.status = "live";
      } else {
        d.status = "failed";
        d.buildLog = (d.buildLog || "") + " | verify: deployed page is not serving (non-2xx after retries)";
      }
      d.completedAt = now();
      try { await dbSaveDeployment(d); } catch { memDeployments.set(d.id, d); }
      if (project && serves) {
        project.status = "live";
        project.deployUrl = liveUrl;
        project.updatedAt = now();
        try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }
      }
    }, 5000);

    await debitCredit(userId, "deploy").catch(() => {});
    return res.json({
      ok: true,
      deploymentId,
      vercelDeploymentId: vData.id,
      deployUrl: liveUrl,
      provider: "vercel",
      message: "Vercel deployment started",
    });
  } catch (e: any) {
    deployment.status = "failed";
    deployment.buildLog = e?.message || "deploy failed";
    deployment.completedAt = now();
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
    return res.status(500).json({ ok: false, error: e?.message || "Vercel deploy failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Cloudflare Pages deploy — static sites / Next.js exported / React SPA
// POST /api/devhub/projects/:id/deploy/pages
//
// Flow:
//   1. Create CF Pages project (idempotent — ignores "already exists")
//   2. Upload all project files as multipart direct-upload deployment
//   3. Add <slug>.aevion.build custom domain to Pages project
//   4. Provision CNAME DNS record in aevion.build zone
//   5. Return live URL + domain
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/projects/:id/deploy/pages", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);

  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!accountId || !apiToken) {
    return res.status(503).json({
      error: "Cloudflare Pages not configured",
      needs: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
      setupUrl: "https://dash.cloudflare.com/profile/api-tokens",
    });
  }

  const pagesDeployCredit = await checkCredit(userId, "deploy");
  if (!pagesDeployCredit.allowed) {
    return res.status(402).json({
      error: "Monthly deploy limit reached",
      tier: pagesDeployCredit.tier, used: pagesDeployCredit.used, limit: pagesDeployCredit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  const cfBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const cfHeaders = { Authorization: `Bearer ${apiToken}` };

  // Record deployment
  const deploymentId = crypto.randomUUID();
  const deployment: DevHubDeployment = {
    id: deploymentId, projectId: project.id, userId,
    status: "pending", deployUrl: null, buildLog: null,
    triggeredAt: now(), completedAt: null,
  };
  try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }

  try {
    const files = await dbListFiles(project.id);
    if (!files.length) {
      deployment.status = "failed"; deployment.buildLog = "no files in project";
      deployment.completedAt = now();
      try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
      return res.status(400).json({ error: "project has no files to deploy — add at least index.html" });
    }

    // Stable CF Pages project name: aevion-<slug>-<id6>
    const pageName = `aevion-${slugify(project.name)}-${project.id.slice(0, 6)}`;

    // 1. Create Pages project (ignore 8000000 = already exists)
    const createResp = await fetch(`${cfBase}/pages/projects`, {
      method: "POST",
      headers: { ...cfHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name: pageName, production_branch: "main" }),
    });
    const createData = await createResp.json() as { success: boolean; errors?: Array<{ code: number; message: string }> };
    // CF has reported "already exists" under more than one error code over
    // time — match the message too, or every REdeploy 500s (hit live 2026-07-21).
    const alreadyExists = createData.errors?.some((e) => e.code === 8000000 || /already exists/i.test(e.message || ""));
    if (!createResp.ok && !alreadyExists) {
      const errMsg = createData.errors?.map((e) => e.message).join("; ") || "CF Pages project creation failed";
      return res.status(500).json({ error: errMsg });
    }

    // 2-3. Upload via wrangler — the only asset-upload path CF still honors.
    // The previous raw multipart flow stored the manifest but never the
    // assets: deploy reported success while every page served 500.
    const wranglerResult = await deployViaWrangler(
      files.map((f) => ({ path: f.path, content: f.content })),
      pageName,
      { accountId, apiToken }
    );
    if (!wranglerResult.ok) {
      deployment.status = "failed";
      deployment.buildLog = `wrangler: ${wranglerResult.error}`;
      deployment.completedAt = now();
      try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
      return res.status(502).json({ error: `CF Pages upload failed: ${wranglerResult.error}` });
    }
    const pagesUrl = wranglerResult.url;

    deployment.status = "building";
    deployment.deployUrl = pagesUrl;
    deployment.buildLog = `CF Pages deployment uploaded via wrangler`;
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
    await debitCredit(userId, "deploy").catch(() => {});

    // 4. Provision aevion.build domain (best-effort — don't fail deploy if zone not configured)
    let customDomain: string | null = null;
    let domainUrl: string | null = null;

    if (zoneId) {
      try {
        const domainSlug = `${slugify(project.name)}-${project.id.slice(0, 6)}`;
        const fullDomain = `${domainSlug}.aevion.build`;

        // 4a. Add custom domain to CF Pages project
        await fetch(`${cfBase}/pages/projects/${pageName}/domains`, {
          method: "POST",
          headers: { ...cfHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ name: fullDomain }),
        });

        // 4b. CNAME DNS record: fullDomain → pageName.pages.dev
        const dnsTarget = `${pageName}.pages.dev`;
        const zoneBase = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
        const listResp = await fetch(`${zoneBase}?type=CNAME&name=${fullDomain}`, { headers: cfHeaders });
        const listData = await listResp.json() as { result: Array<{ id: string }> };
        const existingId = listData.result?.[0]?.id;

        const dnsBody = JSON.stringify({ type: "CNAME", name: fullDomain, content: dnsTarget, ttl: 1, proxied: true });
        if (existingId) {
          await fetch(`${zoneBase}/${existingId}`, { method: "PUT", headers: { ...cfHeaders, "Content-Type": "application/json" }, body: dnsBody });
        } else {
          await fetch(zoneBase, { method: "POST", headers: { ...cfHeaders, "Content-Type": "application/json" }, body: dnsBody });
        }

        customDomain = fullDomain;
        domainUrl = `https://${fullDomain}`;
      } catch (domainErr: any) {
        deployment.buildLog += ` | domain: ${domainErr?.message || "error"}`;
      }
    }

    // 5. Verify the page actually SERVES before calling it live. CF's create
    // API reports deploy:success even when the uploaded assets never stored
    // (the raw multipart flow is deprecated in favor of wrangler) — the page
    // then 500s forever while our records said "live" (found live 2026-07-21:
    // every CF Pages deploy ever made had this). Degraded-convention: a
    // deploy that doesn't serve is FAILED, not live.
    deferred(async () => {
      const d = memDeployments.get(deployment.id) ?? deployment;
      const serves = await verifyDeploymentServes(pagesUrl);
      if (serves) {
        d.status = "live"; d.completedAt = now();
      } else {
        d.status = "failed";
        d.buildLog = (d.buildLog || "") +
          " | verify: deployed assets are not serving (upstream accepted the upload but the page returns non-2xx — CF direct-upload via raw REST is deprecated, wrangler-based upload needed)";
        d.completedAt = now();
      }
      try { await dbSaveDeployment(d); } catch { memDeployments.set(d.id, d); }
      if (project && serves) {
        project.status = "live";
        project.deployUrl = pagesUrl;
        if (customDomain) project.customDomain = customDomain;
        project.updatedAt = now();
        try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }
      }
    }, 4000);

    // The CNAME is created, but a record in a zone nobody delegated resolves
    // nowhere: aevion.build is still `pending` at Cloudflare, so every
    // *.aevion.build address handed out so far — including ones from July —
    // fails DNS. pagesUrl is the address that actually answers, so that is
    // what we call live; the custom domain is reported separately with its
    // real state instead of being presented as the primary URL.
    // Second arg is the delay between attempts — 1ms keeps this a fast probe
    // rather than the 25s wait the deploy path uses.
    const domainReady = domainUrl ? await verifyDeploymentServes(domainUrl, 1).catch(() => false) : false;
    return res.json({
      ok: true,
      provider: "cloudflare-pages",
      deploymentId,
      pagesUrl,
      domain: customDomain,
      domainUrl,
      domainReady,
      liveUrl: domainReady ? domainUrl : pagesUrl,
      message: customDomain
        ? domainReady
          ? `Deployed to ${domainUrl} (and ${pagesUrl})`
          : `Deployed to ${pagesUrl}. ${customDomain} is configured but does not resolve yet — the aevion.build zone is not delegated to Cloudflare (point the registrar's nameservers at it).`
        : `Deployed to ${pagesUrl} — verifying it serves before marking live (add CLOUDFLARE_ZONE_ID to enable aevion.build domain)`,
    });
  } catch (e: any) {
    deployment.status = "failed"; deployment.buildLog = e?.message || "deploy failed";
    deployment.completedAt = now();
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
    return res.status(500).json({ ok: false, error: e?.message || "Cloudflare Pages deploy failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Cloudflare R2 audio upload (S3-compatible, AWS SigV4)
// ═════════════════════════════════════════════════════════════════════════════

function r2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET
  );
}

function sha256Hex(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function hmacSha256(key: Buffer | string, msg: string): Buffer {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest();
}

function signR2PutHeaders(opts: {
  host: string; bucket: string; key: string; body: Buffer; contentType: string;
  accessKey: string; secretKey: string; region?: string; now?: Date;
}): Record<string, string> {
  const region = opts.region || "auto";
  const service = "s3";
  const now = opts.now || new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(opts.body);
  const uri = `/${opts.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalHeaders =
    `content-type:${opts.contentType}\n` +
    `host:${opts.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmacSha256("AWS4" + opts.secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    Authorization: auth,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "Content-Type": opts.contentType,
  };
}

async function r2PutObject(key: string, body: Buffer, contentType: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!accountId || !accessKey || !secretKey || !bucket) return { ok: false, error: "R2 not configured" };

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const headers = signR2PutHeaders({ host, bucket, key, body, contentType, accessKey, secretKey });
  const uri = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const r = await fetch(`https://${host}${uri}`, { method: "PUT", headers, body: body as unknown as BodyInit });
    if (!r.ok) {
      const errText = await r.text();
      return { ok: false, error: `R2 PUT ${r.status}: ${errText.slice(0, 200)}` };
    }
    const publicBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(/\/+$/, "");
    const url = publicBase
      ? `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`
      : `https://${host}${uri}`;
    return { ok: true, url };
  } catch (e: any) {
    return { ok: false, error: e?.message || "R2 PUT failed" };
  }
}

async function tryAutoUploadAudioToR2(buf: Buffer, contentType: string, key: string): Promise<string | null> {
  if (!r2Configured()) return null;
  const r = await r2PutObject(key, buf, contentType);
  return r.ok ? r.url : null;
}

// POST /api/devhub/media/upload-audio — upload audio to Cloudflare R2 (permanent CDN URL)
// Body: { sourceUrl?: string } OR { base64: string, mimeType?: string, key?: string }
devhubRouter.post("/media/upload-audio", async (req, res) => {
  const { sourceUrl, base64, mimeType = "audio/mpeg", key } = req.body || {};
  if (!sourceUrl && !base64) return res.status(400).json({ error: "sourceUrl or base64 required" });
  if (!r2Configured()) {
    return res.status(503).json({
      error: "Cloudflare R2 not configured — set CLOUDFLARE_R2_ACCOUNT_ID + CLOUDFLARE_R2_ACCESS_KEY_ID + CLOUDFLARE_R2_SECRET_KEY + CLOUDFLARE_R2_BUCKET",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
    });
  }

  try {
    let buf: Buffer;
    if (sourceUrl) {
      // Без этой проверки посторонний заставлял НАШ сервер сходить по любому
      // адресу, включая внутренние (метаданные облака, соседние службы,
      // админки), и получал результат кодом статуса. Ручка была закрыта
      // только тем, что не настроено хранилище, — то есть случайно.
      const verdict = await checkPublicUrl(sourceUrl);
      if (!verdict.ok) return res.status(400).json({ error: verdict.reason });
      const sr = await fetch(verdict.url.toString());
      if (!sr.ok) return res.status(sr.status).json({ error: `source fetch failed: ${sr.status}` });
      buf = Buffer.from(await sr.arrayBuffer());
    } else {
      buf = Buffer.from(String(base64), "base64");
    }
    if (buf.length === 0) return res.status(400).json({ error: "audio body empty" });
    if (buf.length > 25 * 1024 * 1024) return res.status(400).json({ error: "audio too large (max 25 MB)" });

    const ct = String(mimeType);
    const ext = ct.includes("wav") ? "wav" : ct.includes("ogg") ? "ogg" : "mp3";
    const finalKey = String(key || `audio/${crypto.randomUUID()}.${ext}`).replace(/^\/+/, "").slice(0, 256);

    const result = await r2PutObject(finalKey, buf, ct);
    if (!result.ok) return res.status(502).json({ error: result.error });
    res.json({ ok: true, key: finalKey, url: result.url, bytes: buf.length, mimeType: ct });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Audio upload failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Brevo: create SMTP email template
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/media/email-template-create", async (req, res) => {
  const { name, subject, htmlContent, senderEmail, senderName, replyTo, tag, isActive } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
  if (!subject || typeof subject !== "string") return res.status(400).json({ error: "subject required" });
  if (!htmlContent || typeof htmlContent !== "string") return res.status(400).json({ error: "htmlContent required" });
  if (htmlContent.length > 2_000_000) return res.status(400).json({ error: "htmlContent too large (max 2 MB)" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });

  const sEmail = String(senderEmail || process.env.BREVO_SENDER_EMAIL || "").trim();
  const sName = String(senderName || process.env.BREVO_SENDER_NAME || "AEVION").trim();
  if (!sEmail) return res.status(400).json({ error: "senderEmail required (or set BREVO_SENDER_EMAIL)" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEmail)) return res.status(400).json({ error: "invalid senderEmail" });
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(replyTo))) return res.status(400).json({ error: "invalid replyTo" });

  try {
    const payload: Record<string, unknown> = {
      templateName: name.trim().slice(0, 100),
      subject: subject.trim().slice(0, 300),
      htmlContent,
      sender: { email: sEmail, name: sName },
      isActive: isActive === false ? false : true,
    };
    if (replyTo) payload.replyTo = String(replyTo).trim();
    if (tag) payload.tag = String(tag).slice(0, 50);

    const r = await fetch("https://api.brevo.com/v3/smtp/templates", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({})) as { id?: number };
    if (!data.id) return res.status(500).json({ error: "Brevo did not return template id" });
    res.json({ ok: true, id: data.id, name: payload.templateName, subject: payload.subject });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Template create failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ZIP import (symmetric to GET /projects/:id/export — method=0 stored only)
// ═════════════════════════════════════════════════════════════════════════════

function parseZipStored(buf: Buffer): Array<{ path: string; content: Buffer }> | { error: string } {
  // Find EOCD signature 0x06054b50 — search backwards (max comment 65535)
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  const maxSearch = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - maxSearch && i >= 0; i--) {
    if (buf.readUInt32LE(i) === eocdSig) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return { error: "EOCD not found — not a valid ZIP" };
  const numEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset < 0 || cdOffset >= buf.length) return { error: "invalid central directory offset" };

  const entries: Array<{ path: string; content: Buffer }> = [];
  let p = cdOffset;
  for (let n = 0; n < numEntries; n++) {
    if (p + 46 > buf.length) return { error: "central directory truncated" };
    if (buf.readUInt32LE(p) !== 0x02014b50) return { error: "bad CD entry signature" };
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    if (method !== 0) return { error: `unsupported compression method ${method} (only stored=0)` };
    if (compSize !== uncompSize) return { error: "stored entry size mismatch" };
    const flags = buf.readUInt16LE(p + 8);
    const nameBytes = buf.slice(p + 46, p + 46 + nameLen);
    // Mirror of the export bug (#923), read side: without bit 11 the name is
    // NOT UTF-8 by spec. Decoding it as UTF-8 anyway yields U+FFFD in paths —
    // files land under names that no import in the code will ever resolve.
    // We do not guess the real code page (the spec says CP437, Russian
    // Windows tools actually write CP866, and picking wrong is silently
    // wrong): non-ASCII bytes with no UTF-8 flag are refused with a fix.
    if (!(flags & UTF8_NAME_FLAG) && !isValidUtf8(nameBytes) ) {
      return {
        error:
          "ZIP file names are not UTF-8 and the archive does not say which encoding they use " +
          "(general purpose bit 11 unset). Re-create the archive with UTF-8 names — " +
          "otherwise the imported paths would not match the imports inside the code.",
      };
    }
    const name = nameBytes.toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    // Local header at localOffset
    if (localOffset + 30 > buf.length) return { error: "local header truncated" };
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) return { error: "bad local header signature" };
    const lhNameLen = buf.readUInt16LE(localOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    if (dataStart + uncompSize > buf.length) return { error: "data exceeds buffer" };
    const content = buf.slice(dataStart, dataStart + uncompSize);
    entries.push({ path: name, content });
  }
  return entries;
}

/**
 * ElevenLabs TTS model.
 *
 * eleven_monolingual_v1 was hard-coded in three places and ElevenLabs has
 * since REMOVED it — every voice call on prod returned
 * "unsupported_model ... have been deprecated" (confirmed live 2026-07-26),
 * so voice was silently dead while /studio still reported it live. It was
 * also English-only, which was wrong for this product: our prompts are
 * Russian. multilingual_v2 is the quality default; turbo/flash are the
 * cheaper fallbacks, all three verified against our key.
 */
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const TTS_MODEL_FALLBACKS = ["eleven_turbo_v2_5", "eleven_flash_v2_5"];

const BINARY_EXTENSIONS = /\.(mp3|wav|ogg|png|jpg|jpeg|webp|gif|pdf|zip|woff2?|ttf|otf)$/i;

devhubRouter.post("/projects/:id/import-zip", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { base64Zip, overwrite } = req.body || {};
  if (!base64Zip || typeof base64Zip !== "string") return res.status(400).json({ error: "base64Zip required" });

  let zipBuf: Buffer;
  try { zipBuf = Buffer.from(base64Zip, "base64"); }
  catch { return res.status(400).json({ error: "invalid base64" }); }
  if (zipBuf.length === 0) return res.status(400).json({ error: "empty ZIP" });
  if (zipBuf.length > 50 * 1024 * 1024) return res.status(400).json({ error: "ZIP too large (max 50 MB)" });

  const parsed = parseZipStored(zipBuf);
  if (!Array.isArray(parsed)) return res.status(400).json({ error: parsed.error });
  if (parsed.length === 0) return res.status(400).json({ error: "ZIP contains no entries" });
  if (parsed.length > 500) return res.status(400).json({ error: "max 500 files per import" });

  const imported: Array<{ path: string; bytes: number; binary: boolean }> = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  const toWrite: Array<{ file: DevHubFile; bytes: number; binary: boolean }> = [];

  for (const entry of parsed) {
    // Skip metadata + directory entries
    if (entry.path === "aevion-export.json") { skipped.push({ path: entry.path, reason: "metadata" }); continue; }
    if (entry.path.endsWith("/")) { skipped.push({ path: entry.path, reason: "directory" }); continue; }
    if (entry.path.includes("..")) { skipped.push({ path: entry.path, reason: "path traversal" }); continue; }
    if (entry.path.length > 240) { skipped.push({ path: entry.path, reason: "path too long" }); continue; }

    const isBinary = BINARY_EXTENSIONS.test(entry.path);
    const finalPath = isBinary && !entry.path.endsWith(".b64") ? entry.path + ".b64" : entry.path;
    const content = isBinary ? entry.content.toString("base64") : entry.content.toString("utf8");

    // overwrite=false ⇒ skip if exists
    if (overwrite === false) {
      let existing: DevHubFile | null;
      try { existing = await dbGetFile(project.id, finalPath); }
      catch { existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === finalPath) ?? null; }
      if (existing) { skipped.push({ path: finalPath, reason: "already exists" }); continue; }
    }

    toWrite.push({
      file: {
        id: crypto.randomUUID(), projectId: project.id, path: finalPath,
        content, language: detectLanguage(finalPath), updatedAt: now(),
      },
      bytes: entry.content.length,
      binary: isBinary,
    });
  }

  // Checkpoint BEFORE writing, exactly as /github/sync does — a ZIP imported
  // with overwrite=true replaces whole files, and without this the IDE's undo
  // and history (which it offers as the safety net for AI writes) simply did
  // not cover the one bulk write that can wipe a project in one click.
  let checkpointId: string | null = null;
  if (toWrite.length > 0) {
    let existingFiles: Array<{ path: string; content: string }> = [];
    try { existingFiles = await dbListFiles(project.id); }
    catch {
      existingFiles = [...memFiles.values()].filter((f) => f.projectId === project!.id);
    }
    checkpointId = await createCheckpoint(
      project.id,
      userId,
      `ZIP import (${toWrite.length} file${toWrite.length === 1 ? "" : "s"})`,
      toWrite.map((w) => w.file.path),
      existingFiles,
    );
  }

  for (const { file: f, bytes, binary } of toWrite) {
    try { await dbUpsertFile(f); }
    catch {
      const ex = [...memFiles.values()].find((x) => x.projectId === project!.id && x.path === f.path);
      if (ex) { ex.content = f.content; ex.language = f.language; ex.updatedAt = f.updatedAt; }
      else memFiles.set(f.id, f);
    }
    imported.push({ path: f.path, bytes, binary });
  }

  res.json({
    ok: imported.length > 0,
    importedCount: imported.length,
    skippedCount: skipped.length,
    imported,
    skipped,
    checkpointId,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Video generation via Replicate API
// POST /api/devhub/media/video  { prompt, model?, width?, height?, duration? }
// GET  /api/devhub/media/video/status/:predictionId
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/media/video", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const { prompt, model, duration, imageUrl, aspectRatio, resolution, negativePrompt, realism } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const credit = await checkCredit(userId, "video");
  if (!credit.allowed) {
    return res.status(402).json({
      error: "Monthly video limit reached",
      tier: credit.tier, used: credit.used, limit: credit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return res.status(503).json({
      error: "Video generation not configured — set REPLICATE_API_TOKEN in Railway",
      setupUrl: "https://replicate.com/account/api-tokens",
    });
  }

  const { findVideoModel, videoModelCatalogue } = await import("../lib/devhubVideoModels");
  const chosen = findVideoModel(model);
  if (!chosen) {
    // An unknown id used to be forwarded to Replicate as-is, which failed with
    // a provider error the user could not act on.
    return res.status(400).json({
      error: `unknown video model "${model}"`,
      models: videoModelCatalogue().map((m) => m.id),
    });
  }
  const resolvedModel = chosen.id;

  // The realism pass QReal built (services/qreal/directives.ts) is the whole
  // difference between "looks generated" and "looks filmed": camera body and
  // shutter, skin subsurface scattering, irregular blinks, handheld
  // micro-jitter, real room acoustics. Imported, never copied — a second copy
  // would drift and QReal's benchmark would stop measuring what production
  // actually sends. Opt out with realism:false for stylised or animated shots,
  // where describing a physical camera fights the prompt.
  const { REALISM_DIRECTIVES } = await import("../services/qreal/directives");
  const wantsRealism = realism !== false;
  const finalPrompt = wantsRealism ? `${prompt.trim()} ${REALISM_DIRECTIVES}` : prompt.trim();

  try {
    // Each model has its own input schema — the previous code sent num_frames
    // and width/height to models that accept neither, so they were dropped.
    const input: Record<string, any> = chosen.toInput({
      prompt: finalPrompt,
      imageUrl,
      duration,
      aspectRatio,
      resolution,
      negativePrompt,
    });

    const resp = await fetch(`https://api.replicate.com/v1/models/${resolvedModel}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Prefer: "respond-async",
      },
      body: JSON.stringify({ input }),
    }).catch(() => fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Prefer: "respond-async",
      },
      body: JSON.stringify({ version: resolvedModel, input }),
    }));

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 402) {
        noteProviderFailure("video", "Replicate: insufficient credit");
        // Having the token is not having the money — /studio reported video
        // "live" while every generation failed on an empty balance.
        return res.status(402).json({
          error: "Video provider has no credit — top up the Replicate account to generate",
          provider: "replicate",
          topUpUrl: "https://replicate.com/account/billing#billing",
        });
      }
      noteProviderFailure("video", `Replicate ${resp.status}`);
      return res.status(resp.status).json({ error: `Replicate error: ${errText.slice(0, 300)}` });
    }

    const prediction = await resp.json() as { id: string; status: string; urls?: { get?: string } };
    await debitCredit(userId, "video").catch(() => {});
    return res.json({
      ok: true,
      predictionId: prediction.id,
      status: prediction.status,
      model: chosen.id,
      modelLabel: chosen.label,
      audio: chosen.audio,
      realism: wantsRealism,
      creditsUsed: 1,
      creditsRemaining: credit.limit === -1 ? -1 : credit.limit - credit.used - 1,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Video generation failed" });
  }
});

// POST /api/devhub/media/3d — image → textured GLB mesh. A media type the
// platform did not have: it could make pictures, speech, music and video, but
// nothing a game engine or a three.js scene could load.
devhubRouter.post("/media/3d", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  const { imageUrl, model, textureSize, removeBackground } = req.body || {};
  if (!imageUrl || typeof imageUrl !== "string" || !/^https?:/.test(imageUrl)) {
    return res.status(400).json({ error: "imageUrl (http/https) is required - generate or upload an image first" });
  }

  const credit = await checkCredit(userId, "video");
  if (!credit.allowed) {
    return res.status(402).json({
      error: "Monthly generation limit reached",
      tier: credit.tier, used: credit.used, limit: credit.limit,
      upgrade: "/studio#upgrade",
    });
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return res.status(503).json({ error: "3D generation not configured - set REPLICATE_API_TOKEN", envVar: "REPLICATE_API_TOKEN" });
  }

  const { find3dModel, threeDModelCatalogue } = await import("../lib/devhub3dModels");
  const chosen = find3dModel(model);
  if (!chosen) {
    return res.status(400).json({ error: `unknown 3D model "${model}"`, models: threeDModelCatalogue().map((m) => m.id) });
  }

  try {
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Prefer: "respond-async" },
      body: JSON.stringify({ version: chosen.version, input: chosen.toInput({ imageUrl, textureSize, removeBackground }) }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Replicate error: ${t.slice(0, 300)}` });
    }
    const prediction = await r.json() as { id: string; status: string };
    await debitCredit(userId, "video").catch(() => {});
    res.json({ ok: true, predictionId: prediction.id, status: prediction.status, model: chosen.id, modelLabel: chosen.label, format: "glb" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "3D generation failed" });
  }
});

// GET /api/devhub/media/3d/models - catalogue, same contract as video.
devhubRouter.get("/media/3d/models", async (_req, res) => {
  const { threeDModelCatalogue } = await import("../lib/devhub3dModels");
  res.json({ models: threeDModelCatalogue(), configured: !!process.env.REPLICATE_API_TOKEN });
});

// GET /api/devhub/media/video/models — what the video button can actually run.
// Exposed so the IDE and the agent pick from real ids instead of guessing.
devhubRouter.get("/media/video/models", async (_req, res) => {
  const { videoModelCatalogue } = await import("../lib/devhubVideoModels");
  res.json({ models: videoModelCatalogue(), configured: !!process.env.REPLICATE_API_TOKEN });
});

devhubRouter.get("/media/video/status/:predictionId", async (req, res) => {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) return res.status(503).json({ error: "REPLICATE_API_TOKEN not set" });

  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${req.params.predictionId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!r.ok) return res.status(r.status).json({ error: "Replicate fetch failed" });
    const pred = await r.json() as {
      id: string; status: string;
      output?: string | string[];
      error?: string;
      metrics?: { predict_time?: number };
    };
    const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    return res.json({
      status: pred.status,
      videoUrl: outputUrl ?? null,
      error: pred.error ?? null,
      predictionId: pred.id,
      seconds: pred.metrics?.predict_time ?? null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Status check failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Domain provision: <slug>.aevion.build via Cloudflare DNS
// POST /api/devhub/projects/:id/domain/setup  { subdomain? }
// GET  /api/devhub/projects/:id/domain/status
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/projects/:id/domain/setup", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);

  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!cfToken || !cfZoneId) {
    return res.status(503).json({
      error: "Domain provision not configured — set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in Railway",
      setupUrl: "https://dash.cloudflare.com/profile/api-tokens",
    });
  }

  const deployTarget = project.deployUrl?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!deployTarget) {
    return res.status(400).json({ error: "Project must be deployed first before adding a domain" });
  }

  const requestedSub = (req.body?.subdomain as string | undefined) || slugify(project.name);
  const subdomain = (requestedSub + "-" + project.id.slice(0, 6)).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const fullDomain = `${subdomain}.aevion.build`;

  try {
    // Create or update CNAME record
    const listResp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records?type=CNAME&name=${fullDomain}`,
      { headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" } }
    );
    const existing = await listResp.json() as { result: Array<{ id: string }> };
    const existingId = existing.result?.[0]?.id;

    const payload = { type: "CNAME", name: fullDomain, content: deployTarget, proxied: true, ttl: 1 };

    let cfResp: Response;
    if (existingId) {
      cfResp = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records/${existingId}`,
        { method: "PUT", headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
    } else {
      cfResp = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`,
        { method: "POST", headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
    }

    const cfData = await cfResp.json() as { success: boolean; errors?: Array<{ message: string }> };
    if (!cfData.success) {
      const msg = cfData.errors?.[0]?.message ?? "Cloudflare DNS error";
      return res.json({ ok: false, error: msg });
    }

    // Save custom domain to project
    project.customDomain = fullDomain;
    project.updatedAt = now();
    try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }

    return res.json({ ok: true, domain: fullDomain, url: `https://${fullDomain}`, cname: deployTarget });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Domain provision failed" });
  }
});

devhubRouter.get("/projects/:id/domain/status", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);

  const read = await readProject(req.params.id);
  if (!read.project && read.failed) return replyStorageUnavailable(res);
  const project = read.project;
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }

  return res.json({
    customDomain: project.customDomain ?? null,
    deployUrl: project.deployUrl ?? null,
    url: project.customDomain ? `https://${project.customDomain}` : project.deployUrl,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Studio overview: aggregates platform capabilities status
// GET /api/devhub/studio/capabilities
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/providers/health — are the KEYS still valid?
//
// Distinct from /studio/capabilities (is a key present?) and from an actual
// generation (is there money?). The middle question turned out to matter: a
// Brevo key that answers fine from production is rejected from a laptop by
// its IP allowlist, and ElevenLabs kept accepting our key while refusing the
// model we sent. Only free, side-effect-free endpoints are used — nothing
// here sends a message, spends credit, or creates anything.
devhubRouter.get("/providers/health", async (_req, res) => {
  const probe = async (name: string, run: () => Promise<{ ok: boolean; detail: string }>) => {
    try {
      const r = await run();
      return { name, ...r };
    } catch (e: any) {
      return { name, ok: false, detail: (e?.message || "request failed").slice(0, 120) };
    }
  };

  const checks = await Promise.all([
    probe("brevo", async () => {
      if (!process.env.BREVO_API_KEY) return { ok: false, detail: "BREVO_API_KEY not set" };
      const r = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
      });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    }),
    probe("replicate", async () => {
      if (!process.env.REPLICATE_API_TOKEN) return { ok: false, detail: "REPLICATE_API_TOKEN not set" };
      const r = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });
      // Valid key only. Credit is invisible here — an empty balance still
      // answers 200, which is exactly how "video: live" stayed wrong.
      return { ok: r.ok, detail: r.ok ? "key valid (balance not visible here)" : `HTTP ${r.status}` };
    }),
    probe("cloudflare", async () => {
      if (!process.env.CLOUDFLARE_API_TOKEN) return { ok: false, detail: "CLOUDFLARE_API_TOKEN not set" };
      const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    }),
    probe("cloudflare_zone", async () => {
      if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
        return { ok: false, detail: "CLOUDFLARE_ZONE_ID not set" };
      }
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}`, {
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      });
      const b = await r.json().catch(() => ({} as any));
      const status = b?.result?.status;
      // "pending" means the registrar never pointed at Cloudflare, so every
      // *.aevion.build address we hand out fails DNS.
      return { ok: status === "active", detail: `zone status: ${status ?? "unknown"}` };
    }),
    // 29.08.2026: панель объявляла 14 возможностей рабочими, а проб было пять.
    // Основанием для «работает» служило наличие переменной — тот же класс, что
    // проявился у домена: ключи заданы, зона не делегирована, каждый выданный
    // адрес не разрешается. Ниже закрыты пять из шести обещаний без основания.
    //
    // GitHub намеренно НЕ пробуем: обращения к нему считает общий на все вкладки
    // ограничитель темпа (нас отключали 27.07 за сумму), а эта ручка вызывается
    // и панелью, и ежедневным смоуком. Цена проверки выше её пользы.
    probe("deepl", async () => {
      if (!process.env.DEEPL_API_KEY) return { ok: false, detail: "DEEPL_API_KEY not set" };
      const r = await fetch("https://api-free.deepl.com/v2/usage", {
        headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}` },
      });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    }),
    probe("vercel", async () => {
      if (!process.env.VERCEL_API_TOKEN) return { ok: false, detail: "VERCEL_API_TOKEN not set" };
      const r = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
      });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    }),
    probe("elevenlabs", async () => {
      if (!process.env.ELEVENLABS_API_KEY) return { ok: false, detail: "ELEVENLABS_API_KEY not set" };
      const r = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    }),
    probe("devhub_db", async () => {
      if (!process.env.DEVHUB_DB_ADMIN_URL) return { ok: false, detail: "DEVHUB_DB_ADMIN_URL not set" };
      const r = await getPool().query("select 1 as ok");
      return { ok: r.rows?.[0]?.ok === 1, detail: "select 1" };
    }),
    probe("openai", async () => {
      if (!process.env.OPENAI_API_KEY) return { ok: false, detail: "OPENAI_API_KEY not set" };
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      return { ok: r.ok, detail: r.ok ? "key valid (billing not visible here)" : `HTTP ${r.status}` };
    }),
  ]);

  const failing = checks.filter((c) => !c.ok);
  res.json({ checks, healthy: failing.length === 0, failing: failing.map((c) => c.name) });
});

// Зона aevion.build: делегирована ли она на самом деле.
//
// 29.08.2026: список возможностей объявлял домен "live" по ОДНОМУ признаку —
// заданы ли ключи Cloudflare. А наша же проба cloudflare_health (тридцатью
// строками выше) знала правду и прямо писала: пока регистратор не указал на
// Cloudflare, каждый выданный адрес *.aevion.build не разрешается. Два наших
// ответа об одном и том же спорили в одном файле, и ежедневный смоук это ловил.
//
// Ответ кэшируем: список возможностей открывают часто, а зона меняется раз в
// жизнь. Отказ пробы НЕ считаем отрицанием — возвращаем null («не знаю»), иначе
// сетевая икота выключала бы работающую возможность.
let zoneCache: { at: number; active: boolean | null } = { at: 0, active: null };
const ZONE_TTL_MS = 5 * 60_000;

/** Сброс кэша зоны — для тестов: иначе первый случай отравляет второй. */
export function __resetAevionBuildZoneCache(): void {
  zoneCache = { at: 0, active: null };
}

async function aevionBuildZoneActive(): Promise<boolean | null> {
  if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) return null;
  const now = Date.now();
  if (now - zoneCache.at < ZONE_TTL_MS) return zoneCache.active;
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}`,
      { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } },
    );
    const b: any = await r.json().catch(() => ({}));
    const active = b?.result?.status === "active";
    zoneCache = { at: now, active };
    return active;
  } catch {
    zoneCache = { at: now, active: null };
    return null;
  }
}

devhubRouter.get("/studio/capabilities", async (_req, res) => {
  const zoneActive = await aevionBuildZoneActive();
  const caps = [
    { id: "code", name: "Code Editor", description: "Monaco IDE in browser (VS Code engine)", status: "live" },
    { id: "translate", name: "Translation", description: "DeepL translation for generated copy", status: process.env.DEEPL_API_KEY ? "live" : "needs_token", token: "DEEPL_API_KEY" },
    { id: "database", name: "Database", description: "Real Postgres per project — schema + login role, DATABASE_URL wired in", status: process.env.DEVHUB_DB_ADMIN_URL ? "live" : "needs_token", token: "DEVHUB_DB_ADMIN_URL" },
    { id: "github", name: "GitHub", description: "Auto-push to GitHub repo", status: process.env.GITHUB_TOKEN ? "live" : "needs_token", token: "GITHUB_TOKEN" },
    { id: "railway", name: "Railway Deploy", description: "Deploy backends to Railway — not available yet (per-project services not implemented)", status: process.env.DEVHUB_RAILWAY_PER_PROJECT ? "live" : "not_available", token: "RAILWAY_API_TOKEN" },
    { id: "vercel", name: "Vercel Deploy", description: "Deploy frontends to Vercel", status: process.env.VERCEL_API_TOKEN ? "live" : "needs_token", token: "VERCEL_API_TOKEN" },
    { id: "pages", name: "Cloudflare Pages Deploy", description: "Deploy static sites + get *.pages.dev URL", status: (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) ? "live" : "needs_token", tokens: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
    { id: "domain", name: "Domain (aevion.build)", description: "Auto-provision <slug>.aevion.build with Pages deploy", 
      // «live» тут раньше означало «ключи заданы», а не «домен работает».
      // Пока зона не делегирована, каждый выданный адрес не разрешается —
      // объявлять такое рабочим значит обещать сильнее продукта.
      // Причину кладём в lastError: интерфейс показывает её человеку подсказкой.
      status: (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_ACCOUNT_ID && zoneActive === true) ? "live" : "needs_token",
      lastError: (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID && zoneActive === false)
        ? "ключи заданы, но зона aevion.build не делегирована — выданные адреса не разрешаются"
        : undefined,
      tokens: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"] },
    { id: "video", name: "Video Generation", description: "AI video via Replicate", status: process.env.REPLICATE_API_TOKEN ? "live" : "needs_token", token: "REPLICATE_API_TOKEN" },
    { id: "image", name: "Image Generation", description: "AI images — OpenAI → Workers AI (flux) → Together fallback chain", status: (process.env.OPENAI_API_KEY || (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) || process.env.TOGETHER_API_KEY) ? "live" : "needs_token", tokens: ["OPENAI_API_KEY", "CLOUDFLARE_API_TOKEN", "TOGETHER_API_KEY"] },
    { id: "screenshot_code", name: "Screenshot → Code", description: "Attach a design screenshot in the AI chat — a vision model recreates it as code", status: (process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) ? "live" : "needs_token", tokens: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] },
    { id: "audio_tts", name: "Voice (TTS)", description: "ElevenLabs text-to-speech", status: process.env.ELEVENLABS_API_KEY ? "live" : "needs_token", token: "ELEVENLABS_API_KEY" },
    { id: "audio_music", name: "Music & SFX", description: "AI music and sound effects", status: process.env.ELEVENLABS_API_KEY ? "live" : "needs_token", token: "ELEVENLABS_API_KEY" },
    { id: "email", name: "Email", description: "Brevo transactional email", status: process.env.BREVO_API_KEY ? "live" : "needs_token", token: "BREVO_API_KEY" },
    { id: "sms", name: "SMS", description: "Brevo SMS", status: process.env.BREVO_API_KEY ? "live" : "needs_token", token: "BREVO_API_KEY" },
    { id: "whatsapp", name: "WhatsApp", description: "WhatsApp Business API", status: process.env.BREVO_API_KEY ? "live" : "needs_token", token: "BREVO_API_KEY" },
  ];

  // A configured key is not a working capability — fold in what the last real
  // call to each provider actually did (lib/providerHealth).
  const withHealth = caps.map(applyHealth);
  const live = withHealth.filter((c) => c.status === "live").length;
  const degraded = withHealth.filter((c) => c.status === "degraded").length;
  return res.json({
    capabilities: withHealth,
    summary: { total: withHealth.length, live, degraded, needsToken: withHealth.length - live - degraded },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Studio Credits — usage metering per user per month
// GET  /api/devhub/studio/credits
// POST /api/devhub/studio/tier  { tier: "pro" | "free" | "enterprise" }  (admin)
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.get("/studio/credits", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = requesterId(req, auth?.sub);
  try {
    const result = await getAllMonthUsage(userId);
    return res.json({
      ...result,
      tierInfo: {
        free:       { video: 3,   image: 10,  tts: 100000, music: 5,   deploy: 10 },
        pro:        { video: 50,  image: 200, tts: 30000,  music: 100, deploy: -1 },
        enterprise: { video: -1,  image: -1,  tts: -1,     music: -1,  deploy: -1 },
      },
      upgradeUrl: "https://aevion.app/studio#upgrade",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Credits fetch failed" });
  }
});

devhubRouter.post("/studio/tier", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "authentication required" });
  const role = (auth.role || "").toLowerCase();
  if (role !== "admin") return res.status(403).json({ error: "admin_only" });
  const userId = auth.sub;
  const { tier, targetUserId } = req.body || {};
  const validTiers: StudioTier[] = ["free", "pro", "enterprise"];
  if (!tier || !validTiers.includes(tier)) {
    return res.status(400).json({ error: `tier must be one of: ${validTiers.join(", ")}` });
  }
  const target = targetUserId ?? userId;
  try {
    await setUserTier(target, tier as StudioTier);
    return res.json({ ok: true, userId: target, tier });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Tier update failed" });
  }
});
