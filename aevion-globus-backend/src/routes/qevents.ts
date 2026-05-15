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
const memWaitlist = new Map<string, string[]>(); // eventId -> userId[]

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
// Query: ?category=&location=&limit=&when=upcoming|past|all (default upcoming)
qeventsRouter.get("/events", async (req: Request, res: Response) => {
  const { category, location, limit, when } = req.query as Record<string, string | undefined>;
  const limitN = Math.min(Number(limit) || 20, 100);
  const now = new Date().toISOString();
  const whenFilter = (when ?? "upcoming").toLowerCase();

  try {
    if (isQEventsDbReady()) {
      const conditions: string[] = [`"isPublic"=TRUE`];
      const args: unknown[] = [];
      let idx = 1;

      if (whenFilter === "upcoming") {
        conditions.push(`"startAt">=$${idx++}`);
        args.push(now);
      } else if (whenFilter === "past") {
        conditions.push(`"startAt"<$${idx++}`);
        args.push(now);
      }
      // when=all → no time filter

      if (category && EVENT_CATEGORIES.includes(category)) {
        conditions.push(`"category"=$${idx++}`);
        args.push(category);
      }
      if (location) {
        conditions.push(`"location" ILIKE $${idx++}`);
        args.push(`%${location}%`);
      }
      const where = conditions.join(" AND ");
      const orderBy = whenFilter === "past" ? `ORDER BY "startAt" DESC` : `ORDER BY "startAt" ASC`;
      const { rows } = await pool.query(
        `SELECT * FROM "QEvent" WHERE ${where} ${orderBy} LIMIT $${idx}`,
        [...args, limitN],
      );
      return res.json({ events: rows, when: whenFilter });
    }

    let events = Array.from(memEvents.values()).filter((e) => e.isPublic);
    if (whenFilter === "upcoming") {
      events = events.filter((e) => e.startAt >= now);
    } else if (whenFilter === "past") {
      events = events.filter((e) => e.startAt < now);
    }
    if (category && EVENT_CATEGORIES.includes(category)) {
      events = events.filter((e) => e.category === category);
    }
    if (location) {
      events = events.filter((e) => e.location.toLowerCase().includes(location.toLowerCase()));
    }
    events = events
      .sort((a, b) =>
        whenFilter === "past"
          ? b.startAt.localeCompare(a.startAt)
          : a.startAt.localeCompare(b.startAt),
      )
      .slice(0, limitN);
    return res.json({ events, when: whenFilter });
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
      // Capacity check when attempting to RSVP "going"
      if (newStatus === "going" && event.attendeeCount >= event.capacity) {
        return res.status(409).json({ error: "Event is full", waitlistAvailable: true });
      }
      existingKey.status = newStatus;
      const delta = newStatus === "going" ? 1 : -1;
      event.attendeeCount = Math.max(0, event.attendeeCount + delta);
      status = newStatus;
    } else {
      // New RSVP — enforce capacity
      if (event.attendeeCount >= event.capacity) {
        return res.status(409).json({ error: "Event is full", waitlistAvailable: true });
      }
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

// ─── GET /api/qevents/calendar ────────────────────────────────────────────────
qeventsRouter.get("/calendar", (_req: Request, res: Response) => {
  const year = parseInt(String(_req.query.year ?? new Date().getFullYear()), 10);
  const month = parseInt(String(_req.query.month ?? new Date().getMonth() + 1), 10);
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const days: Record<string, QEvent[]> = {};
  for (const ev of memEvents.values()) {
    if (!ev.isPublic) continue;
    if (!ev.startAt.startsWith(ym)) continue;
    const day = ev.startAt.slice(0, 10);
    if (!days[day]) days[day] = [];
    days[day].push(ev);
  }
  return res.json({ year, month, days });
});

// ─── POST /api/qevents/events/:id/waitlist ────────────────────────────────────
qeventsRouter.post("/events/:id/waitlist", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });
  const eventId = param(req, "id");
  const event = memEvents.get(eventId);
  if (!event) return res.status(404).json({ error: "not_found" });
  if (event.attendeeCount < event.capacity) {
    return res.status(400).json({ error: "Event is not full, RSVP directly" });
  }
  const list = memWaitlist.get(eventId) ?? [];
  if (!list.includes(auth.sub)) list.push(auth.sub);
  memWaitlist.set(eventId, list);
  return res.json({ position: list.indexOf(auth.sub) + 1 });
});

// ─── GET /api/qevents/events/:id/waitlist — owner only ────────────────────────
qeventsRouter.get("/events/:id/waitlist", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });
  const eventId = param(req, "id");
  const event = memEvents.get(eventId);
  if (!event) return res.status(404).json({ error: "not_found" });
  if (event.organizerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
  const list = memWaitlist.get(eventId) ?? [];
  return res.json({ waitlist: list, count: list.length });
});

// ─── POST /api/qevents/events/:id/share ──────────────────────────────────────
qeventsRouter.post("/events/:id/share", (req: Request, res: Response) => {
  const id = param(req, "id");
  const event = memEvents.get(id);
  if (!event) return res.status(404).json({ error: "not_found" });
  return res.json({ shareUrl: `https://aevion.app/events/${id}` });
});

// ─── GET /api/qevents/events/:id/ics — iCal export ───────────────────────────
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcsDate(iso: string): string {
  // 2026-05-13T15:30:00.000Z → 20260513T153000Z
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function buildIcs(event: QEvent): string {
  const dtStamp = toIcsDate(new Date().toISOString());
  const dtStart = toIcsDate(event.startAt);
  // Fallback: end = start + 1 hour if not provided
  const endIso =
    event.endAt ?? new Date(new Date(event.startAt).getTime() + 60 * 60 * 1000).toISOString();
  const dtEnd = toIcsDate(endIso);
  const summary = icsEscape(event.title || "QEvent");
  const description = icsEscape(event.description ?? "");
  const location = icsEscape(event.location ?? "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AEVION//QEvents//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@qevents.aevion.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : "",
    location ? `LOCATION:${location}` : "",
    `CATEGORIES:${icsEscape(event.category || "other").toUpperCase()}`,
    `URL:https://aevion.app/qevents/${event.id}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

qeventsRouter.get("/events/:id/ics", async (req: Request, res: Response) => {
  const id = param(req, "id");
  try {
    let event: QEvent | undefined;
    if (isQEventsDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QEvent" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      event = rows[0] as QEvent;
    } else {
      event = memEvents.get(id);
      if (!event) return res.status(404).json({ error: "not_found" });
    }

    const ics = buildIcs(event);
    const safeTitle = (event.title || "event")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "event";

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qevents-${safeTitle}-${event.id.slice(0, 8)}.ics"`,
    );
    return res.send(ics);
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});
