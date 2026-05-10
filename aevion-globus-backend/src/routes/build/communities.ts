import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString } from "../../lib/build";

export const communitiesRouter = Router();

// Seed default communities if none exist (called lazily on first GET)
async function ensureDefaultCommunities(): Promise<void> {
  const count = await pool.query(`SELECT COUNT(*) FROM "BuildCommunity"`);
  if (Number(count.rows[0].count) > 0) return;
  const defaults = [
    { slug: "welders-kz", name: "Сварщики Казахстан", specialty: "Сварка" },
    { slug: "electricians-kz", name: "Электрики Казахстан", specialty: "Электрика" },
    { slug: "bricklayers-kz", name: "Каменщики & Монолитчики КЗ", specialty: "Каменная кладка" },
    { slug: "foremen-kz", name: "Прорабы СНГ", specialty: "Управление стройкой" },
    { slug: "finishers-almaty", name: "Отделочники Алматы", specialty: "Отделка" },
    { slug: "plumbers-kz", name: "Сантехники Казахстан", specialty: "Сантехника" },
    { slug: "drivers-construction", name: "Водители спецтехники", specialty: "Спецтехника" },
    { slug: "designers-kz", name: "Дизайн & Архитектура КЗ", specialty: "Дизайн интерьера" },
  ];
  for (const d of defaults) {
    await pool.query(
      `INSERT INTO "BuildCommunity" ("id","slug","name","specialty")
       VALUES ($1,$2,$3,$4) ON CONFLICT ("slug") DO NOTHING`,
      [crypto.randomUUID(), d.slug, d.name, d.specialty],
    );
  }
}

// GET /api/build/communities — list all communities with member count + last message time
communitiesRouter.get("/", async (_req, res) => {
  try {
    await ensureDefaultCommunities();
    const result = await pool.query(
      `SELECT c.*,
              (SELECT MAX("createdAt") FROM "BuildCommunityMessage" m WHERE m."communityId" = c."id") AS "lastMessageAt"
       FROM "BuildCommunity" c
       ORDER BY "memberCount" DESC, "createdAt" ASC`,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "communities_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/communities/:slug — single community with recent messages
communitiesRouter.get("/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const community = await pool.query(`SELECT * FROM "BuildCommunity" WHERE "slug" = $1 LIMIT 1`, [slug]);
    if (community.rowCount === 0) return fail(res, 404, "community_not_found");

    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
    const before = typeof req.query.before === "string" ? req.query.before : null;

    const params: unknown[] = [community.rows[0].id, limit];
    let timeCond = "";
    if (before) { params.push(before); timeCond = `AND m."createdAt" < $${params.length}`; }

    const messages = await pool.query(
      `SELECT m.*, u."name" AS "authorName", p."photoUrl" AS "authorPhoto", p."buildRole"
       FROM "BuildCommunityMessage" m
       LEFT JOIN "AEVIONUser" u ON u."id" = m."userId"
       LEFT JOIN "BuildProfile" p ON p."userId" = m."userId"
       WHERE m."communityId" = $1 ${timeCond}
       ORDER BY m."createdAt" DESC LIMIT $2`,
      params,
    );
    return ok(res, { community: community.rows[0], messages: messages.rows.reverse(), total: messages.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "community_fetch_failed", { details: (err as Error).message });
  }
});

// POST /api/build/communities/:slug/join
communitiesRouter.post("/:slug/join", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const slug = String(req.params.slug);
    const community = await pool.query(`SELECT "id" FROM "BuildCommunity" WHERE "slug" = $1 LIMIT 1`, [slug]);
    if (community.rowCount === 0) return fail(res, 404, "community_not_found");
    const cid = community.rows[0].id;

    await pool.query(
      `INSERT INTO "BuildCommunityMember" ("communityId","userId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cid, auth.sub],
    );
    await pool.query(`UPDATE "BuildCommunity" SET "memberCount" = (SELECT COUNT(*) FROM "BuildCommunityMember" WHERE "communityId" = $1) WHERE "id" = $1`, [cid]);
    return ok(res, { joined: true });
  } catch (err: unknown) {
    return fail(res, 500, "community_join_failed", { details: (err as Error).message });
  }
});

// POST /api/build/communities/:slug/leave
communitiesRouter.post("/:slug/leave", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const slug = String(req.params.slug);
    const community = await pool.query(`SELECT "id" FROM "BuildCommunity" WHERE "slug" = $1 LIMIT 1`, [slug]);
    if (community.rowCount === 0) return fail(res, 404, "community_not_found");
    const cid = community.rows[0].id;
    await pool.query(`DELETE FROM "BuildCommunityMember" WHERE "communityId" = $1 AND "userId" = $2`, [cid, auth.sub]);
    await pool.query(`UPDATE "BuildCommunity" SET "memberCount" = (SELECT COUNT(*) FROM "BuildCommunityMember" WHERE "communityId" = $1) WHERE "id" = $1`, [cid]);
    return ok(res, { left: true });
  } catch (err: unknown) {
    return fail(res, 500, "community_leave_failed", { details: (err as Error).message });
  }
});

// POST /api/build/communities/:slug/messages — send message
communitiesRouter.post("/:slug/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const slug = String(req.params.slug);
    const community = await pool.query(`SELECT "id" FROM "BuildCommunity" WHERE "slug" = $1 LIMIT 1`, [slug]);
    if (community.rowCount === 0) return fail(res, 404, "community_not_found");

    const content = vString(req.body?.content, "content", { min: 1, max: 2000 });
    if (!content.ok) return fail(res, 400, content.error);

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildCommunityMessage" ("id","communityId","userId","content")
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, community.rows[0].id, auth.sub, content.value],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "community_message_failed", { details: (err as Error).message });
  }
});
