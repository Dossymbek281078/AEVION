import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString, vNumber } from "../../lib/build";

export const teamHiringRouter = Router();

// POST /api/build/team-requests — post a brigade/team request
teamHiringRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const description = vString(req.body?.description, "description", { min: 10, max: 4000 });
    if (!description.ok) return fail(res, 400, description.error);
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100) || null;
    const startDate = req.body?.startDate == null ? null : String(req.body.startDate).trim().slice(0, 32) || null;

    // roles: [{specialty: string, count: number, salary?: number}]
    type RoleShape = { specialty: string; count: number; salary: number | null };
    const roles: RoleShape[] = Array.isArray(req.body?.roles)
      ? (req.body.roles as unknown[])
          .slice(0, 20)
          .reduce<RoleShape[]>((acc, raw) => {
            if (typeof raw !== "object" || raw === null) return acc;
            const obj = raw as Record<string, unknown>;
            const specialty = String(obj.specialty || "").trim().slice(0, 100);
            if (!specialty) return acc;
            acc.push({
              specialty,
              count: Math.max(1, Math.min(100, Number(obj.count) || 1)),
              salary: obj.salary != null ? Math.round(Number(obj.salary) || 0) : null,
            });
            return acc;
          }, [])
      : [];
    if (roles.length === 0) return fail(res, 400, "roles_required");

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildTeamRequest" ("id","clientId","title","description","rolesJson","city","startDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, auth.sub, title.value, description.value, JSON.stringify(roles), city, startDate],
    );
    return ok(res, { ...result.rows[0], roles }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "team_request_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/team-requests — feed of open team requests
teamHiringRouter.get("/", async (req, res) => {
  try {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : null;
    const specialty = typeof req.query.specialty === "string" ? req.query.specialty.trim() : null;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

    const params: unknown[] = [];
    const where: string[] = [`tr."status" = 'OPEN'`];
    if (city) { params.push(`%${city}%`); where.push(`tr."city" ILIKE $${params.length}`); }
    if (specialty) { params.push(`%${specialty}%`); where.push(`tr."rolesJson" ILIKE $${params.length}`); }
    params.push(limit);

    const result = await pool.query(
      `SELECT tr.*, u."name" AS "clientName",
              (SELECT COUNT(*) FROM "BuildTeamApplication" ta WHERE ta."teamRequestId" = tr."id")::int AS "applicantCount"
       FROM "BuildTeamRequest" tr
       LEFT JOIN "AEVIONUser" u ON u."id" = tr."clientId"
       WHERE ${where.join(" AND ")}
       ORDER BY tr."createdAt" DESC LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      roles: JSON.parse(String(r.rolesJson || "[]")),
    }));
    return ok(res, { items, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "team_requests_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/team-requests/:id
teamHiringRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const [req_, apps] = await Promise.all([
      pool.query(
        `SELECT tr.*, u."name" AS "clientName", p."city" AS "clientCity"
         FROM "BuildTeamRequest" tr
         LEFT JOIN "AEVIONUser" u ON u."id" = tr."clientId"
         LEFT JOIN "BuildProfile" p ON p."userId" = tr."clientId"
         WHERE tr."id" = $1 LIMIT 1`,
        [id],
      ),
      pool.query(
        `SELECT ta.*, u."name" AS "applicantName", bp."title" AS "applicantTitle",
                bp."experienceYears", bp."city" AS "applicantCity"
         FROM "BuildTeamApplication" ta
         LEFT JOIN "AEVIONUser" u ON u."id" = ta."userId"
         LEFT JOIN "BuildProfile" bp ON bp."userId" = ta."userId"
         WHERE ta."teamRequestId" = $1 ORDER BY ta."createdAt" DESC`,
        [id],
      ),
    ]);
    if (req_.rowCount === 0) return fail(res, 404, "team_request_not_found");
    const row = req_.rows[0];
    return ok(res, { ...row, roles: JSON.parse(String(row.rolesJson || "[]")), applications: apps.rows });
  } catch (err: unknown) {
    return fail(res, 500, "team_request_fetch_failed", { details: (err as Error).message });
  }
});

// POST /api/build/team-requests/:id/apply — apply for a specific role
teamHiringRouter.post("/:id/apply", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const teamReq = await pool.query(`SELECT * FROM "BuildTeamRequest" WHERE "id" = $1 LIMIT 1`, [id]);
    if (teamReq.rowCount === 0) return fail(res, 404, "team_request_not_found");
    if (teamReq.rows[0].status !== "OPEN") return fail(res, 409, "team_request_closed");
    if (teamReq.rows[0].clientId === auth.sub) return fail(res, 400, "cannot_apply_own_request");

    const roles = JSON.parse(String(teamReq.rows[0].rolesJson || "[]"));
    const roleIndexVal = vNumber(req.body?.roleIndex, "roleIndex", { min: 0, max: roles.length - 1 });
    if (!roleIndexVal.ok) return fail(res, 400, roleIndexVal.error);
    const roleIndex = Math.round(roleIndexVal.value);

    const message = req.body?.message == null ? null : String(req.body.message).trim().slice(0, 2000) || null;

    const appId = crypto.randomUUID();
    try {
      const result = await pool.query(
        `INSERT INTO "BuildTeamApplication" ("id","teamRequestId","userId","roleIndex","message")
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [appId, id, auth.sub, roleIndex, message],
      );
      return ok(res, { ...result.rows[0], role: roles[roleIndex] }, 201);
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "23505") return fail(res, 409, "already_applied_for_this_role");
      throw e;
    }
  } catch (err: unknown) {
    return fail(res, 500, "team_apply_failed", { details: (err as Error).message });
  }
});
