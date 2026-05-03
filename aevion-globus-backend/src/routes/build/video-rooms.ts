import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString } from "../../lib/build";

export const videoRoomsRouter = Router();

// Daily.co API wrapper — creates a new room and returns join URL.
// Falls back to a stub URL if DAILY_API_KEY is not set (dev mode).
async function createDailyRoom(roomName: string): Promise<{ url: string }> {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey) {
    // Dev mode — return a stub that still works for testing
    return { url: `https://aevion.daily.co/${roomName}` };
  }
  const res = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        max_participants: 10,
        enable_screenshare: true,
        enable_recording: "cloud",
        exp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24h
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily.co error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { url: string };
  return { url: data.url };
}

// POST /api/build/video/rooms — create a video room (host → optional guest)
videoRoomsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const guestId = req.body?.guestId == null ? null : String(req.body.guestId).trim() || null;
    const scheduledAt = req.body?.scheduledAt == null ? null : String(req.body.scheduledAt).trim() || null;

    const roomName = `qbuild-${auth.sub.slice(0, 8)}-${Date.now()}`;

    let roomUrl: string;
    try {
      const room = await createDailyRoom(roomName);
      roomUrl = room.url;
    } catch (e) {
      return fail(res, 502, "video_room_creation_failed", { details: (e as Error).message });
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildVideoRoom" ("id","hostId","guestId","roomName","roomUrl","scheduledAt")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, auth.sub, guestId, roomName, roomUrl, scheduledAt],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "video_room_failed", { details: (err as Error).message });
  }
});

// GET /api/build/video/rooms/my — my created + invited rooms
videoRoomsRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const result = await pool.query(
      `SELECT r.*,
              uh."name" AS "hostName",
              ug."name" AS "guestName"
       FROM "BuildVideoRoom" r
       LEFT JOIN "AEVIONUser" uh ON uh."id" = r."hostId"
       LEFT JOIN "AEVIONUser" ug ON ug."id" = r."guestId"
       WHERE r."hostId" = $1 OR r."guestId" = $1
       ORDER BY r."createdAt" DESC LIMIT 50`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "video_rooms_my_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/video/rooms/:id/end — host marks room as ended
videoRoomsRouter.patch("/:id/end", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "hostId" FROM "BuildVideoRoom" WHERE "id" = $1 LIMIT 1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "room_not_found");
    if (row.rows[0].hostId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_host_can_end");
    const result = await pool.query(
      `UPDATE "BuildVideoRoom" SET "endedAt" = NOW(), "status" = 'ENDED' WHERE "id" = $1 RETURNING *`,
      [id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "video_room_end_failed", { details: (err as Error).message });
  }
});

// POST /api/build/video/rooms/:id/invite — send room URL to guest via DM
videoRoomsRouter.post("/:id/invite", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const room = await pool.query(`SELECT * FROM "BuildVideoRoom" WHERE "id" = $1 LIMIT 1`, [id]);
    if (room.rowCount === 0) return fail(res, 404, "room_not_found");
    if (room.rows[0].hostId !== auth.sub) return fail(res, 403, "only_host_can_invite");

    const guestId = vString(req.body?.guestId, "guestId", { min: 1, max: 100 });
    if (!guestId.ok) return fail(res, 400, guestId.error);

    // Update guest on the room
    await pool.query(`UPDATE "BuildVideoRoom" SET "guestId" = $1 WHERE "id" = $2`, [guestId.value, id]);

    // Send a DM with the room link
    const msgId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "BuildMessage" ("id","senderId","receiverId","content")
       VALUES ($1,$2,$3,$4)`,
      [
        msgId,
        auth.sub,
        guestId.value,
        `Приглашение на видеозвонок: ${room.rows[0].roomUrl}\n\nПодключайтесь по ссылке — ждём вас!`,
      ],
    );
    return ok(res, { invited: true, roomUrl: room.rows[0].roomUrl });
  } catch (err: unknown) {
    return fail(res, 500, "video_invite_failed", { details: (err as Error).message });
  }
});
