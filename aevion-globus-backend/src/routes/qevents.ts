import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQEventsTables, isQEventsDbReady } from "../lib/ensureQEventsTables";

export const qeventsRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureQEventsTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

// ─── Types ────────────────────────────────────────────────────────────────────

interface QEvent {
  id: string;
  organizerId: string;
  title: string;
  description: string | null;
  category: string;
  location: string;
  startAt: string;
  endAt: string | null;
  capacity: number;
  price: number;
  attendeeCount: number;
  isPublic: boolean;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RSVP {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  createdAt: string;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memEvents = new Map<string, QEvent>();
const memRSVPs = new Map<string, RSVP>();

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_CATEGORIES = ["tech", "business", "art", "music", "sports", "education", "networking", "other"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── GET /api/qevents/health ──────────────────────────────────────────────────
qeventsRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "qevents",
    db: isQEventsDbReady() ? "postgres" : "in-memory",
  });
});

// ─── GET /api/qevents/categories ─────────────────────────────────────────────
qeventsRouter.get("/categories", (_req: Request, res: Response) => {
  res.json({ categories: EVENT_CATEGORIES });
});

// ─── GET /api/qevents/events ─────────────────────────────────────────────────
qeventsRouter.get("/events", async (req: Request, res: Response) => {
  const { category, location, limit } = req.query as Record<string, string | undefined>;
  const limitN = Math.min(Number(limit) || 20, 100);
  const now = new Date().toISOString();

  try {
    if (isQEventsDbReady()) {
      const conditions: string[] = [`"startAt">=$1`, `"isPublic"=TRUE`];
      const args: unknown[] = [now];
      let idx = 2;
      if (category && EVENT_CATEGORIES.includes(category)) {
        conditions.push(`"category"=$${idx++}`);
        args.push(category);
      }
      if (location) {
        conditions.push(`"location" ILIKE $${idx++}`);
        args.push(`%${location}%`);
      }
      const where = conditions.join(" AND ");
      const { rows } = await pool.query(
        `SELECT * FROM "QEvent" WHERE ${where} ORDER BY "startAt" ASC LIMIT $${idx}`,
        [...args, limitN],
      );
      return res.json({ events: rows });
    }

    let events = Array.from(memEvents.values()).filter(
      (e) => e.isPublic && e.startAt >= now,
    );
    if (category && EVENT_CATEGORIES.includes(category)) {
      events = events.filter((e) => e.category === category);
    }
    if (location) {
      events = events.filter((e) => e.location.toLowerCase().includes(location.toLowerCase()));
    }
    events = events.sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, limitN);
    return res.json({ events });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qevents/events/:id ─────────────────────────────────────────────
qeventsRouter.get("/events/:id", async (req: Request, res: Response) => {
  const id = param(req, "id");
  try {
    if (isQEventsDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QEvent" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      return res.json({ event: rows[0] });
    }
    const event = memEvents.get(id);
    if (!event) return res.status(404).json({ error: "not_found" });
    return res.json({ event });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qevents/me/events ─────────────────────────────────────────────
qeventsRouter.post("/me/events", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const { title, description, category, location, startAt, endAt, capacity, price, coverUrl } =
    req.body as {
      title?: string;
      description?: string;
      category?: string;
      location?: string;
      startAt?: string;
      endAt?: string;
      capacity?: number;
      price?: number;
      coverUrl?: string;
    };

  if (!title || !startAt) {
    return res.status(400).json({ error: "title and startAt required" });
  }

  const event: QEvent = {
    id: crypto.randomUUID(),
    organizerId: auth.sub,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : null,
    category: typeof category === "string" && EVENT_CATEGORIES.includes(category) ? category : "tech",
    location: typeof location === "string" ? location.trim() : "Online",
    startAt,
    endAt: typeof endAt === "string" ? endAt : null,
    capacity: typeof capacity === "number" && capacity > 0 ? capacity : 100,
    price: typeof price === "number" && price >= 0 ? price : 0,
    attendeeCount: 0,
    isPublic: true,
    coverUrl: typeof coverUrl === "string" ? coverUrl : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    if (isQEventsDbReady()) {
      await pool.query(
        `INSERT INTO "QEvent" ("id","organizerId","title","description","category","location","startAt","endAt","capacity","price","attendeeCount","isPublic","coverUrl","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,TRUE,$11,NOW(),NOW())`,
        [
          event.id, event.organizerId, event.title, event.description,
          event.category, event.location, event.startAt, event.endAt,
          event.capacity, event.price, event.coverUrl,
        ],
      );
    } else {
      memEvents.set(event.id, event);
    }
    return res.status(201).json({ event });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── PATCH /api/qevents/me/events/:id ────────────────────────────────────────
qeventsRouter.patch("/me/events/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const id = param(req, "id");

  try {
    if (isQEventsDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QEvent" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].organizerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      const ev = rows[0];
      const b = req.body as Partial<QEvent>;
      const { rows: updated } = await pool.query(
        `UPDATE "QEvent" SET "title"=$1,"description"=$2,"category"=$3,"location"=$4,"startAt"=$5,"endAt"=$6,"capacity"=$7,"price"=$8,"updatedAt"=NOW()
         WHERE "id"=$9 RETURNING *`,
        [
          b.title ?? ev.title,
          b.description ?? ev.description,
          b.category ?? ev.category,
          b.location ?? ev.location,
          b.startAt ?? ev.startAt,
          b.endAt ?? ev.endAt,
          b.capacity ?? ev.capacity,
          b.price ?? ev.price,
          id,
        ],
      );
      return res.json({ event: updated[0] });
    }

    const event = memEvents.get(id);
    if (!event) return res.status(404).json({ error: "not_found" });
    if (event.organizerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    Object.assign(event, { ...req.body, updatedAt: nowIso() });
    return res.json({ event });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── DELETE /api/qevents/me/events/:id ───────────────────────────────────────
qeventsRouter.delete("/me/events/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const id = param(req, "id");

  try {
    if (isQEventsDbReady()) {
      const { rows } = await pool.query(`SELECT "organizerId" FROM "QEvent" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].organizerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      await pool.query(`DELETE FROM "QEvent" WHERE "id"=$1`, [id]);
    } else {
      const event = memEvents.get(id);
      if (!event) return res.status(404).json({ error: "not_found" });
      if (event.organizerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      memEvents.delete(id);
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qevents/events/:id/rsvp — toggle ──────────────────────────────
qeventsRouter.post("/events/:id/rsvp", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const eventId = param(req, "id");

  try {
    if (isQEventsDbReady()) {
      const { rows: existing } = await pool.query(
        `SELECT * FROM "QEventRSVP" WHERE "eventId"=$1 AND "userId"=$2`,
        [eventId, auth.sub],
      );
      let status: string;
      let attendeeCount: number;

      if (existing[0]) {
        // Toggle: if going → not-going, else → going
        const newStatus = existing[0].status === "going" ? "not-going" : "going";
        await pool.query(
          `UPDATE "QEventRSVP" SET "status"=$1 WHERE "eventId"=$2 AND "userId"=$3`,
          [newStatus, eventId, auth.sub],
        );
        const delta = newStatus === "going" ? 1 : -1;
        await pool.query(
          `UPDATE "QEvent" SET "attendeeCount"=GREATEST(0,"attendeeCount"+$1) WHERE "id"=$2`,
          [delta, eventId],
        );
        status = newStatus;
      } else {
        const rsvpId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO "QEventRSVP" ("id","eventId","userId","status","createdAt") VALUES ($1,$2,$3,'going',NOW())`,
          [rsvpId, eventId, auth.sub],
        );
        await pool.query(
          `UPDATE "QEvent" SET "attendeeCount"="attendeeCount"+1 WHERE "id"=$1`,
          [eventId],
        );
        status = "going";
      }

      const { rows: ev } = await pool.query(`SELECT "attendeeCount" FROM "QEvent" WHERE "id"=$1`, [eventId]);
      attendeeCount = ev[0]?.attendeeCount ?? 0;
      return res.json({ status, attendeeCount });
    }

    const event = memEvents.get(eventId);
    if (!event) return res.status(404).json({ error: "not_found" });

    const existingKey = Array.from(memRSVPs.values()).find(
      (r) => r.eventId === eventId && r.userId === auth.sub,
    );

    let status: string;
    if (existingKey) {
      const newStatus = existingKey.status === "going" ? "not-going" : "going";
      existingKey.status = newStatus;
      const delta = newStatus === "going" ? 1 : -1;
      event.attendeeCount = Math.max(0, event.attendeeCount + delta);
      status = newStatus;
    } else {
      const rsvp: RSVP = {
        id: crypto.randomUUID(),
        eventId,
        userId: auth.sub,
        status: "going",
        createdAt: nowIso(),
      };
      memRSVPs.set(rsvp.id, rsvp);
      event.attendeeCount += 1;
      status = "going";
    }

    return res.json({ status, attendeeCount: event.attendeeCount });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qevents/events/:id/attendees ───────────────────────────────────
qeventsRouter.get("/events/:id/attendees", async (req: Request, res: Response) => {
  const eventId = param(req, "id");
  try {
    if (isQEventsDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM "QEventRSVP" WHERE "eventId"=$1 AND "status"='going' ORDER BY "createdAt" ASC`,
        [eventId],
      );
      return res.json({ attendees: rows });
    }
    const attendees = Array.from(memRSVPs.values())
      .filter((r) => r.eventId === eventId && r.status === "going")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return res.json({ attendees });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qevents/me/rsvps ────────────────────────────────────────────────
qeventsRouter.get("/me/rsvps", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  try {
    if (isQEventsDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM "QEventRSVP" WHERE "userId"=$1 ORDER BY "createdAt" DESC`,
        [auth.sub],
      );
      return res.json({ rsvps: rows });
    }
    const rsvps = Array.from(memRSVPs.values())
      .filter((r) => r.userId === auth.sub)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ rsvps });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});
