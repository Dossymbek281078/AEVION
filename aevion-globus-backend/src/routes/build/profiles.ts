import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
  vEnum,
  safeParseJson,
  getUserPlan,
  ensureUsageRow,
  bumpUsage,
  isUnlimited,
  BUILD_ROLES,
  SHIFT_PREFERENCES,
  AVAILABILITY_TYPES,
} from "../../lib/build";

export const profilesRouter = Router();

// GET /api/build/users/me
profilesRouter.get("/users/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const u = await pool.query(
      `SELECT "id", "email", "name", "role", "createdAt"
       FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`,
      [auth.sub],
    );
    if (u.rowCount === 0) return fail(res, 404, "user_not_found");

    const p = await pool.query(
      `SELECT * FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );

    const rawProfile = p.rows[0] || null;
    const profile = rawProfile
      ? {
          ...rawProfile,
          skills: safeParseJson(rawProfile.skillsJson, [] as string[]),
          languages: safeParseJson(rawProfile.languagesJson, [] as string[]),
          certifications: safeParseJson(rawProfile.certificationsJson, [] as unknown[]),
          portfolio: safeParseJson(rawProfile.portfolioJson, [] as unknown[]),
          achievements: safeParseJson(rawProfile.achievementsJson, [] as unknown[]),
          preferredLocations: safeParseJson(rawProfile.preferredLocationsJson, [] as string[]),
          toolsOwned: safeParseJson(rawProfile.toolsOwnedJson, [] as string[]),
        }
      : null;

    return ok(res, { user: u.rows[0], profile });
  } catch (err: unknown) {
    return fail(res, 500, "users_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/profiles — upsert own build profile
profilesRouter.post("/profiles", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const name = vString(req.body?.name, "name", { min: 2, max: 200 });
    if (!name.ok) return fail(res, 400, name.error);

    const phone = req.body?.phone == null
      ? { ok: true as const, value: null }
      : vString(req.body.phone, "phone", { max: 32, allowEmpty: true });
    if (phone.ok === false) return fail(res, 400, phone.error);

    const city = req.body?.city == null
      ? { ok: true as const, value: null }
      : vString(req.body.city, "city", { max: 100, allowEmpty: true });
    if (city.ok === false) return fail(res, 400, city.error);

    const description = req.body?.description == null
      ? { ok: true as const, value: null }
      : vString(req.body.description, "description", { max: 4000, allowEmpty: true });
    if (description.ok === false) return fail(res, 400, description.error);

    const role = req.body?.buildRole == null
      ? { ok: true as const, value: "CLIENT" as const }
      : vEnum(req.body.buildRole, "buildRole", BUILD_ROLES);
    if (role.ok === false) return fail(res, 400, role.error);
    if (role.value === "ADMIN" && auth.role !== "ADMIN") {
      return fail(res, 403, "admin_role_not_self_assignable");
    }

    const title = req.body?.title == null ? null
      : (vString(req.body.title, "title", { max: 200, allowEmpty: true }).ok
          ? String(req.body.title).trim() || null : null);
    const summary = req.body?.summary == null ? null
      : (vString(req.body.summary, "summary", { max: 4000, allowEmpty: true }).ok
          ? String(req.body.summary).trim() || null : null);
    const skills = Array.isArray(req.body?.skills)
      ? req.body.skills.map((s: unknown) => String(s).trim()).filter((s: string) => s.length > 0 && s.length <= 60).slice(0, 50)
      : [];
    const languages = Array.isArray(req.body?.languages)
      ? req.body.languages.map((s: unknown) => String(s).trim()).filter((s: string) => s.length > 0 && s.length <= 60).slice(0, 20)
      : [];
    const salaryMin = req.body?.salaryMin == null ? null : Number(req.body.salaryMin);
    const salaryMax = req.body?.salaryMax == null ? null : Number(req.body.salaryMax);
    if (salaryMin != null && (!Number.isFinite(salaryMin) || salaryMin < 0)) return fail(res, 400, "salaryMin_invalid");
    if (salaryMax != null && (!Number.isFinite(salaryMax) || salaryMax < 0)) return fail(res, 400, "salaryMax_invalid");
    const salaryCurrency = typeof req.body?.salaryCurrency === "string"
      ? req.body.salaryCurrency.trim().slice(0, 8) || "RUB" : "RUB";
    const availability = req.body?.availability == null
      ? null : String(req.body.availability).trim().slice(0, 100) || null;
    const experienceYears = req.body?.experienceYears == null
      ? 0 : Math.max(0, Math.min(80, Math.round(Number(req.body.experienceYears) || 0)));
    const photoUrl = req.body?.photoUrl == null
      ? null : String(req.body.photoUrl).trim().slice(0, 2000) || null;
    const openToWork = req.body?.openToWork === true || req.body?.openToWork === "true";

    const arrField = (raw: unknown, max = 30, maxLen = 200): string[] =>
      Array.isArray(raw)
        ? raw.map((s) => String(s).trim()).filter((s) => s.length > 0 && s.length <= maxLen).slice(0, max)
        : [];
    const objArrField = (raw: unknown, max = 30): unknown[] =>
      Array.isArray(raw) ? raw.slice(0, max) : [];

    const certifications = objArrField(req.body?.certifications, 20);
    const portfolio = objArrField(req.body?.portfolio, 20);
    const achievements = objArrField(req.body?.achievements, 20);
    const driversLicense = req.body?.driversLicense == null
      ? null : String(req.body.driversLicense).trim().slice(0, 32) || null;
    const shiftPreference =
      typeof req.body?.shiftPreference === "string" && (SHIFT_PREFERENCES as readonly string[]).includes(req.body.shiftPreference)
        ? (req.body.shiftPreference as typeof SHIFT_PREFERENCES[number]) : null;
    const availabilityType =
      typeof req.body?.availabilityType === "string" && (AVAILABILITY_TYPES as readonly string[]).includes(req.body.availabilityType)
        ? (req.body.availabilityType as typeof AVAILABILITY_TYPES[number]) : null;
    const readyFromDate = req.body?.readyFromDate == null
      ? null : String(req.body.readyFromDate).trim().slice(0, 32) || null;
    const preferredLocations = arrField(req.body?.preferredLocations, 20, 100);
    const toolsOwned = arrField(req.body?.toolsOwned, 50, 80);
    const medicalCheckValid = req.body?.medicalCheckValid === true || req.body?.medicalCheckValid === "true";
    const medicalCheckUntil = req.body?.medicalCheckUntil == null
      ? null : String(req.body.medicalCheckUntil).trim().slice(0, 32) || null;
    const safetyTrainingValid = req.body?.safetyTrainingValid === true || req.body?.safetyTrainingValid === "true";
    const safetyTrainingUntil = req.body?.safetyTrainingUntil == null
      ? null : String(req.body.safetyTrainingUntil).trim().slice(0, 32) || null;
    const introVideoUrl = req.body?.introVideoUrl == null
      ? null : String(req.body.introVideoUrl).trim().slice(0, 500) || null;

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildProfile"
         ("id","userId","name","phone","city","description","buildRole",
          "title","summary","skillsJson","languagesJson",
          "salaryMin","salaryMax","salaryCurrency","availability",
          "experienceYears","photoUrl","openToWork",
          "certificationsJson","portfolioJson","achievementsJson",
          "driversLicense","shiftPreference","availabilityType","readyFromDate",
          "preferredLocationsJson","toolsOwnedJson",
          "medicalCheckValid","medicalCheckUntil",
          "safetyTrainingValid","safetyTrainingUntil","introVideoUrl")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
       ON CONFLICT ("userId") DO UPDATE SET
         "name" = EXCLUDED."name", "phone" = EXCLUDED."phone",
         "city" = EXCLUDED."city", "description" = EXCLUDED."description",
         "buildRole" = EXCLUDED."buildRole", "title" = EXCLUDED."title",
         "summary" = EXCLUDED."summary", "skillsJson" = EXCLUDED."skillsJson",
         "languagesJson" = EXCLUDED."languagesJson",
         "salaryMin" = EXCLUDED."salaryMin", "salaryMax" = EXCLUDED."salaryMax",
         "salaryCurrency" = EXCLUDED."salaryCurrency",
         "availability" = EXCLUDED."availability",
         "experienceYears" = EXCLUDED."experienceYears",
         "photoUrl" = EXCLUDED."photoUrl", "openToWork" = EXCLUDED."openToWork",
         "certificationsJson" = EXCLUDED."certificationsJson",
         "portfolioJson" = EXCLUDED."portfolioJson",
         "achievementsJson" = EXCLUDED."achievementsJson",
         "driversLicense" = EXCLUDED."driversLicense",
         "shiftPreference" = EXCLUDED."shiftPreference",
         "availabilityType" = EXCLUDED."availabilityType",
         "readyFromDate" = EXCLUDED."readyFromDate",
         "preferredLocationsJson" = EXCLUDED."preferredLocationsJson",
         "toolsOwnedJson" = EXCLUDED."toolsOwnedJson",
         "medicalCheckValid" = EXCLUDED."medicalCheckValid",
         "medicalCheckUntil" = EXCLUDED."medicalCheckUntil",
         "safetyTrainingValid" = EXCLUDED."safetyTrainingValid",
         "safetyTrainingUntil" = EXCLUDED."safetyTrainingUntil",
         "introVideoUrl" = EXCLUDED."introVideoUrl",
         "updatedAt" = NOW()
       RETURNING *`,
      [
        id, auth.sub, name.value, phone.value || null, city.value || null, description.value || null,
        role.value, title, summary, JSON.stringify(skills), JSON.stringify(languages),
        salaryMin != null ? Math.round(salaryMin) : null,
        salaryMax != null ? Math.round(salaryMax) : null,
        salaryCurrency, availability, experienceYears, photoUrl, openToWork,
        JSON.stringify(certifications), JSON.stringify(portfolio), JSON.stringify(achievements),
        driversLicense, shiftPreference, availabilityType, readyFromDate,
        JSON.stringify(preferredLocations), JSON.stringify(toolsOwned),
        medicalCheckValid, medicalCheckUntil, safetyTrainingValid, safetyTrainingUntil, introVideoUrl,
      ],
    );

    const row = result.rows[0];
    return ok(res, {
      ...row,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      languages: safeParseJson(row.languagesJson, [] as string[]),
      certifications: safeParseJson(row.certificationsJson, [] as unknown[]),
      portfolio: safeParseJson(row.portfolioJson, [] as unknown[]),
      achievements: safeParseJson(row.achievementsJson, [] as unknown[]),
      preferredLocations: safeParseJson(row.preferredLocationsJson, [] as string[]),
      toolsOwned: safeParseJson(row.toolsOwnedJson, [] as string[]),
    }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "profile_upsert_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/:id — public profile + experiences + education + rating
profilesRouter.get("/profiles/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT p."id", p."userId", p."name", p."city", p."description", p."buildRole", p."createdAt",
              p."title", p."summary", p."skillsJson", p."languagesJson",
              p."salaryMin", p."salaryMax", p."salaryCurrency", p."availability",
              p."experienceYears", p."photoUrl", p."openToWork",
              p."verifiedAt", p."verifiedReason",
              p."certificationsJson", p."portfolioJson", p."achievementsJson",
              p."driversLicense", p."shiftPreference", p."availabilityType", p."readyFromDate",
              p."preferredLocationsJson", p."toolsOwnedJson",
              p."medicalCheckValid", p."medicalCheckUntil",
              p."safetyTrainingValid", p."safetyTrainingUntil",
              u."email"
       FROM "BuildProfile" p
       LEFT JOIN "AEVIONUser" u ON u."id" = p."userId"
       WHERE p."userId" = $1 LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");

    const [exp, edu, ratingAgg] = await Promise.all([
      pool.query(
        `SELECT * FROM "BuildExperience" WHERE "userId" = $1
         ORDER BY "current" DESC, "sortOrder" ASC, "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT * FROM "BuildEducation" WHERE "userId" = $1
         ORDER BY COALESCE("toYear",9999) DESC, "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS "count", COALESCE(AVG("rating"),0)::float8 AS "avg"
           FROM "BuildReview" WHERE "revieweeId" = $1`,
        [id],
      ),
    ]);

    const row = result.rows[0];
    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, {
      ...row,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      languages: safeParseJson(row.languagesJson, [] as string[]),
      certifications: safeParseJson(row.certificationsJson, [] as unknown[]),
      portfolio: safeParseJson(row.portfolioJson, [] as unknown[]),
      achievements: safeParseJson(row.achievementsJson, [] as unknown[]),
      preferredLocations: safeParseJson(row.preferredLocationsJson, [] as string[]),
      toolsOwned: safeParseJson(row.toolsOwnedJson, [] as string[]),
      experiences: exp.rows,
      education: edu.rows,
      reviewCount: Number(ratingAgg.rows[0]?.count ?? 0),
      avgRating: Number((Number(ratingAgg.rows[0]?.avg ?? 0)).toFixed(2)),
    });
  } catch (err: unknown) {
    return fail(res, 500, "profile_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/search — recruiter talent search
profilesRouter.get("/profiles/search", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    if (auth.role !== "ADMIN") {
      const plan = await getUserPlan(auth.sub);
      if (!isUnlimited(plan.talentSearchPerMonth)) {
        const usage = await ensureUsageRow(auth.sub);
        if (usage.talentSearches >= plan.talentSearchPerMonth) {
          return fail(res, 403, "plan_talent_search_limit_reached", {
            planKey: plan.key,
            limit: plan.talentSearchPerMonth,
            used: usage.talentSearches,
            monthKey: usage.monthKey,
            upgradeUrl: "/build/pricing",
          });
        }
      }
      await bumpUsage(auth.sub, "talentSearches");
    }

    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof req.query.q === "string" && req.query.q.trim()) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(`(p."name" ILIKE $${params.length} OR p."title" ILIKE $${params.length} OR p."summary" ILIKE $${params.length} OR p."description" ILIKE $${params.length})`);
    }
    if (typeof req.query.city === "string" && req.query.city.trim()) {
      params.push(`%${req.query.city.trim()}%`);
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (typeof req.query.role === "string") {
      const r = vEnum(req.query.role, "role", BUILD_ROLES);
      if (!r.ok) return fail(res, 400, r.error);
      params.push(r.value);
      where.push(`p."buildRole" = $${params.length}`);
    }
    if (req.query.minExp !== undefined) {
      const v = vNumber(req.query.minExp, "minExp", { min: 0, max: 80 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(Math.round(v.value));
      where.push(`p."experienceYears" >= $${params.length}`);
    }
    if (req.query.openToWork === "1" || req.query.openToWork === "true") {
      where.push(`p."openToWork" = TRUE`);
    }
    if (typeof req.query.skill === "string" && req.query.skill.trim()) {
      const skills = req.query.skill.split(",").map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 60).slice(0, 10);
      for (const s of skills) {
        params.push(`%"${s.replace(/"/g, "")}%`);
        where.push(`p."skillsJson" ILIKE $${params.length}`);
      }
    }

    const limitRaw = req.query.limit !== undefined
      ? vNumber(req.query.limit, "limit", { min: 1, max: 50 })
      : { ok: true as const, value: 30 };
    if (limitRaw.ok === false) return fail(res, 400, limitRaw.error);
    params.push(limitRaw.value);

    const result = await pool.query(
      `SELECT p."userId", p."name", p."city", p."buildRole",
              p."title", p."summary", p."skillsJson", p."languagesJson",
              p."salaryMin", p."salaryMax", p."salaryCurrency",
              p."availability", p."experienceYears", p."photoUrl",
              p."openToWork", p."verifiedAt", p."updatedAt",
              COALESCE(rv."count", 0)::int AS "reviewCount",
              COALESCE(rv."avg", 0)::float8 AS "avgRating"
       FROM "BuildProfile" p
       LEFT JOIN (
         SELECT "revieweeId", COUNT(*)::int AS "count", AVG("rating")::float8 AS "avg"
           FROM "BuildReview" GROUP BY "revieweeId"
       ) rv ON rv."revieweeId" = p."userId"
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY p."openToWork" DESC, p."updatedAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      skills: safeParseJson(r.skillsJson, [] as string[]),
      languages: safeParseJson(r.languagesJson, [] as string[]),
      avgRating: Number((Number(r.avgRating ?? 0)).toFixed(2)),
    }));
    return ok(res, { items, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "profiles_search_failed", { details: (err as Error).message });
  }
});

// POST /api/build/profiles/:id/verify — admin-only
profilesRouter.post("/profiles/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const id = String(req.params.id);
    const reason = req.body?.reason == null ? null : String(req.body.reason).trim().slice(0, 200) || null;

    const result = await pool.query(
      `UPDATE "BuildProfile" SET "verifiedAt" = NOW(), "verifiedReason" = $2, "updatedAt" = NOW()
       WHERE "userId" = $1 RETURNING *`,
      [id, reason],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "profile_verify_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/profiles/:id/verify — admin-only revoke
profilesRouter.delete("/profiles/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const id = String(req.params.id);
    const result = await pool.query(
      `UPDATE "BuildProfile" SET "verifiedAt" = NULL, "verifiedReason" = NULL, "updatedAt" = NOW()
       WHERE "userId" = $1 RETURNING *`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "profile_unverify_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/:id/resume.pdf — public PDF export
profilesRouter.get("/profiles/:id/resume.pdf", async (req, res) => {
  try {
    const id = String(req.params.id);
    const profileQ = await pool.query(
      `SELECT p.*, u."email" FROM "BuildProfile" p
       LEFT JOIN "AEVIONUser" u ON u."id" = p."userId"
       WHERE p."userId" = $1 LIMIT 1`,
      [id],
    );
    if (profileQ.rowCount === 0) return fail(res, 404, "profile_not_found");
    const p = profileQ.rows[0];

    const [expQ, eduQ] = await Promise.all([
      pool.query(`SELECT * FROM "BuildExperience" WHERE "userId" = $1 ORDER BY "current" DESC, "sortOrder" ASC, "createdAt" DESC`, [id]),
      pool.query(`SELECT * FROM "BuildEducation" WHERE "userId" = $1 ORDER BY COALESCE("toYear",9999) DESC, "createdAt" DESC`, [id]),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFDocument = ((await import("pdfkit")) as any).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c?: Buffer) => { if (c) chunks.push(c); });
    const done = new Promise<Buffer>((resolve) => { doc.on("end", () => resolve(Buffer.concat(chunks))); });

    const skills = safeParseJson(p.skillsJson, [] as string[]);
    const languages = safeParseJson(p.languagesJson, [] as string[]);
    const certifications = safeParseJson(p.certificationsJson, [] as Array<{ name?: string; issuer?: string; year?: number }>);
    const portfolio = safeParseJson(p.portfolioJson, [] as Array<{ label?: string; url?: string }>);
    const achievements = safeParseJson(p.achievementsJson, [] as Array<{ title?: string; description?: string; year?: number }>);
    const preferredLocations = safeParseJson(p.preferredLocationsJson, [] as string[]);
    const toolsOwned = safeParseJson(p.toolsOwnedJson, [] as string[]);

    doc.fillColor("#0f172a").fontSize(24).text(p.name || "AEVION QBuild Resume");
    if (p.title) doc.fontSize(13).fillColor("#0d9488").text(p.title);
    if (p.verifiedAt) doc.fontSize(10).fillColor("#0284c7").text(`✓ Verified${p.verifiedReason ? ` (${p.verifiedReason})` : ""}`);
    doc.moveDown(0.3);
    const metaLine = [p.city, p.experienceYears ? `${p.experienceYears}y experience` : null, p.buildRole, p.openToWork ? "Open to work" : null,
      p.salaryMin || p.salaryMax ? `${p.salaryMin || "—"}–${p.salaryMax || "—"} ${p.salaryCurrency || "RUB"}` : null].filter(Boolean).join("  ·  ");
    if (metaLine) doc.fontSize(10).fillColor("#334155").text(metaLine);

    const hr = () => { doc.moveDown(0.6); doc.strokeColor("#cbd5e1").moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke(); doc.moveDown(0.6); };
    const heading = (txt: string) => { doc.moveDown(0.4); doc.fillColor("#0f172a").fontSize(13).text(txt); doc.moveDown(0.15); };

    if (p.summary) { hr(); heading("Summary"); doc.fillColor("#0f172a").fontSize(10).text(String(p.summary)); }
    if (skills.length) { hr(); heading("Skills"); doc.fillColor("#0f172a").fontSize(10).text(skills.join(" · ")); }
    if (languages.length) { doc.moveDown(0.3); doc.fillColor("#334155").fontSize(10).text(`Languages: ${languages.join(" · ")}`); }

    const cv: string[] = [];
    if (p.driversLicense) cv.push(`Driver's license: ${p.driversLicense}`);
    if (p.shiftPreference) cv.push(`Shifts: ${p.shiftPreference}`);
    if (p.availabilityType) cv.push(`Availability: ${String(p.availabilityType).replace("_", " ")}`);
    if (p.readyFromDate) cv.push(`Ready from: ${p.readyFromDate}`);
    if (p.medicalCheckValid) cv.push(`Medical check ✓${p.medicalCheckUntil ? ` until ${p.medicalCheckUntil}` : ""}`);
    if (p.safetyTrainingValid) cv.push(`Safety training ✓${p.safetyTrainingUntil ? ` until ${p.safetyTrainingUntil}` : ""}`);
    if (preferredLocations.length) cv.push(`Preferred: ${preferredLocations.join(", ")}`);
    if (cv.length) { hr(); heading("Construction-vertical"); doc.fillColor("#0f172a").fontSize(10).text(cv.join("\n")); }
    if (toolsOwned.length) { doc.moveDown(0.3); doc.fillColor("#334155").fontSize(10).text(`Tools / equipment owned: ${toolsOwned.join(", ")}`); }

    if (expQ.rows.length) {
      hr(); heading("Experience");
      for (const e of expQ.rows) {
        const dateLine = [e.fromDate, e.current ? "present" : e.toDate].filter(Boolean).join(" — ");
        doc.fillColor("#0f172a").fontSize(11).text(`${e.title} — ${e.company}${e.city ? `, ${e.city}` : ""}`);
        if (dateLine) doc.fillColor("#64748b").fontSize(9).text(dateLine);
        if (e.description) doc.fillColor("#334155").fontSize(10).text(e.description, { paragraphGap: 4 });
        doc.moveDown(0.25);
      }
    }
    if (eduQ.rows.length) {
      hr(); heading("Education");
      for (const ed of eduQ.rows) {
        const dl = [ed.fromYear, ed.toYear].filter(Boolean).join(" — ");
        doc.fillColor("#0f172a").fontSize(11).text(ed.institution);
        const second = [ed.degree, ed.field].filter(Boolean).join(", ");
        if (second) doc.fillColor("#334155").fontSize(10).text(second);
        if (dl) doc.fillColor("#64748b").fontSize(9).text(dl);
        doc.moveDown(0.25);
      }
    }
    if (certifications.length) {
      hr(); heading("Certifications & licenses");
      for (const c of certifications) { doc.fillColor("#0f172a").fontSize(10).text([c.name, c.issuer, c.year ? String(c.year) : null].filter(Boolean).join(" · ")); }
    }
    if (achievements.length) {
      hr(); heading("Achievements");
      for (const a of achievements) {
        doc.fillColor("#0f172a").fontSize(10).text(`${a.title}${a.year ? ` (${a.year})` : ""}`);
        if (a.description) doc.fillColor("#334155").fontSize(9).text(a.description);
        doc.moveDown(0.15);
      }
    }
    if (portfolio.length) {
      hr(); heading("Portfolio");
      for (const pf of portfolio) { doc.fillColor("#0f172a").fontSize(10).text(`${pf.label}: ${pf.url}`); }
    }
    if (p.description) { hr(); heading("About"); doc.fillColor("#0f172a").fontSize(10).text(String(p.description), { paragraphGap: 4 }); }

    doc.moveDown(1);
    doc.fillColor("#94a3b8").fontSize(9).text(`Generated by AEVION QBuild — aevion.kz · profile id ${id}`, { align: "center" });
    doc.end();
    const buf = await done;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="aevion-resume-${id.slice(0, 8)}.pdf"`);
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(buf);
  } catch (err: unknown) {
    return fail(res, 500, "resume_pdf_failed", { details: (err as Error).message });
  }
});

// POST /api/build/experiences
profilesRouter.post("/experiences", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const title = vString(req.body?.title, "title", { min: 1, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const company = vString(req.body?.company, "company", { min: 1, max: 200 });
    if (!company.ok) return fail(res, 400, company.error);
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100) || null;
    const fromDate = req.body?.fromDate == null ? null : String(req.body.fromDate).trim().slice(0, 32) || null;
    const toDate = req.body?.toDate == null ? null : String(req.body.toDate).trim().slice(0, 32) || null;
    const current = req.body?.current === true || req.body?.current === "true";
    const description = req.body?.description == null ? null : String(req.body.description).trim().slice(0, 4000) || null;
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildExperience" ("id","userId","title","company","city","fromDate","toDate","current","description")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, auth.sub, title.value, company.value, city, fromDate, current ? null : toDate, current, description],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "experience_create_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/experiences/:id
profilesRouter.patch("/experiences/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildExperience" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "experience_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const sets: string[] = [];
    const vals: unknown[] = [id];
    function push(col: string, val: unknown) { vals.push(val); sets.push(`"${col}" = $${vals.length}`); }
    if (typeof req.body?.title === "string") push("title", req.body.title.trim().slice(0, 200));
    if (typeof req.body?.company === "string") push("company", req.body.company.trim().slice(0, 200));
    if (req.body?.city !== undefined) push("city", req.body.city == null ? null : String(req.body.city).trim().slice(0, 120));
    if (req.body?.fromDate !== undefined) push("fromDate", req.body.fromDate == null ? null : String(req.body.fromDate).trim().slice(0, 32));
    if (req.body?.toDate !== undefined) push("toDate", req.body.toDate == null ? null : String(req.body.toDate).trim().slice(0, 32));
    if (typeof req.body?.current === "boolean") push("current", req.body.current);
    if (req.body?.description !== undefined) push("description", req.body.description == null ? null : String(req.body.description).slice(0, 4000));
    if (sets.length === 0) return ok(res, { id, updated: false });

    const upd = await pool.query(
      `UPDATE "BuildExperience" SET ${sets.join(", ")} WHERE "id" = $1 RETURNING *`,
      vals,
    );
    return ok(res, upd.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "experience_update_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/experiences/:id
profilesRouter.delete("/experiences/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildExperience" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "experience_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    await pool.query(`DELETE FROM "BuildExperience" WHERE "id" = $1`, [id]);
    return ok(res, { id, deleted: true });
  } catch (err: unknown) {
    return fail(res, 500, "experience_delete_failed", { details: (err as Error).message });
  }
});

// POST /api/build/education
profilesRouter.post("/education", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const institution = vString(req.body?.institution, "institution", { min: 1, max: 200 });
    if (!institution.ok) return fail(res, 400, institution.error);
    const degree = req.body?.degree == null ? null : String(req.body.degree).trim().slice(0, 100) || null;
    const field = req.body?.field == null ? null : String(req.body.field).trim().slice(0, 200) || null;
    const fromYear = req.body?.fromYear == null ? null : Math.round(Number(req.body.fromYear));
    const toYear = req.body?.toYear == null ? null : Math.round(Number(req.body.toYear));
    if (fromYear != null && (!Number.isFinite(fromYear) || fromYear < 1900 || fromYear > 2100)) return fail(res, 400, "fromYear_invalid");
    if (toYear != null && (!Number.isFinite(toYear) || toYear < 1900 || toYear > 2100)) return fail(res, 400, "toYear_invalid");
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildEducation" ("id","userId","institution","degree","field","fromYear","toYear")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, auth.sub, institution.value, degree, field, fromYear, toYear],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "education_create_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/education/:id
profilesRouter.delete("/education/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildEducation" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "education_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    await pool.query(`DELETE FROM "BuildEducation" WHERE "id" = $1`, [id]);
    return ok(res, { id, deleted: true });
  } catch (err: unknown) {
    return fail(res, 500, "education_delete_failed", { details: (err as Error).message });
  }
});
