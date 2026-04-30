import { Router } from "express";
import crypto from "crypto";
import {
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
  vEnum,
  ensureBuildTables,
  buildPool as pool,
  PROJECT_STATUSES,
  VACANCY_STATUSES,
  APPLICATION_STATUSES,
  BUILD_ROLES,
  SHIFT_PREFERENCES,
  AVAILABILITY_TYPES,
  PLAN_KEYS,
  BOOKMARK_KINDS,
  safeParseJson,
  getUserPlan,
  ensureUsageRow,
  bumpUsage,
  currentMonthKey,
  isUnlimited,
} from "../lib/build";

export const buildRouter = Router();

// Bootstrap tables on first request, then short-circuit on the cached flag.
buildRouter.use(async (_req, res, next) => {
  try {
    await ensureBuildTables();
    next();
  } catch (err: unknown) {
    console.error("[build] ensureBuildTables failed:", err);
    fail(res, 500, "build_init_failed");
  }
});

// ──────────────────────────────────────────────────────────────────────
// Users / Profile
// ──────────────────────────────────────────────────────────────────────

// GET /api/build/users/me — current user + build profile (if any)
buildRouter.get("/users/me", async (req, res) => {
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

    return ok(res, {
      user: u.rows[0],
      profile,
    });
  } catch (err: unknown) {
    return fail(res, 500, "users_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/profiles — upsert own build profile
buildRouter.post("/profiles", async (req, res) => {
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
    // ADMIN cannot be self-assigned via API.
    if (role.value === "ADMIN" && auth.role !== "ADMIN") {
      return fail(res, 403, "admin_role_not_self_assignable");
    }

    // Resume-style fields (all optional).
    const title = req.body?.title == null
      ? null
      : (vString(req.body.title, "title", { max: 200, allowEmpty: true }).ok
          ? String(req.body.title).trim() || null
          : null);
    const summary = req.body?.summary == null
      ? null
      : (vString(req.body.summary, "summary", { max: 4000, allowEmpty: true }).ok
          ? String(req.body.summary).trim() || null
          : null);
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
      ? req.body.salaryCurrency.trim().slice(0, 8) || "RUB"
      : "RUB";
    const availability = req.body?.availability == null
      ? null
      : String(req.body.availability).trim().slice(0, 100) || null;
    const experienceYears = req.body?.experienceYears == null
      ? 0
      : Math.max(0, Math.min(80, Math.round(Number(req.body.experienceYears) || 0)));
    const photoUrl = req.body?.photoUrl == null
      ? null
      : String(req.body.photoUrl).trim().slice(0, 2000) || null;
    const openToWork = req.body?.openToWork === true || req.body?.openToWork === "true";

    // Resume v2 — construction-vertical fields. All optional.
    const arrField = (raw: unknown, max = 30, maxLen = 200): string[] =>
      Array.isArray(raw)
        ? raw
            .map((s) => String(s).trim())
            .filter((s) => s.length > 0 && s.length <= maxLen)
            .slice(0, max)
        : [];
    const objArrField = (raw: unknown, max = 30): unknown[] =>
      Array.isArray(raw) ? raw.slice(0, max) : [];

    const certifications = objArrField(req.body?.certifications, 20); // [{name, issuer, year, credentialUrl?}]
    const portfolio = objArrField(req.body?.portfolio, 20); // [{label, url}]
    const achievements = objArrField(req.body?.achievements, 20); // [{title, description?, year?}]
    const driversLicense = req.body?.driversLicense == null
      ? null
      : String(req.body.driversLicense).trim().slice(0, 32) || null;
    const shiftPreference =
      typeof req.body?.shiftPreference === "string" && (SHIFT_PREFERENCES as readonly string[]).includes(req.body.shiftPreference)
        ? (req.body.shiftPreference as typeof SHIFT_PREFERENCES[number])
        : null;
    const availabilityType =
      typeof req.body?.availabilityType === "string" &&
      (AVAILABILITY_TYPES as readonly string[]).includes(req.body.availabilityType)
        ? (req.body.availabilityType as typeof AVAILABILITY_TYPES[number])
        : null;
    const readyFromDate = req.body?.readyFromDate == null
      ? null
      : String(req.body.readyFromDate).trim().slice(0, 32) || null;
    const preferredLocations = arrField(req.body?.preferredLocations, 20, 100);
    const toolsOwned = arrField(req.body?.toolsOwned, 50, 80);
    const medicalCheckValid = req.body?.medicalCheckValid === true || req.body?.medicalCheckValid === "true";
    const medicalCheckUntil = req.body?.medicalCheckUntil == null
      ? null
      : String(req.body.medicalCheckUntil).trim().slice(0, 32) || null;
    const safetyTrainingValid = req.body?.safetyTrainingValid === true || req.body?.safetyTrainingValid === "true";
    const safetyTrainingUntil = req.body?.safetyTrainingUntil == null
      ? null
      : String(req.body.safetyTrainingUntil).trim().slice(0, 32) || null;

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
          "safetyTrainingValid","safetyTrainingUntil")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       ON CONFLICT ("userId") DO UPDATE SET
         "name" = EXCLUDED."name",
         "phone" = EXCLUDED."phone",
         "city" = EXCLUDED."city",
         "description" = EXCLUDED."description",
         "buildRole" = EXCLUDED."buildRole",
         "title" = EXCLUDED."title",
         "summary" = EXCLUDED."summary",
         "skillsJson" = EXCLUDED."skillsJson",
         "languagesJson" = EXCLUDED."languagesJson",
         "salaryMin" = EXCLUDED."salaryMin",
         "salaryMax" = EXCLUDED."salaryMax",
         "salaryCurrency" = EXCLUDED."salaryCurrency",
         "availability" = EXCLUDED."availability",
         "experienceYears" = EXCLUDED."experienceYears",
         "photoUrl" = EXCLUDED."photoUrl",
         "openToWork" = EXCLUDED."openToWork",
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
         "updatedAt" = NOW()
       RETURNING *`,
      [
        id,
        auth.sub,
        name.value,
        phone.value || null,
        city.value || null,
        description.value || null,
        role.value,
        title,
        summary,
        JSON.stringify(skills),
        JSON.stringify(languages),
        salaryMin != null ? Math.round(salaryMin) : null,
        salaryMax != null ? Math.round(salaryMax) : null,
        salaryCurrency,
        availability,
        experienceYears,
        photoUrl,
        openToWork,
        JSON.stringify(certifications),
        JSON.stringify(portfolio),
        JSON.stringify(achievements),
        driversLicense,
        shiftPreference,
        availabilityType,
        readyFromDate,
        JSON.stringify(preferredLocations),
        JSON.stringify(toolsOwned),
        medicalCheckValid,
        medicalCheckUntil,
        safetyTrainingValid,
        safetyTrainingUntil,
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

// GET /api/build/profiles/:id — public profile by userId
// Returns full resume bundle: profile + experiences + education.
// Email is included but no phone — phone stays internal until user
// explicitly shares contact via DM.
buildRouter.get("/profiles/:id", async (req, res) => {
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
       WHERE p."userId" = $1
       LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");

    const [exp, edu] = await Promise.all([
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
    });
  } catch (err: unknown) {
    return fail(res, 500, "profile_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/search — recruiter-facing talent search
//   Auth gate: any signed-in user can search (plan-based limits enforced
//   later when billing wiring lands). Anonymous gets 401 so we can
//   tighten plan limits without a public escape hatch.
//   Query: ?q= title/summary/description, ?skill= comma-separated AND,
//          ?city=, ?role= CLIENT/CONTRACTOR/WORKER, ?minExp= years,
//          ?openToWork=1 (default = include only openToWork=true if set),
//          ?limit= 1..50 (default 30)
//   Returns sanitized profile rows (no email, no phone).
buildRouter.get("/profiles/search", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    // Talent-search rate limit per month.
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
      // Count this call. Failed downstream errors still count, which
      // is intentional — an unbounded retry loop would otherwise drain
      // somebody else's quota by accident.
      await bumpUsage(auth.sub, "talentSearches");
    }

    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof req.query.q === "string" && req.query.q.trim()) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(
        `(p."name" ILIKE $${params.length} OR p."title" ILIKE $${params.length} OR p."summary" ILIKE $${params.length} OR p."description" ILIKE $${params.length})`,
      );
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
    // skill= comma-separated → all-required match against skillsJson
    // (case-insensitive substring on the JSON-encoded text — no need
    // for a separate join table at this scale).
    if (typeof req.query.skill === "string" && req.query.skill.trim()) {
      const skills = req.query.skill
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 60)
        .slice(0, 10);
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
              p."openToWork", p."verifiedAt", p."updatedAt"
       FROM "BuildProfile" p
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY p."openToWork" DESC, p."updatedAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      skills: safeParseJson(r.skillsJson, [] as string[]),
      languages: safeParseJson(r.languagesJson, [] as string[]),
    }));
    return ok(res, { items, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "profiles_search_failed", { details: (err as Error).message });
  }
});

// POST /api/build/profiles/:id/verify — admin-only mark as verified
//   Body: { reason: "kyc-docs" | "qsign-signed-license" | string }
//   Plays the role of "Verified Employer" / "Verified Worker" badge.
//   Once we wire QSign signing of legal docs, this becomes the call
//   that runs after a successful signature check.
buildRouter.post("/profiles/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const id = String(req.params.id);
    const reason = req.body?.reason == null
      ? null
      : String(req.body.reason).trim().slice(0, 200) || null;

    const result = await pool.query(
      `UPDATE "BuildProfile"
         SET "verifiedAt" = NOW(), "verifiedReason" = $2, "updatedAt" = NOW()
       WHERE "userId" = $1 RETURNING *`,
      [id, reason],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "profile_verify_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/profiles/:id/verify — admin-only revoke verification
buildRouter.delete("/profiles/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const id = String(req.params.id);
    const result = await pool.query(
      `UPDATE "BuildProfile"
         SET "verifiedAt" = NULL, "verifiedReason" = NULL, "updatedAt" = NOW()
       WHERE "userId" = $1 RETURNING *`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "profile_unverify_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/:id/resume.pdf — public, downloadable PDF.
// Renders the AEVION Resume Schema v2 into a clean A4 sheet via pdfkit.
// Strips PII the same way /profiles/:id does (no email, no phone) so a
// recruiter can save & forward a candidate's resume without leaking
// contact info that's only meant to surface inside DMs.
buildRouter.get("/profiles/:id/resume.pdf", async (req, res) => {
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
    ]);

    // pdfkit is already a backend dep (pulled in by QSign / QRight).
    // Methods return the doc for chaining; we just want side effects.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFDocument = ((await import("pdfkit")) as any).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c?: Buffer) => {
      if (c) chunks.push(c);
    });
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const skills = safeParseJson(p.skillsJson, [] as string[]);
    const languages = safeParseJson(p.languagesJson, [] as string[]);
    const certifications = safeParseJson(p.certificationsJson, [] as Array<{ name?: string; issuer?: string; year?: number }>);
    const portfolio = safeParseJson(p.portfolioJson, [] as Array<{ label?: string; url?: string }>);
    const achievements = safeParseJson(p.achievementsJson, [] as Array<{ title?: string; description?: string; year?: number }>);
    const preferredLocations = safeParseJson(p.preferredLocationsJson, [] as string[]);
    const toolsOwned = safeParseJson(p.toolsOwnedJson, [] as string[]);

    // Header
    doc.fillColor("#0f172a").fontSize(24).text(p.name || "AEVION QBuild Resume", { continued: false });
    if (p.title) doc.fontSize(13).fillColor("#0d9488").text(p.title);
    if (p.verifiedAt) {
      doc.fontSize(10).fillColor("#0284c7").text(`✓ Verified${p.verifiedReason ? ` (${p.verifiedReason})` : ""}`);
    }
    doc.moveDown(0.3);
    const metaLine = [
      p.city,
      p.experienceYears ? `${p.experienceYears}y experience` : null,
      p.buildRole,
      p.openToWork ? "Open to work" : null,
      p.salaryMin || p.salaryMax
        ? `${p.salaryMin || "—"}–${p.salaryMax || "—"} ${p.salaryCurrency || "RUB"}`
        : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (metaLine) doc.fontSize(10).fillColor("#334155").text(metaLine);

    const hr = () => {
      doc.moveDown(0.6);
      doc
        .strokeColor("#cbd5e1")
        .moveTo(48, doc.y)
        .lineTo(doc.page.width - 48, doc.y)
        .stroke();
      doc.moveDown(0.6);
    };

    const heading = (txt: string) => {
      doc.moveDown(0.4);
      doc.fillColor("#0f172a").fontSize(13).text(txt, { underline: false });
      doc.moveDown(0.15);
    };

    if (p.summary) {
      hr();
      heading("Summary");
      doc.fillColor("#0f172a").fontSize(10).text(String(p.summary), { align: "left" });
    }

    if (skills.length) {
      hr();
      heading("Skills");
      doc.fillColor("#0f172a").fontSize(10).text(skills.join(" · "));
    }
    if (languages.length) {
      doc.moveDown(0.3);
      doc.fillColor("#334155").fontSize(10).text(`Languages: ${languages.join(" · ")}`);
    }

    // Construction-vertical signals
    const cv: string[] = [];
    if (p.driversLicense) cv.push(`Driver's license: ${p.driversLicense}`);
    if (p.shiftPreference) cv.push(`Shifts: ${p.shiftPreference}`);
    if (p.availabilityType) cv.push(`Availability: ${String(p.availabilityType).replace("_", " ")}`);
    if (p.readyFromDate) cv.push(`Ready from: ${p.readyFromDate}`);
    if (p.medicalCheckValid) cv.push(`Medical check ✓${p.medicalCheckUntil ? ` until ${p.medicalCheckUntil}` : ""}`);
    if (p.safetyTrainingValid) cv.push(`Safety training ✓${p.safetyTrainingUntil ? ` until ${p.safetyTrainingUntil}` : ""}`);
    if (preferredLocations.length) cv.push(`Preferred: ${preferredLocations.join(", ")}`);
    if (cv.length) {
      hr();
      heading("Construction-vertical");
      doc.fillColor("#0f172a").fontSize(10).text(cv.join("\n"));
    }
    if (toolsOwned.length) {
      doc.moveDown(0.3);
      doc.fillColor("#334155").fontSize(10).text(`Tools / equipment owned: ${toolsOwned.join(", ")}`);
    }

    if (expQ.rows.length) {
      hr();
      heading("Experience");
      for (const e of expQ.rows) {
        const dateLine = [e.fromDate, e.current ? "present" : e.toDate].filter(Boolean).join(" — ");
        doc.fillColor("#0f172a").fontSize(11).text(`${e.title} — ${e.company}${e.city ? `, ${e.city}` : ""}`);
        if (dateLine) doc.fillColor("#64748b").fontSize(9).text(dateLine);
        if (e.description) doc.fillColor("#334155").fontSize(10).text(e.description, { paragraphGap: 4 });
        doc.moveDown(0.25);
      }
    }

    if (eduQ.rows.length) {
      hr();
      heading("Education");
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
      hr();
      heading("Certifications & licenses");
      for (const c of certifications) {
        const line = [c.name, c.issuer, c.year ? String(c.year) : null].filter(Boolean).join(" · ");
        doc.fillColor("#0f172a").fontSize(10).text(line);
      }
    }

    if (achievements.length) {
      hr();
      heading("Achievements");
      for (const a of achievements) {
        doc.fillColor("#0f172a").fontSize(10).text(`${a.title}${a.year ? ` (${a.year})` : ""}`);
        if (a.description) doc.fillColor("#334155").fontSize(9).text(a.description);
        doc.moveDown(0.15);
      }
    }

    if (portfolio.length) {
      hr();
      heading("Portfolio");
      for (const pf of portfolio) {
        doc.fillColor("#0f172a").fontSize(10).text(`${pf.label}: ${pf.url}`);
      }
    }

    if (p.description) {
      hr();
      heading("About");
      doc.fillColor("#0f172a").fontSize(10).text(String(p.description), { paragraphGap: 4 });
    }

    // Footer
    doc.moveDown(1);
    doc.fillColor("#94a3b8").fontSize(9).text(`Generated by AEVION QBuild — aevion.kz · profile id ${id}`, {
      align: "center",
    });

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

// ── Experience CRUD ──────────────────────────────────────────────────

// POST /api/build/experiences — add an experience entry
buildRouter.post("/experiences", async (req, res) => {
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
    const description = req.body?.description == null
      ? null
      : String(req.body.description).trim().slice(0, 4000) || null;

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

// DELETE /api/build/experiences/:id — owner only
buildRouter.delete("/experiences/:id", async (req, res) => {
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

// ── Education CRUD ───────────────────────────────────────────────────

// POST /api/build/education — add an education entry
buildRouter.post("/education", async (req, res) => {
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

// DELETE /api/build/education/:id — owner only
buildRouter.delete("/education/:id", async (req, res) => {
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

// ──────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/projects
buildRouter.post("/projects", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);

    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);

    const budget = req.body?.budget == null
      ? { ok: true as const, value: 0 }
      : vNumber(req.body.budget, "budget", { min: 0, max: 1e12 });
    if (budget.ok === false) return fail(res, 400, budget.error);

    const city = req.body?.city == null
      ? { ok: true as const, value: null }
      : vString(req.body.city, "city", { max: 100, allowEmpty: true });
    if (city.ok === false) return fail(res, 400, city.error);

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildProject" ("id","title","description","budget","status","city","clientId")
       VALUES ($1,$2,$3,$4,'OPEN',$5,$6)
       RETURNING *`,
      [id, title.value, description.value, budget.value, city.value || null, auth.sub],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "project_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects?status=&q=&limit=&mine=1
buildRouter.get("/projects", async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;
    const mine = req.query.mine === "1" || req.query.mine === "true";

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status) {
      const e = vEnum(status, "status", PROJECT_STATUSES);
      if (!e.ok) return fail(res, 400, e.error);
      params.push(e.value);
      conds.push(`"status" = $${params.length}`);
    }
    if (q.length >= 2) {
      params.push(`%${q}%`);
      conds.push(`("title" ILIKE $${params.length} OR "description" ILIKE $${params.length})`);
    }
    if (mine) {
      const auth = requireBuildAuth(req, res);
      if (!auth) return;
      params.push(auth.sub);
      conds.push(`"clientId" = $${params.length}`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM "BuildVacancy" v WHERE v."projectId" = p."id")::int AS "vacancyCount"
       FROM "BuildProject" p
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "projects_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id — project + vacancies + files
buildRouter.get("/projects/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await pool.query(`SELECT * FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [id]);
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");

    const [vacancies, files, client] = await Promise.all([
      pool.query(
        `SELECT * FROM "BuildVacancy" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT "id","url","name","mimeType","sizeBytes","createdAt"
         FROM "BuildFile" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT u."id", u."email", u."name", p."city", p."buildRole"
         FROM "AEVIONUser" u
         LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
         WHERE u."id" = $1 LIMIT 1`,
        [project.rows[0].clientId],
      ),
    ]);

    return ok(res, {
      project: project.rows[0],
      vacancies: vacancies.rows,
      files: files.rows,
      client: client.rows[0] || null,
    });
  } catch (err: unknown) {
    return fail(res, 500, "project_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id/public — read-only, PII-stripped, cacheable
// Public sharable view for /build/p/[id] SSR. Hides email/phone, keeps name/city.
buildRouter.get("/projects/:id/public", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await pool.query(
      `SELECT "id","title","description","budget","status","city","clientId","createdAt","updatedAt"
       FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");

    const [vacancies, files, client] = await Promise.all([
      pool.query(
        `SELECT v."id", v."title", v."description", v."salary", v."status", v."createdAt",
                (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount"
         FROM "BuildVacancy" v
         WHERE v."projectId" = $1
         ORDER BY v."createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT "id","url","name","mimeType","sizeBytes","createdAt"
         FROM "BuildFile" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT u."name", p."city", p."buildRole", p."verifiedAt"
         FROM "AEVIONUser" u
         LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
         WHERE u."id" = $1 LIMIT 1`,
        [project.rows[0].clientId],
      ),
    ]);

    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, {
      project: project.rows[0],
      vacancies: vacancies.rows,
      files: files.rows,
      client: client.rows[0] || null,
    });
  } catch (err: unknown) {
    return fail(res, 500, "project_public_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/projects/:id — owner-only
buildRouter.patch("/projects/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const existing = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (existing.rowCount === 0) return fail(res, 404, "project_not_found");
    if (existing.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "not_owner");
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (req.body?.title !== undefined) {
      const v = vString(req.body.title, "title", { min: 3, max: 200 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"title" = $${params.length}`);
    }
    if (req.body?.description !== undefined) {
      const v = vString(req.body.description, "description", { min: 10, max: 10_000 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"description" = $${params.length}`);
    }
    if (req.body?.budget !== undefined) {
      const v = vNumber(req.body.budget, "budget", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"budget" = $${params.length}`);
    }
    if (req.body?.status !== undefined) {
      const v = vEnum(req.body.status, "status", PROJECT_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"status" = $${params.length}`);
    }
    if (req.body?.city !== undefined) {
      const v = vString(req.body.city, "city", { max: 100, allowEmpty: true });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value || null);
      sets.push(`"city" = $${params.length}`);
    }
    if (sets.length === 0) return fail(res, 400, "no_fields_to_update");

    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await pool.query(
      `UPDATE "BuildProject" SET ${sets.join(", ")} WHERE "id" = $${params.length} RETURNING *`,
      params,
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "project_update_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Vacancies
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/vacancies — only project owner can create
buildRouter.post("/vacancies", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const projectId = vString(req.body?.projectId, "projectId", { min: 1, max: 200 });
    if (!projectId.ok) return fail(res, 400, projectId.error);

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);

    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);

    const salary = req.body?.salary == null
      ? { ok: true as const, value: 0 }
      : vNumber(req.body.salary, "salary", { min: 0, max: 1e12 });
    if (salary.ok === false) return fail(res, 400, salary.error);

    const project = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [projectId.value],
    );
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");
    if (project.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_post_vacancies");
    }

    // Plan-based vacancy slot limit. Counts OPEN vacancies across all
    // projects owned by the same user. Admins are exempt.
    if (auth.role !== "ADMIN") {
      const plan = await getUserPlan(auth.sub);
      if (!isUnlimited(plan.vacancySlots)) {
        const active = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM "BuildVacancy" v
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND v."status" = 'OPEN'`,
          [auth.sub],
        );
        const used = active.rows[0]?.c ?? 0;
        if (used >= plan.vacancySlots) {
          return fail(res, 403, "plan_vacancy_limit_reached", {
            planKey: plan.key,
            limit: plan.vacancySlots,
            used,
            upgradeUrl: "/build/pricing",
          });
        }
      }
    }

    const skills = Array.isArray(req.body?.skills)
      ? req.body.skills
          .map((s: unknown) => String(s).trim())
          .filter((s: string) => s.length > 0 && s.length <= 60)
          .slice(0, 30)
      : [];
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100) || null;
    const salaryCurrency = typeof req.body?.salaryCurrency === "string"
      ? req.body.salaryCurrency.trim().slice(0, 8) || "RUB"
      : "RUB";

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildVacancy" ("id","projectId","title","description","salary","skillsJson","city","salaryCurrency")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        id,
        projectId.value,
        title.value,
        description.value,
        salary.value,
        JSON.stringify(skills),
        city,
        salaryCurrency,
      ],
    );
    const row = result.rows[0];
    return ok(res, { ...row, skills: safeParseJson(row.skillsJson, [] as string[]) }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies — cross-project feed with filters
// Query: ?status=OPEN|CLOSED · ?q=text · ?city=Almaty · ?minSalary=N
//        ?projectStatus=OPEN|IN_PROGRESS|DONE · ?limit=1..100 (default 50)
// Public (no auth). Joins project for title/city/status badges.
buildRouter.get("/vacancies", async (req, res) => {
  try {
    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof req.query.status === "string") {
      const v = vEnum(req.query.status, "status", VACANCY_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      where.push(`v."status" = $${params.length}`);
    }
    if (typeof req.query.projectStatus === "string") {
      const v = vEnum(req.query.projectStatus, "projectStatus", PROJECT_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      where.push(`p."status" = $${params.length}`);
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(`(v."title" ILIKE $${params.length} OR v."description" ILIKE $${params.length})`);
    }
    if (typeof req.query.city === "string" && req.query.city.trim()) {
      params.push(req.query.city.trim());
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (req.query.minSalary !== undefined) {
      const v = vNumber(req.query.minSalary, "minSalary", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      where.push(`v."salary" >= $${params.length}`);
    }

    const limitRaw = req.query.limit !== undefined ? vNumber(req.query.limit, "limit", { min: 1, max: 100 }) : { ok: true as const, value: 50 };
    if (limitRaw.ok === false) return fail(res, 400, limitRaw.error);
    params.push(limitRaw.value);

    const result = await pool.query(
      `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."status", v."createdAt",
              p."title" AS "projectTitle", p."status" AS "projectStatus", p."city" AS "projectCity", p."clientId",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount",
              (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY (
         (SELECT MAX(b2."endsAt") FROM "BuildBoost" b2 WHERE b2."vacancyId" = v."id" AND b2."endsAt" > NOW())
       ) DESC NULLS LAST,
       v."createdAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_feed_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/by-project/:id
buildRouter.get("/vacancies/by-project/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT v.*,
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount",
              (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
       FROM "BuildVacancy" v
       WHERE v."projectId" = $1
       ORDER BY v."createdAt" DESC`,
      [id],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id — vacancy detail + project link
buildRouter.get("/vacancies/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT v.*, p."title" AS "projectTitle", p."status" AS "projectStatus", p."clientId",
              (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1
       LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    const row = result.rows[0];
    return ok(res, { ...row, skills: safeParseJson(row.skillsJson, [] as string[]) });
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id/match-candidates — recruiter-facing
// "who in the talent pool fits this vacancy?". Mirror of forward match
// on applications. Owner-only. Returns top 20 candidates by skill-
// coverage, ranked openToWork DESC then matchScore DESC.
buildRouter.get("/vacancies/:id/match-candidates", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const owner = await pool.query(
      `SELECT v."skillsJson", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_match");
    }

    const required = safeParseJson(owner.rows[0].skillsJson, [] as string[]).map((s) =>
      s.toLowerCase(),
    );
    if (required.length === 0) {
      return ok(res, { items: [], total: 0, requiredSkills: [], note: "vacancy_has_no_required_skills" });
    }

    // Pull a candidate pool — keep ordering by openToWork+updatedAt so
    // freshest active candidates surface first. Don't include the
    // vacancy owner themselves.
    const pool_ = await pool.query(
      `SELECT p."userId", p."name", p."city", p."buildRole",
              p."title", p."summary", p."skillsJson", p."languagesJson",
              p."salaryMin", p."salaryMax", p."salaryCurrency",
              p."availability", p."experienceYears", p."photoUrl",
              p."openToWork", p."verifiedAt", p."updatedAt"
       FROM "BuildProfile" p
       WHERE p."userId" <> $1
       ORDER BY p."openToWork" DESC, p."updatedAt" DESC
       LIMIT 200`,
      [auth.sub],
    );

    type Row = {
      skillsJson: string;
      languagesJson: string;
      openToWork: boolean;
      [k: string]: unknown;
    };
    const requiredSet = new Set(required);
    const ranked = (pool_.rows as Row[])
      .map((row) => {
        const candSkills = safeParseJson(row.skillsJson, [] as string[]);
        const candSet = new Set(candSkills.map((s) => s.toLowerCase()));
        const matched = required.filter((s) => candSet.has(s));
        const score = required.length === 0 ? 0 : Math.round((matched.length / required.length) * 100);
        return {
          ...row,
          skills: candSkills,
          languages: safeParseJson(row.languagesJson, [] as string[]),
          matchScore: score,
          matchedSkills: candSkills.filter((s) => requiredSet.has(s.toLowerCase())),
        };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => {
        if (a.openToWork !== b.openToWork) return a.openToWork ? -1 : 1;
        return b.matchScore - a.matchScore;
      })
      .slice(0, 20);

    return ok(res, { items: ranked, total: ranked.length, requiredSkills: required });
  } catch (err: unknown) {
    return fail(res, 500, "match_candidates_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/boost — feature a vacancy at the top of
// the feed for N days (default 7). Pricing tiers determine cost:
//   - if plan.boostsPerMonth > 0 (PRO/AGENCY) and usage.boostsUsed < plan.boostsPerMonth
//     → free, increments boostsUsed.
//   - otherwise → creates a PENDING BOOST order at 990 ₽ × days/7.
// Caller must own the vacancy's parent project (or be ADMIN).
buildRouter.post("/vacancies/:id/boost", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const days = req.body?.days != null
      ? Math.max(1, Math.min(30, Math.round(Number(req.body.days) || 7)))
      : 7;

    const row = await pool.query(
      `SELECT v."id", v."projectId", v."status", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_boost");
    }
    if (row.rows[0].status !== "OPEN") {
      return fail(res, 400, "boost_requires_open_vacancy");
    }

    const plan = await getUserPlan(auth.sub);
    const usage = await ensureUsageRow(auth.sub);
    const planAllows = !isUnlimited(plan.boostsPerMonth)
      ? usage.boostsUsed < plan.boostsPerMonth
      : true;
    const wantPaid = req.body?.paid === true; // explicit override

    const boostId = crypto.randomUUID();
    const endsAt = new Date(Date.now() + days * 24 * 3600 * 1000);

    await pool.query("BEGIN");
    try {
      let orderId: string | null = null;
      let source: "PLAN" | "PAID" = "PLAN";

      if (planAllows && !wantPaid) {
        // Plan-included boost — count it.
        await bumpUsage(auth.sub, "boostsUsed");
      } else {
        // Out-of-plan or explicitly paid — record a PENDING order.
        source = "PAID";
        orderId = crypto.randomUUID();
        const amount = 990 * Math.ceil(days / 7);
        await pool.query(
          `INSERT INTO "BuildOrder" ("id","userId","kind","ref","amount","currency","status","metaJson")
           VALUES ($1,$2,'BOOST',$3,$4,'RUB','PENDING',$5)`,
          [
            orderId,
            auth.sub,
            boostId,
            amount,
            JSON.stringify({ vacancyId: id, days }),
          ],
        );
      }

      const ins = await pool.query(
        `INSERT INTO "BuildBoost" ("id","vacancyId","userId","endsAt","source","orderId")
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [boostId, id, auth.sub, endsAt.toISOString(), source, orderId],
      );

      await pool.query("COMMIT");
      return ok(res, { boost: ins.rows[0], orderId, source }, 201);
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "boost_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/vacancies/:id — toggle status (project owner or admin)
buildRouter.patch("/vacancies/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const status = vEnum(req.body?.status, "status", VACANCY_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);

    const row = await pool.query(
      `SELECT v."id", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_update_vacancy");
    }

    const result = await pool.query(
      `UPDATE "BuildVacancy" SET "status" = $1 WHERE "id" = $2 RETURNING *`,
      [status.value, id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_update_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Applications
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/applications — apply to vacancy
buildRouter.post("/applications", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const vacancyId = vString(req.body?.vacancyId, "vacancyId", { min: 1, max: 200 });
    if (!vacancyId.ok) return fail(res, 400, vacancyId.error);

    const message = req.body?.message == null
      ? { ok: true as const, value: null }
      : vString(req.body.message, "message", { max: 4000, allowEmpty: true });
    if (message.ok === false) return fail(res, 400, message.error);

    const vacancy = await pool.query(
      `SELECT v."id", v."status" AS "vacancyStatus", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [vacancyId.value],
    );
    if (vacancy.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (vacancy.rows[0].vacancyStatus === "CLOSED") return fail(res, 409, "vacancy_closed");
    if (vacancy.rows[0].clientId === auth.sub) {
      return fail(res, 400, "cannot_apply_to_own_vacancy");
    }

    const id = crypto.randomUUID();
    try {
      const result = await pool.query(
        `INSERT INTO "BuildApplication" ("id","vacancyId","userId","message")
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [id, vacancyId.value, auth.sub, message.value || null],
      );
      return ok(res, result.rows[0], 201);
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "23505") return fail(res, 409, "already_applied");
      throw err;
    }
  } catch (err: unknown) {
    return fail(res, 500, "application_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/applications/my — my applications across vacancies
buildRouter.get("/applications/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const result = await pool.query(
      `SELECT a.*, v."title" AS "vacancyTitle", v."salary", p."id" AS "projectId", p."title" AS "projectTitle"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."userId" = $1
       ORDER BY a."createdAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "applications_my_failed", { details: (err as Error).message });
  }
});

// GET /api/build/applications/by-vacancy/:id — owner-only
buildRouter.get("/applications/by-vacancy/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const owner = await pool.query(
      `SELECT p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_list");
    }

    // Pull vacancy skills + applications + each applicant's profile in
    // one round-trip, then compute Jaccard skill overlap in JS.
    const [vacancy, result] = await Promise.all([
      pool.query(
        `SELECT v."skillsJson", v."title" FROM "BuildVacancy" v WHERE v."id" = $1 LIMIT 1`,
        [id],
      ),
      pool.query(
        `SELECT a.*, u."email", u."name" AS "applicantName",
                bp."city" AS "applicantCity",
                bp."skillsJson" AS "applicantSkillsJson",
                bp."title" AS "applicantHeadline",
                bp."experienceYears" AS "applicantExperienceYears"
         FROM "BuildApplication" a
         LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
         LEFT JOIN "BuildProfile" bp ON bp."userId" = a."userId"
         WHERE a."vacancyId" = $1
         ORDER BY a."createdAt" DESC`,
        [id],
      ),
    ]);

    const vSkills = new Set(
      safeParseJson(vacancy.rows[0]?.skillsJson, [] as string[]).map((s) => s.toLowerCase()),
    );

    const items = result.rows.map((row: Record<string, unknown>) => {
      const aSkillsArr = safeParseJson(row.applicantSkillsJson, [] as string[]);
      const aSkills = new Set(aSkillsArr.map((s) => s.toLowerCase()));
      let matchScore: number | null = null;
      let matchedSkills: string[] = [];
      if (vSkills.size > 0) {
        matchedSkills = aSkillsArr.filter((s) => vSkills.has(s.toLowerCase()));
        // Asymmetric coverage — what fraction of vacancy-required skills
        // does the candidate have. Friendlier than Jaccard for hiring
        // (extra candidate skills are good, not penalized).
        matchScore = Math.round((matchedSkills.length / vSkills.size) * 100);
      }
      return {
        ...row,
        applicantSkills: aSkillsArr,
        matchScore,
        matchedSkills,
      };
    });

    // Sort: highest match first, then newest. NULL match goes after numbers.
    items.sort((a: { matchScore: number | null }, b: { matchScore: number | null }) => {
      if (a.matchScore == null && b.matchScore == null) return 0;
      if (a.matchScore == null) return 1;
      if (b.matchScore == null) return -1;
      return b.matchScore - a.matchScore;
    });

    return ok(res, { items, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "applications_by_vacancy_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/applications/:id — owner of vacancy can ACCEPT/REJECT
buildRouter.patch("/applications/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const status = vEnum(req.body?.status, "status", APPLICATION_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);

    const row = await pool.query(
      `SELECT a."id", a."userId", p."clientId"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "application_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_update");
    }

    const result = await pool.query(
      `UPDATE "BuildApplication"
       SET "status" = $1, "updatedAt" = NOW()
       WHERE "id" = $2
       RETURNING *`,
      [status.value, id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "application_update_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Messaging
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/messages — send DM
buildRouter.post("/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const receiverId = vString(req.body?.receiverId, "receiverId", { min: 1, max: 200 });
    if (!receiverId.ok) return fail(res, 400, receiverId.error);
    if (receiverId.value === auth.sub) return fail(res, 400, "cannot_message_self");

    const content = vString(req.body?.content, "content", { min: 1, max: 4000 });
    if (!content.ok) return fail(res, 400, content.error);

    const recv = await pool.query(`SELECT "id" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`, [receiverId.value]);
    if (recv.rowCount === 0) return fail(res, 404, "receiver_not_found");

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildMessage" ("id","senderId","receiverId","content")
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [id, auth.sub, receiverId.value, content.value],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "message_send_failed", { details: (err as Error).message });
  }
});

// GET /api/build/messages/:userId — full thread between current user and :userId
buildRouter.get("/messages/:userId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const peerId = String(req.params.userId);
    if (peerId === auth.sub) return fail(res, 400, "cannot_thread_with_self");

    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const result = await pool.query(
      `SELECT * FROM "BuildMessage"
       WHERE ("senderId" = $1 AND "receiverId" = $2)
          OR ("senderId" = $2 AND "receiverId" = $1)
       ORDER BY "createdAt" ASC
       LIMIT $3`,
      [auth.sub, peerId, limit],
    );

    // Best-effort mark-as-read for inbound messages from peer.
    pool
      .query(
        `UPDATE "BuildMessage" SET "readAt" = NOW()
         WHERE "receiverId" = $1 AND "senderId" = $2 AND "readAt" IS NULL`,
        [auth.sub, peerId],
      )
      .catch((err: Error) => {
        console.warn("[build] mark-read failed:", err.message);
      });

    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "messages_thread_failed", { details: (err as Error).message });
  }
});

// GET /api/build/messages — inbox summary (latest msg per peer)
buildRouter.get("/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const result = await pool.query(
      `WITH threads AS (
         SELECT
           CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS "peerId",
           MAX("createdAt") AS "lastAt"
         FROM "BuildMessage"
         WHERE "senderId" = $1 OR "receiverId" = $1
         GROUP BY 1
       )
       SELECT
         t."peerId",
         u."name" AS "peerName",
         u."email" AS "peerEmail",
         t."lastAt",
         (SELECT m."content" FROM "BuildMessage" m
          WHERE (m."senderId" = $1 AND m."receiverId" = t."peerId")
             OR (m."senderId" = t."peerId" AND m."receiverId" = $1)
          ORDER BY m."createdAt" DESC LIMIT 1) AS "lastContent",
         (SELECT COUNT(*)::int FROM "BuildMessage" m
          WHERE m."receiverId" = $1 AND m."senderId" = t."peerId" AND m."readAt" IS NULL) AS "unread"
       FROM threads t
       LEFT JOIN "AEVIONUser" u ON u."id" = t."peerId"
       ORDER BY t."lastAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "messages_inbox_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Files (URL-registry; physical upload is left to a CDN/object-store —
// callers POST a pre-uploaded URL. Matches AEVION pattern: backend
// records metadata, third-party storage holds bytes.)
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/files/upload — register an externally-uploaded file
buildRouter.post("/files/upload", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const projectId = vString(req.body?.projectId, "projectId", { min: 1, max: 200 });
    if (!projectId.ok) return fail(res, 400, projectId.error);

    const url = vString(req.body?.url, "url", { min: 1, max: 2000 });
    if (!url.ok) return fail(res, 400, url.error);
    try {
      const u = new URL(url.value);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return fail(res, 400, "url_must_be_http_or_https");
      }
    } catch {
      return fail(res, 400, "url_invalid");
    }

    const name = req.body?.name == null
      ? { ok: true as const, value: null }
      : vString(req.body.name, "name", { max: 500, allowEmpty: true });
    if (name.ok === false) return fail(res, 400, name.error);

    const mimeType = req.body?.mimeType == null
      ? { ok: true as const, value: null }
      : vString(req.body.mimeType, "mimeType", { max: 200, allowEmpty: true });
    if (mimeType.ok === false) return fail(res, 400, mimeType.error);

    const sizeBytes = req.body?.sizeBytes == null
      ? { ok: true as const, value: null }
      : vNumber(req.body.sizeBytes, "sizeBytes", { min: 0, max: 5e10 });
    if (sizeBytes.ok === false) return fail(res, 400, sizeBytes.error);

    const project = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [projectId.value],
    );
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");
    if (project.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_upload");
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildFile" ("id","projectId","url","name","mimeType","sizeBytes","uploaderId")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        projectId.value,
        url.value,
        name.value || null,
        mimeType.value || null,
        sizeBytes.value !== null ? Math.round(sizeBytes.value) : null,
        auth.sub,
      ],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "file_upload_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Notifications — small badge counts so the header bell knows what's new.
// One round-trip, three numbers. Frontend polls every ~30s.
// ──────────────────────────────────────────────────────────────────────

// GET /api/build/notifications/summary
//   { unreadMessages, pendingApplications, applicationUpdates }
//   - unreadMessages       = BuildMessage where receiverId=me AND readAt IS NULL
//   - pendingApplications  = applications PENDING on my (owner's) vacancies
//   - applicationUpdates   = my own applications updated to ACCEPTED/REJECTED in last 14d
buildRouter.get("/notifications/summary", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const [msgs, pending, updates] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS c FROM "BuildMessage"
         WHERE "receiverId" = $1 AND "readAt" IS NULL`,
        [auth.sub],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c
         FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE p."clientId" = $1 AND a."status" = 'PENDING'`,
        [auth.sub],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c
         FROM "BuildApplication" a
         WHERE a."userId" = $1
           AND a."status" IN ('ACCEPTED','REJECTED')
           AND a."updatedAt" > NOW() - INTERVAL '14 days'`,
        [auth.sub],
      ),
    ]);

    const unreadMessages = msgs.rows[0]?.c ?? 0;
    const pendingApplications = pending.rows[0]?.c ?? 0;
    const applicationUpdates = updates.rows[0]?.c ?? 0;
    return ok(res, {
      unreadMessages,
      pendingApplications,
      applicationUpdates,
      total: unreadMessages + pendingApplications + applicationUpdates,
    });
  } catch (err: unknown) {
    return fail(res, 500, "notifications_summary_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// AI surfaces — career coach + resume parser. Both wrap Anthropic Haiku
// via lib/build/ai.ts. Coach is a chat (multi-turn). Parser is one-shot
// JSON extraction.
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/ai/consult — chat turn with the QBuild career coach.
//   Body: { messages: [{role:"user"|"assistant", content:"..."}] }
//   Returns: { reply, usage }
//   Loads the user's profile + last 5 open vacancies into the system
//   prompt so the coach has live context (and benefits from prompt
//   caching — the system prompt + profile are stable across turns).
buildRouter.post("/ai/consult", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const messagesRaw = req.body?.messages;
    if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
      return fail(res, 400, "messages_required");
    }
    const messages = messagesRaw
      .filter(
        (m: unknown) =>
          typeof m === "object" &&
          m !== null &&
          (m as { role?: string }).role &&
          typeof (m as { content?: string }).content === "string",
      )
      .map((m: unknown) => {
        const obj = m as { role: string; content: string };
        return {
          role: obj.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: obj.content.slice(0, 8000),
        };
      })
      .slice(-20); // bound history

    if (messages.length === 0) return fail(res, 400, "messages_empty");
    if (messages[messages.length - 1].role !== "user") {
      return fail(res, 400, "last_message_must_be_user");
    }

    // Lazy-load AI helper so the import isn't hoisted into modules
    // that don't need it.
    const { callClaude, COACH_SYSTEM_PROMPT } = await import("../lib/build/ai");

    // Profile context.
    const profileQ = await pool.query(
      `SELECT "name","title","city","summary","skillsJson","experienceYears",
              "salaryMin","salaryMax","salaryCurrency","openToWork",
              "driversLicense","shiftPreference","availabilityType",
              "medicalCheckValid","safetyTrainingValid","buildRole"
       FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    const p = profileQ.rows[0] || null;
    const profileBlock = p
      ? `Контекст профиля пользователя (актуальный, обновлено им):
- Имя: ${p.name}
- Заголовок: ${p.title || "—"}
- Роль: ${p.buildRole}
- Город: ${p.city || "—"}
- Лет опыта: ${p.experienceYears ?? 0}
- Skills: ${(safeParseJson(p.skillsJson, [] as string[])).join(", ") || "—"}
- Зарплата: ${p.salaryMin || "—"}–${p.salaryMax || "—"} ${p.salaryCurrency || ""}
- Open to work: ${p.openToWork ? "yes" : "no"}
- Водительские: ${p.driversLicense || "—"}
- Смены: ${p.shiftPreference || "—"}
- Тип занятости: ${p.availabilityType || "—"}
- Медкомиссия: ${p.medicalCheckValid ? "✓" : "—"}
- ТБ: ${p.safetyTrainingValid ? "✓" : "—"}
- Summary: ${p.summary || "—"}`
      : `У пользователя ещё нет заполненного профиля QBuild.`;

    // Recent open vacancies — gives the coach something concrete to
    // suggest applying to ("вот 2 подходят прямо сейчас").
    const vacQ = await pool.query(
      `SELECT v."title", v."salary", v."skillsJson", p."city" AS "projectCity"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."status" = 'OPEN'
       ORDER BY v."createdAt" DESC LIMIT 5`,
    );
    const vacBlock = vacQ.rows.length
      ? `Последние открытые вакансии на платформе:
${vacQ.rows
  .map((v: { title: string; salary: number; skillsJson: string; projectCity: string | null }, i: number) => {
    const sk = safeParseJson(v.skillsJson, [] as string[]);
    return `${i + 1}. ${v.title}${v.projectCity ? ` (${v.projectCity})` : ""}${v.salary ? `, ${v.salary}` : ""}${sk.length ? ` · skills: ${sk.join(", ")}` : ""}`;
  })
  .join("\n")}`
      : "На платформе сейчас нет открытых вакансий — упомяни это, если пользователь спросит.";

    const fullSystem = `${COACH_SYSTEM_PROMPT}

${profileBlock}

${vacBlock}`;

    const reply = await callClaude({
      systemPrompt: fullSystem,
      messages,
      maxTokens: 1024,
      cacheSystem: true,
    });

    return ok(res, {
      reply: reply.text,
      usage: {
        input: reply.inputTokens,
        output: reply.outputTokens,
        cacheRead: reply.cacheReadInputTokens || 0,
        cacheWrite: reply.cacheCreationInputTokens || 0,
      },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_consult_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/parse-resume — extract structured AEVION resume
// schema from either:
//   { text: string } — free-form text dump (PDF text, voice transcript, paste)
//   { imageBase64, imageMediaType } — photo or scan of a resume (Claude vision)
// Returns { parsed: {...} } and lets the frontend show a preview before
// hitting POST /profiles to merge.
buildRouter.post("/ai/parse-resume", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const hasImage =
      typeof req.body?.imageBase64 === "string" && req.body.imageBase64.length > 0;
    const hasText = typeof req.body?.text === "string" && req.body.text.trim().length > 0;
    if (!hasImage && !hasText) return fail(res, 400, "text_or_image_required");

    const { callClaude, callClaudeMultimodal, RESUME_PARSER_SYSTEM_PROMPT } = await import("../lib/build/ai");

    let reply;
    if (hasImage) {
      const mt = String(req.body.imageMediaType || "image/jpeg");
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(mt)) return fail(res, 400, "unsupported_image_type", { allowed });
      // Cap the base64 payload at ~6 MB to stay well under Express's
      // 1 MB JSON limit unless the caller explicitly bumped it. The
      // route's app-level json limit is 1 MB — frontend should
      // downscale before send. We surface a clean error if not.
      if (req.body.imageBase64.length > 8_500_000) {
        return fail(res, 413, "image_too_large", { maxBytesBase64: 8_500_000 });
      }
      reply = await callClaudeMultimodal({
        systemPrompt: RESUME_PARSER_SYSTEM_PROMPT,
        userContent: [
          { type: "image", source: { type: "base64", media_type: mt, data: String(req.body.imageBase64) } },
          { type: "text", text: "Распарси это резюме в строгий JSON по схеме AEVION Resume Schema v2." },
        ],
        maxTokens: 4096,
        cacheSystem: true,
      });
    } else {
      const text = vString(req.body?.text, "text", { min: 20, max: 60_000 });
      if (!text.ok) return fail(res, 400, text.error);
      reply = await callClaude({
        systemPrompt: RESUME_PARSER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.value }],
        maxTokens: 4096,
        cacheSystem: true,
      });
    }

    // Defensive parse — strip ```json fences if the model added them.
    const stripped = reply.text
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      return fail(res, 502, "ai_returned_invalid_json", {
        sample: stripped.slice(0, 200),
        usage: {
          input: reply.inputTokens,
          output: reply.outputTokens,
        },
      });
    }

    return ok(res, {
      parsed,
      usage: {
        input: reply.inputTokens,
        output: reply.outputTokens,
        cacheRead: reply.cacheReadInputTokens || 0,
        cacheWrite: reply.cacheCreationInputTokens || 0,
      },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_parse_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Bookmarks — saved vacancies + saved candidates.
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/bookmarks — toggle. Idempotent: re-posting an existing
// (kind,targetId) row removes it. Returns { saved: boolean } so the UI
// can flip its star.
buildRouter.post("/bookmarks", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const kind = vEnum(req.body?.kind, "kind", BOOKMARK_KINDS);
    if (!kind.ok) return fail(res, 400, kind.error);
    const targetId = vString(req.body?.targetId, "targetId", { min: 1, max: 200 });
    if (!targetId.ok) return fail(res, 400, targetId.error);
    const note = req.body?.note == null
      ? null
      : String(req.body.note).trim().slice(0, 500) || null;

    const existing = await pool.query(
      `SELECT "id" FROM "BuildBookmark"
       WHERE "userId" = $1 AND "kind" = $2 AND "targetId" = $3 LIMIT 1`,
      [auth.sub, kind.value, targetId.value],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await pool.query(`DELETE FROM "BuildBookmark" WHERE "id" = $1`, [existing.rows[0].id]);
      return ok(res, { saved: false, removed: existing.rows[0].id });
    }

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildBookmark" ("id","userId","kind","targetId","note")
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, auth.sub, kind.value, targetId.value, note],
    );
    return ok(res, { saved: true, bookmark: r.rows[0] }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "bookmark_toggle_failed", { details: (err as Error).message });
  }
});

// GET /api/build/bookmarks?kind=VACANCY|CANDIDATE — hydrated list
// for the bearer. Joins each row with its target so the client doesn't
// have to fan-out N requests to render /build/saved.
buildRouter.get("/bookmarks", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const kindFilter =
      typeof req.query.kind === "string" ? vEnum(req.query.kind, "kind", BOOKMARK_KINDS) : null;
    if (kindFilter && !kindFilter.ok) return fail(res, 400, kindFilter.error);

    const params: unknown[] = [auth.sub];
    let where = `"userId" = $1`;
    if (kindFilter && kindFilter.ok) {
      params.push(kindFilter.value);
      where += ` AND "kind" = $${params.length}`;
    }
    const rows = await pool.query(
      `SELECT * FROM "BuildBookmark" WHERE ${where} ORDER BY "createdAt" DESC LIMIT 200`,
      params,
    );

    const vacancyIds = (rows.rows as Array<{ kind: string; targetId: string }>)
      .filter((r) => r.kind === "VACANCY")
      .map((r) => r.targetId);
    const candidateIds = (rows.rows as Array<{ kind: string; targetId: string }>)
      .filter((r) => r.kind === "CANDIDATE")
      .map((r) => r.targetId);

    const [vacanciesQ, candidatesQ] = await Promise.all([
      vacancyIds.length
        ? pool.query(
            `SELECT v."id", v."title", v."salary", v."status", v."createdAt",
                    p."title" AS "projectTitle", p."city" AS "projectCity",
                    (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
             FROM "BuildVacancy" v
             LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
             WHERE v."id" = ANY($1::text[])`,
            [vacancyIds],
          )
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      candidateIds.length
        ? pool.query(
            `SELECT p."userId", p."name", p."city", p."buildRole",
                    p."title", p."skillsJson", p."experienceYears",
                    p."photoUrl", p."openToWork", p."verifiedAt"
             FROM "BuildProfile" p
             WHERE p."userId" = ANY($1::text[])`,
            [candidateIds],
          )
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ]);

    const vacancyMap = new Map<string, Record<string, unknown>>(
      vacanciesQ.rows.map((r: Record<string, unknown>) => [String(r.id), r]),
    );
    const candidateMap = new Map<string, Record<string, unknown>>(
      candidatesQ.rows.map((r: Record<string, unknown>) => [
        String(r.userId),
        { ...r, skills: safeParseJson(r.skillsJson, [] as string[]) },
      ]),
    );

    const items = rows.rows.map((r: Record<string, unknown>) => {
      const target =
        r.kind === "VACANCY"
          ? vacancyMap.get(String(r.targetId)) ?? null
          : candidateMap.get(String(r.targetId)) ?? null;
      return { ...r, target };
    });

    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "bookmarks_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/usage/me — current plan limits + month-to-date counters
// + computed remaining slots for the auth-bearer. Powers the badge in
// BuildShell and the "12/∞ this month" footer on /build/talent.
buildRouter.get("/usage/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const plan = await getUserPlan(auth.sub);
    const usage = await ensureUsageRow(auth.sub);

    // Active vacancy count across all of this user's projects.
    const active = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM "BuildVacancy" v
       JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE p."clientId" = $1 AND v."status" = 'OPEN'`,
      [auth.sub],
    );
    const activeVacancies = active.rows[0]?.c ?? 0;

    return ok(res, {
      plan,
      usage,
      monthKey: currentMonthKey(),
      activeVacancies,
      limits: {
        vacanciesRemaining: isUnlimited(plan.vacancySlots) ? -1 : Math.max(0, plan.vacancySlots - activeVacancies),
        talentSearchesRemaining: isUnlimited(plan.talentSearchPerMonth)
          ? -1
          : Math.max(0, plan.talentSearchPerMonth - usage.talentSearches),
        boostsRemaining: isUnlimited(plan.boostsPerMonth) ? -1 : Math.max(0, plan.boostsPerMonth - usage.boostsUsed),
      },
    });
  } catch (err: unknown) {
    return fail(res, 500, "usage_me_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Pricing — plans, subscriptions, order ledger.
// Plans are seeded by ensureBuildTables. Reading is public; subscribing
// requires auth. Payments are out-of-scope: we record an order in
// PENDING/PAID and a Subscription row goes ACTIVE on the FREE tier
// immediately (everything else stays PENDING until a payment provider
// flips it).
// ──────────────────────────────────────────────────────────────────────

// GET /api/build/plans — public catalog
buildRouter.get("/plans", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT "key","name","tagline","priceMonthly","currency","vacancySlots","talentSearchPerMonth","boostsPerMonth","hireFeeBps","featuresJson","sortOrder"
       FROM "BuildPlan"
       WHERE "active" = TRUE
       ORDER BY "sortOrder" ASC`,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      features: safeParseJson(r.featuresJson, [] as string[]),
    }));
    res.setHeader("Cache-Control", "public, max-age=300");
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "plans_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/subscriptions/me — current plan for the bearer
buildRouter.get("/subscriptions/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const sub = await pool.query(
      `SELECT s.*, p."name" AS "planName", p."priceMonthly", p."currency",
              p."vacancySlots", p."talentSearchPerMonth", p."boostsPerMonth", p."hireFeeBps"
       FROM "BuildSubscription" s
       LEFT JOIN "BuildPlan" p ON p."key" = s."planKey"
       WHERE s."userId" = $1 AND s."status" = 'ACTIVE'
       ORDER BY s."createdAt" DESC
       LIMIT 1`,
      [auth.sub],
    );

    if (sub.rowCount === 0) return ok(res, { subscription: null });
    return ok(res, { subscription: sub.rows[0] });
  } catch (err: unknown) {
    return fail(res, 500, "subscription_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/subscriptions/start { planKey } — start or switch plan
//   FREE                   → ACTIVE immediately, order PAID(0)
//   PPHIRE                 → ACTIVE (no monthly fee, fee at hire-time)
//   PRO/AGENCY             → subscription PENDING + order PENDING
//                            (real payment integration plugs in later)
buildRouter.post("/subscriptions/start", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const planKey = vEnum(req.body?.planKey, "planKey", PLAN_KEYS);
    if (!planKey.ok) return fail(res, 400, planKey.error);

    const plan = await pool.query(
      `SELECT "key","priceMonthly","currency" FROM "BuildPlan" WHERE "key" = $1 AND "active" = TRUE LIMIT 1`,
      [planKey.value],
    );
    if (plan.rowCount === 0) return fail(res, 404, "plan_not_found");
    const planRow = plan.rows[0];

    const isFreeStart = planRow.priceMonthly === 0;
    const subStatus = isFreeStart ? "ACTIVE" : "PENDING";
    const orderStatus = isFreeStart ? "PAID" : "PENDING";

    await pool.query("BEGIN");
    try {
      // Cancel any existing ACTIVE sub for this user before inserting a new one
      // (the partial-unique index requires it).
      await pool.query(
        `UPDATE "BuildSubscription" SET "status" = 'CANCELED', "endsAt" = NOW()
         WHERE "userId" = $1 AND "status" = 'ACTIVE'`,
        [auth.sub],
      );

      const subId = crypto.randomUUID();
      const subResult = await pool.query(
        `INSERT INTO "BuildSubscription" ("id","userId","planKey","status")
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [subId, auth.sub, planKey.value, subStatus],
      );

      const orderId = crypto.randomUUID();
      const orderResult = await pool.query(
        `INSERT INTO "BuildOrder" ("id","userId","kind","ref","amount","currency","status","metaJson")
         VALUES ($1,$2,'SUB_START',$3,$4,$5,$6,$7) RETURNING *`,
        [
          orderId,
          auth.sub,
          subId,
          planRow.priceMonthly,
          planRow.currency,
          orderStatus,
          JSON.stringify({ planKey: planKey.value }),
        ],
      );

      await pool.query("COMMIT");
      return ok(
        res,
        { subscription: subResult.rows[0], order: orderResult.rows[0] },
        201,
      );
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "subscription_start_failed", { details: (err as Error).message });
  }
});

// GET /api/build/orders/me — order ledger for the bearer
buildRouter.get("/orders/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const result = await pool.query(
      `SELECT * FROM "BuildOrder" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "orders_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/orders/:id/pay — stub for the payment provider step.
//   This is the only place that flips an order PENDING → PAID. When
//   the order references a SUB_START, the linked subscription also
//   flips PENDING → ACTIVE (and any prior ACTIVE sub for the same
//   user is canceled, matching the partial-unique index).
//   In production this would be webhook-driven from Stripe / YooKassa /
//   etc. — for now we accept a direct call from the bearer who owns
//   the order, so the e2e flow is testable end-to-end.
buildRouter.post("/orders/:id/pay", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const order = await pool.query(`SELECT * FROM "BuildOrder" WHERE "id" = $1 LIMIT 1`, [id]);
    if (order.rowCount === 0) return fail(res, 404, "order_not_found");
    const row = order.rows[0];
    if (row.userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    if (row.status === "PAID") return ok(res, { order: row, alreadyPaid: true });
    if (row.status !== "PENDING") return fail(res, 400, `order_not_payable`, { currentStatus: row.status });

    await pool.query("BEGIN");
    try {
      const updated = await pool.query(
        `UPDATE "BuildOrder" SET "status" = 'PAID' WHERE "id" = $1 RETURNING *`,
        [id],
      );

      // Side-effects keyed by order kind.
      if (row.kind === "SUB_START" && row.ref) {
        // Cancel any other ACTIVE sub first to honor the unique-active index.
        await pool.query(
          `UPDATE "BuildSubscription" SET "status" = 'CANCELED', "endsAt" = NOW()
           WHERE "userId" = $1 AND "status" = 'ACTIVE' AND "id" <> $2`,
          [row.userId, row.ref],
        );
        await pool.query(
          `UPDATE "BuildSubscription" SET "status" = 'ACTIVE', "startedAt" = NOW()
           WHERE "id" = $1`,
          [row.ref],
        );
      }
      // BOOST orders: nothing to flip — the BuildBoost row was inserted at
      // boost-time. We could add an "active" flag later if we want strict
      // pay-before-feature semantics; for now boosts go live immediately
      // (PAID just clears the bill).

      await pool.query("COMMIT");
      return ok(res, { order: updated.rows[0] });
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "order_pay_failed", { details: (err as Error).message });
  }
});

// Health probe — no auth, no DB roundtrip beyond the bootstrap middleware.
buildRouter.get("/health", (_req, res) => {
  return ok(res, {
    service: "qbuild",
    status: "ok",
    statuses: {
      project: PROJECT_STATUSES,
      vacancy: VACANCY_STATUSES,
      application: APPLICATION_STATUSES,
      role: BUILD_ROLES,
    },
    timestamp: new Date().toISOString(),
  });
});
