/**
 * Constitution funnel — lightweight event tracking.
 *
 *   POST /api/constitution/funnel/track  { event, props? }
 *   GET  /api/admin/constitution/funnel  (admin only)
 *
 * Events live in `constitution_events` (Postgres, with in-memory ring
 * fallback). Session correlation is fingerprint(IP+UA) — good enough
 * for funnel analysis without cookies/identity friction.
 *
 * Aggregation is computed on-the-fly per GET: count per event +
 * pairwise conversion rate within same session (A → B if same fp_hash
 * sees A then B within 30 minutes).
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID, createHash } from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { makeServiceCapture } from "../lib/sentry/platform";

const capture = makeServiceCapture("constitutionFunnel");

const TRACKED_EVENTS = new Set([
  "page_view",
  "slider_change",
  "save_clicked",
  "save_success",
  "qsign_clicked",
  "planet_publish",
  "pdf_download",
  "ai_suggest",
  "upgrade_click",
  "upgrade_complete",
  "tour_started",
  "tour_completed",
  "academy_lesson_done",
  "academy_cert",
  "blog_view",
  "embed_view",
  "comment_posted",
  "vote_cast",
]);

const ANON_SALT = process.env.CONSTITUTION_ANON_SALT || "aevion-constitution-v1";

function fingerprint(req: Request): string {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const ua = String(req.headers["user-agent"] || "unknown").slice(0, 200);
  return createHash("sha256").update(`${ip}|${ua}|${ANON_SALT}`).digest("hex").slice(0, 16);
}

function clientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

const ADMIN_ALLOWLIST = (process.env.CONSTITUTION_ADMIN_ALLOWLIST || "yahiin1978@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(req: Request): boolean {
  const payload = verifyBearerOptional(req);
  if (!payload) return false;
  const p = payload as Record<string, unknown>;
  if (p.role === "admin") return true;
  if (typeof p.email === "string" && ADMIN_ALLOWLIST.includes(p.email.toLowerCase())) {
    return true;
  }
  return false;
}

type EventRow = {
  id: string;
  event: string;
  fpHash: string;
  userId: string | null;
  props: Record<string, unknown>;
  createdAt: string;
};

const MEM_MAX = 5000;
const memRing: EventRow[] = [];
let tableReady = false;
let dbAvailable = false;

async function ensureEventsTable(): Promise<void> {
  if (tableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS constitution_events (
        "id"        UUID PRIMARY KEY,
        "event"     TEXT NOT NULL,
        "fpHash"    TEXT NOT NULL,
        "userId"    TEXT,
        "props"     JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_events_event
        ON constitution_events ("event", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_constitution_events_fp
        ON constitution_events ("fpHash", "createdAt" DESC);
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tableReady = true;
}

function pushMem(row: EventRow): void {
  memRing.unshift(row);
  if (memRing.length > MEM_MAX) memRing.length = MEM_MAX;
}

export const constitutionFunnelTrackRouter = Router();
export const constitutionFunnelAdminRouter = Router();

const writeLimit = rateLimit({ windowMs: 60_000, max: 300, keyPrefix: "constitution-funnel-track" });
const readLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "constitution-funnel-read" });

constitutionFunnelTrackRouter.post(
  "/track",
  writeLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const event = typeof body.event === "string" ? body.event : "";
      if (!TRACKED_EVENTS.has(event)) {
        return res.status(400).json({ error: "unknown_event", hint: Array.from(TRACKED_EVENTS) });
      }
      const props = (body.props && typeof body.props === "object")
        ? (body.props as Record<string, unknown>)
        : {};
      // Strip any keys > 64 chars or values > 200 chars to avoid abuse
      const cleanProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (k.length > 64) continue;
        if (typeof v === "string" && v.length > 200) {
          cleanProps[k] = v.slice(0, 200);
        } else if (typeof v === "number" || typeof v === "boolean") {
          cleanProps[k] = v;
        } else if (typeof v === "string") {
          cleanProps[k] = v;
        }
      }
      const payload = verifyBearerOptional(req);
      const userId = payload && typeof (payload as Record<string, unknown>).userId === "string"
        ? String((payload as Record<string, unknown>).userId)
        : null;
      const row: EventRow = {
        id: randomUUID(),
        event,
        fpHash: fingerprint(req),
        userId,
        props: cleanProps,
        createdAt: new Date().toISOString(),
      };
      await ensureEventsTable();
      let stored: "postgres" | "memory" = "memory";
      if (dbAvailable) {
        try {
          const pool = getPool();
          await pool.query(
            `INSERT INTO constitution_events ("id","event","fpHash","userId","props","createdAt")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
            [row.id, row.event, row.fpHash, row.userId, JSON.stringify(row.props), row.createdAt],
          );
          stored = "postgres";
        } catch (dbErr) {
          // Раньше провал записи был полностью молчаливым: событие оставалось
          // только в кольцевом буфере, ответ был ok: true, и никто не узнавал,
          // что аналитика теряется. А по этим событиям потом считается воронка
          // (см. GET ниже) — то есть тихая потеря здесь превращается в тихо
          // неверные проценты там.
          capture(dbErr, {
            route: "constitution/track",
            note: "событие не записано в Postgres — осталось только в памяти, аналитика теряется",
          });
          console.error(
            "[Constitution] СОБЫТИЕ НЕ ЗАПИСАНО В БАЗУ — только в памяти:",
            dbErr instanceof Error ? dbErr.message : dbErr,
          );
        }
      }
      pushMem(row);
      // Клиенту тоже говорим правду — так же, как это сделано в записи в лист
      // ожидания (там поле storage).
      res.json({ ok: true, stored });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "track_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

constitutionFunnelAdminRouter.get(
  "/",
  readLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "admin_required" });
    try {
      const hours = Math.max(1, Math.min(168, Number(req.query.hours ?? 24)));
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      let rows: EventRow[] = [];
      // Потолок выборки. По этой воронке принимаются решения, поэтому обрезание
      // нельзя оставлять незаметным: за 168 часов событий может быть больше, и
      // тогда проценты считаются по САМЫМ СТАРЫМ 20 000 (сортировка по возрастанию),
      // выглядя при этом как полная картина. Отдаём флаг наружу.
      const ROW_CAP = 20_000;
      let source: "postgres" | "memory" = "memory";
      let dbQueryFailed = false;
      await ensureEventsTable();
      if (dbAvailable) {
        try {
          const pool = getPool();
          const r = await pool.query(
            `SELECT "id","event","fpHash","userId","props","createdAt"
             FROM constitution_events
             WHERE "createdAt" > $1
             ORDER BY "createdAt" ASC
             LIMIT ${ROW_CAP}`,
            [since],
          );
          rows = r.rows.map((x: Record<string, unknown>) => ({
            id: String(x.id),
            event: String(x.event),
            fpHash: String(x.fpHash),
            userId: x.userId ?? null,
            props: (x.props as Record<string, unknown>) ?? {},
            createdAt: x.createdAt instanceof Date ? x.createdAt.toISOString() : String(x.createdAt),
          }));
          source = "postgres";
        } catch (dbErr) {
          // Раньше сбой базы молча приводил к воронке по кольцевому буферу в
          // памяти — и отдавался в том же виде, что настоящая. Числа, по которым
          // принимают решения, обязаны говорить, откуда они взялись.
          dbQueryFailed = true;
          capture(dbErr, { route: "constitution/funnel", note: "события не прочитаны из Postgres — воронка считается по памяти" });
          console.error(
            "[Constitution] ВОРОНКА СЧИТАЕТСЯ ПО ПАМЯТИ: события не прочитаны из базы.",
            dbErr instanceof Error ? dbErr.message : dbErr,
          );
        }
      }
      if (rows.length === 0) {
        rows = memRing.filter((r) => r.createdAt > since).reverse();
        source = "memory";
      }

      // Count per event
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.event, (counts.get(r.event) ?? 0) + 1);

      // Pairwise conversion within session (30-min window)
      const SESSION_WINDOW_MS = 30 * 60 * 1000;
      const PAIRS: Array<[string, string]> = [
        ["page_view", "slider_change"],
        ["slider_change", "save_clicked"],
        ["save_clicked", "save_success"],
        ["save_success", "qsign_clicked"],
        ["qsign_clicked", "planet_publish"],
        ["qsign_clicked", "pdf_download"],
        ["page_view", "ai_suggest"],
        ["page_view", "upgrade_click"],
        ["upgrade_click", "upgrade_complete"],
        ["tour_started", "tour_completed"],
        ["page_view", "academy_lesson_done"],
        ["academy_lesson_done", "academy_cert"],
      ];

      // Group rows by fpHash
      const byFp = new Map<string, EventRow[]>();
      for (const r of rows) {
        const arr = byFp.get(r.fpHash) ?? [];
        arr.push(r);
        byFp.set(r.fpHash, arr);
      }
      const pairResults = PAIRS.map(([from, to]) => {
        let fromCount = 0;
        let convertedCount = 0;
        for (const arr of byFp.values()) {
          // Sorted ascending already
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].event !== from) continue;
            fromCount += 1;
            const t = new Date(arr[i].createdAt).getTime();
            let found = false;
            for (let j = i + 1; j < arr.length; j++) {
              const dt = new Date(arr[j].createdAt).getTime() - t;
              if (dt > SESSION_WINDOW_MS) break;
              if (arr[j].event === to) { found = true; break; }
            }
            if (found) convertedCount += 1;
          }
        }
        return {
          from,
          to,
          fromCount,
          convertedCount,
          ratePct: fromCount > 0 ? Math.round((convertedCount / fromCount) * 1000) / 10 : 0,
        };
      });

      res.json({
        windowHours: hours,
        totalEvents: rows.length,
        uniqueSessions: byFp.size,
        source,
        dbQueryFailed,
        // true — событий в окне больше, чем взято: проценты ниже посчитаны по
        // самым старым ROW_CAP записям и полной картиной не являются.
        truncated: source === "postgres" && rows.length >= ROW_CAP,
        rowCap: ROW_CAP,
        eventCounts: Array.from(counts.entries())
          .map(([event, count]) => ({ event, count }))
          .sort((a, b) => b.count - a.count),
        conversions: pairResults,
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "funnel_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);
