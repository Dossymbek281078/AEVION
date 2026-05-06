import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  safeParseJson,
} from "../../lib/build";

export const aiRouter = Router();

// Per-user rate limiter: 10 AI calls per 10 min to guard Anthropic spend.
// Keyed on JWT sub so each account has its own bucket regardless of IP.
const aiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
        ) as { sub?: unknown };
        if (typeof payload.sub === "string") return payload.sub;
      } catch { /**/ }
    }
    return req.ip ?? "anon";
  },
  message: {
    success: false,
    error: "ai_rate_limit_exceeded",
    retryAfterMs: 10 * 60 * 1000,
  },
});

// POST /api/build/ai/consult — chat turn with the QBuild career coach.
aiRouter.post("/consult", aiRateLimiter, async (req, res) => {
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
      .slice(-20);

    if (messages.length === 0) return fail(res, 400, "messages_empty");
    if (messages[messages.length - 1].role !== "user") {
      return fail(res, 400, "last_message_must_be_user");
    }

    const { callClaude, COACH_SYSTEM_PROMPT } = await import("../../lib/build/ai");

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

    const fullSystem = `${COACH_SYSTEM_PROMPT}\n\n${profileBlock}\n\n${vacBlock}`;

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

// POST /api/build/ai/parse-resume
aiRouter.post("/parse-resume", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const hasImage =
      typeof req.body?.imageBase64 === "string" && req.body.imageBase64.length > 0;
    const hasText = typeof req.body?.text === "string" && req.body.text.trim().length > 0;
    if (!hasImage && !hasText) return fail(res, 400, "text_or_image_required");

    const { callClaude, callClaudeMultimodal, RESUME_PARSER_SYSTEM_PROMPT } =
      await import("../../lib/build/ai");

    let reply;
    if (hasImage) {
      const mt = String(req.body.imageMediaType || "image/jpeg");
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(mt)) return fail(res, 400, "unsupported_image_type", { allowed });
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
        usage: { input: reply.inputTokens, output: reply.outputTokens },
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

// POST /api/build/ai/improve-text
aiRouter.post("/improve-text", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const text = vString(req.body?.text, "text", { min: 10, max: 4000 });
    if (!text.ok) return fail(res, 400, text.error);
    const kindRaw = typeof req.body?.kind === "string" ? req.body.kind.trim().toLowerCase() : "generic";
    const kind = ["summary", "vacancy_description", "cover_note", "experience", "generic"].includes(kindRaw)
      ? kindRaw
      : "generic";
    const locale = typeof req.body?.locale === "string" ? req.body.locale.trim().slice(0, 8) : "ru";

    const kindGuide: Record<string, string> = {
      summary:
        "Это поле SUMMARY на резюме строителя/инженера. 2–4 коротких предложения, без буллетов, без \"Я — ...\", сразу про опыт + ключевую экспертизу + что ищет.",
      vacancy_description:
        "Это описание вакансии в строительстве. Сделай конкретно: задачи, требования, условия (смены, оплата). Без воды, без \"мы — динамичная команда\". Строки можно через пустую строку для читаемости.",
      cover_note:
        "Это сопроводительное письмо к отклику на стройвакансию. 3–5 предложений, конкретный опыт + почему подходит + готов выйти.",
      experience:
        "Это блок 'опыт работы' (один пункт). Опиши что делал, чем измеряется результат (объёмы, сроки, бюджет). Сухо, без рекламных эпитетов.",
      generic: "Перепиши текст более конкретно и профессионально.",
    };

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — редактор резюме и вакансий на платформе AEVION QBuild (стройка).
Твоя задача: переписать переданный текст ярче и конкретнее, не выдумывая фактов.

${kindGuide[kind]}

Язык ответа: ${locale === "en" ? "English" : locale === "kz" ? "Kazakh (cyrillic)" : "Russian"}.

Правила:
- Не добавляй данные, которых нет в исходнике (никаких \"работал в Газпроме\" если не указано).
- Не используй markdown-разметку, кроме переноса строк.
- Не пиши преамбулы типа \"Вот улучшенная версия:\". Только сам текст.
- Сохраняй родной язык исходника, если совпадает с ${locale}.`,
      messages: [{ role: "user", content: text.value }],
      maxTokens: 800,
      cacheSystem: false,
    });

    return ok(res, {
      improved: reply.text.trim(),
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_improve_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/shortlist
// Body: { vacancyId: string }
// Owner-only. Reads ALL pending applications + per-applicant AI scores +
// profiles, asks Claude to pick the top 3 candidates and explain why.
// Returns { items: [{ applicationId, rank, reasoning }], summary }.
aiRouter.post("/shortlist", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const vacancyId = vString(req.body?.vacancyId, "vacancyId", { min: 1, max: 64 });
    if (!vacancyId.ok) return fail(res, 400, vacancyId.error);

    const owner = await pool.query(
      `SELECT v."title", v."description", v."skillsJson", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [vacancyId.value],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_shortlist");
    }

    const apps = await pool.query(
      `SELECT a."id", a."message", a."aiScoreOverall", a."matchScore" AS "_matchScore",
              u."name" AS "applicantName",
              bp."title", bp."summary", bp."skillsJson", bp."experienceYears", bp."city"
       FROM "BuildApplication" a
       LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
       LEFT JOIN "BuildProfile" bp ON bp."userId" = a."userId"
       WHERE a."vacancyId" = $1 AND a."status" = 'PENDING'
       ORDER BY a."createdAt" DESC
       LIMIT 30`,
      [vacancyId.value],
    );

    if (apps.rowCount === 0) {
      return ok(res, {
        items: [],
        summary: "No pending applications to shortlist yet.",
      });
    }

    type AppRow = {
      id: string;
      message: string | null;
      aiScoreOverall: number | null;
      applicantName: string;
      title: string | null;
      summary: string | null;
      skillsJson: string;
      experienceYears: number | null;
      city: string | null;
    };

    const rows = apps.rows as AppRow[];
    const v = owner.rows[0];
    const requiredSkills = safeParseJson(v.skillsJson, [] as string[]);

    const candidatesPayload = rows
      .map((r, i) => {
        const skills = safeParseJson(r.skillsJson, [] as string[]);
        return [
          `--- Candidate #${i + 1} (id: ${r.id}) ---`,
          `Name: ${r.applicantName ?? "—"}`,
          `Headline: ${r.title ?? "—"}`,
          `Years exp: ${r.experienceYears ?? 0}`,
          `City: ${r.city ?? "—"}`,
          `Skills: ${skills.join(", ") || "—"}`,
          `AI score (per-application screening): ${r.aiScoreOverall ?? "—"}/100`,
          `Cover note: ${(r.message ?? "").slice(0, 400) || "—"}`,
          `Profile summary: ${(r.summary ?? "").slice(0, 400) || "—"}`,
        ].join("\n");
      })
      .join("\n\n");

    const userPayload = `VACANCY: ${v.title}
Description: ${String(v.description).slice(0, 600)}
Required skills: ${requiredSkills.join(", ") || "—"}

PENDING APPLICATIONS (${rows.length}):
${candidatesPayload}

Pick up to 3 strongest candidates. Возвращай только JSON в формате:
{"summary": "1-2 sentences overall pool quality", "picks": [{"applicationId": "...", "rank": 1, "reasoning": "1-2 sentences why"}, ...]}
Никаких преамбул, никакого markdown.`;

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — старший рекрутер на платформе AEVION QBuild (стройка/инженерия).
Тебе показан список кандидатов на конкретную вакансию + их скоры и резюме.
Задача: выбрать топ-3 (или меньше, если меньше достойных), объяснить почему.

Жёсткие правила:
- Опирайся на навыки + годы опыта + конкретику в cover note + AI score.
- Не выдумывай данные, которых нет.
- Кратко (1-2 предложения на обоснование).
- Возвращай только валидный JSON. Никакого текста до/после.`,
      messages: [{ role: "user", content: userPayload }],
      maxTokens: 1500,
      cacheSystem: false,
    });

    const stripped = reply.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    let parsed: { summary?: string; picks?: { applicationId: string; rank: number; reasoning: string }[] } = {};
    try {
      parsed = JSON.parse(stripped) as typeof parsed;
    } catch {
      return fail(res, 502, "ai_shortlist_invalid_json", { details: stripped.slice(0, 200) });
    }

    const validIds = new Set(rows.map((r) => r.id));
    const picks = (parsed.picks ?? [])
      .filter((p) => validIds.has(p.applicationId))
      .slice(0, 3)
      .sort((a, b) => a.rank - b.rank);

    return ok(res, {
      items: picks,
      summary: parsed.summary ?? "",
      total: rows.length,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_shortlist_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/interview-prep
// Body: { applicationId: string }
// Owner-only (verified against the application's parent vacancy). Claude
// reads the vacancy + the candidate's profile + cover note and returns
// 5 likely-to-be-useful interview questions with one-line rationale each.
// Saves the recruiter from cold-typing into ChatGPT before every call.
aiRouter.post("/interview-prep", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 64 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);

    const r = await pool.query(
      `SELECT a."id", a."message", a."userId" AS "candidateId",
              v."title", v."description", v."skillsJson",
              p."clientId",
              u."name" AS "candidateName",
              bp."title" AS "candidateHeadline", bp."summary" AS "candidateSummary",
              bp."skillsJson" AS "candidateSkillsJson", bp."experienceYears" AS "candidateYears"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
       LEFT JOIN "BuildProfile" bp ON bp."userId" = a."userId"
       WHERE a."id" = $1 LIMIT 1`,
      [applicationId.value],
    );
    if (r.rowCount === 0) return fail(res, 404, "application_not_found");
    const row = r.rows[0];
    if (row.clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_prep");
    }

    const reqSkills = safeParseJson(row.skillsJson, [] as string[]);
    const candSkills = safeParseJson(row.candidateSkillsJson, [] as string[]);
    const candSet = new Set(candSkills.map((s: string) => s.toLowerCase()));
    const overlap = reqSkills.filter((s: string) => candSet.has(s.toLowerCase()));
    const missing = reqSkills.filter((s: string) => !candSet.has(s.toLowerCase()));

    const userPayload = `VACANCY: ${row.title}
Description: ${String(row.description).slice(0, 500)}
Required skills: ${reqSkills.join(", ") || "—"}

CANDIDATE: ${row.candidateName ?? "—"}
Headline: ${row.candidateHeadline ?? "—"}
Years experience: ${row.candidateYears ?? 0}
Skills declared: ${candSkills.join(", ") || "—"}
Skill overlap with vacancy: ${overlap.join(", ") || "(none)"}
Skills declared on vacancy that the candidate did NOT list: ${missing.join(", ") || "(none)"}
Profile summary: ${String(row.candidateSummary ?? "").slice(0, 400) || "—"}
Cover note: ${String(row.message ?? "").slice(0, 400) || "—"}

Сгенерируй 5 вопросов для интервью.`;

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — старший рекрутер на платформе AEVION QBuild (стройка/инженерия).
Твоя задача: подготовить рекрутеру 5 вопросов для интервью с конкретным кандидатом.

Жёсткие правила:
- Вопросы должны быть конкретны для этой связки vacancy + candidate.
  Не "расскажите о себе" — а "вы упомянули X, как именно вы делали Y".
- 1-2 вопроса должны проверять навык, заявленный в вакансии, но НЕ
  заявленный кандидатом (если такой есть).
- 1-2 вопроса должны углубить заявленный опыт кандидата.
- 1 вопрос про soft skills / motivation, привязанный к роли.
- К каждому вопросу — короткая (≤15 слов) подсказка для рекрутера, что
  именно проверяется.
- Возвращай только JSON:
  {"questions": [{"q": "...", "hint": "..."}, ...]}
- Никаких преамбул, никакого markdown.`,
      messages: [{ role: "user", content: userPayload }],
      maxTokens: 1200,
      cacheSystem: false,
    });

    const stripped = reply.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    let parsed: { questions?: { q: string; hint: string }[] } = {};
    try {
      parsed = JSON.parse(stripped) as typeof parsed;
    } catch {
      return fail(res, 502, "ai_interview_prep_invalid_json", { details: stripped.slice(0, 200) });
    }

    const questions = (parsed.questions ?? [])
      .filter((q) => typeof q?.q === "string" && typeof q?.hint === "string")
      .slice(0, 5);

    return ok(res, {
      questions,
      skillOverlap: overlap,
      missingSkills: missing,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_interview_prep_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/translate-vacancy
// Body: { title: string, description: string, targetLocales?: string[] }
// Returns { translations: { [locale]: { title, description } } } for the
// requested locales (defaults to ["ru", "en", "kz"] minus whatever locale
// the source is already in).
//
// Stateless — caller decides whether to persist the result. We keep it
// stateless so a recruiter can preview translations on a draft vacancy
// before saving, and because storing them per-vacancy would balloon
// schema across modules we don't own here.
aiRouter.post("/translate-vacancy", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);

    const allLocales = ["ru", "en", "kz"] as const;
    type Loc = (typeof allLocales)[number];
    const requested: Loc[] = Array.isArray(req.body?.targetLocales)
      ? (req.body.targetLocales as unknown[]).filter((x): x is Loc =>
          allLocales.includes(x as Loc),
        )
      : ["ru", "en", "kz"];
    if (requested.length === 0) return fail(res, 400, "no_target_locales");

    const labels: Record<Loc, string> = {
      ru: "Russian (Russia)",
      en: "English (US)",
      kz: "Kazakh (cyrillic)",
    };

    const userPayload = `SOURCE TITLE: ${title.value}

SOURCE DESCRIPTION:
${description.value}

Translate into the following locales: ${requested.map((l) => labels[l]).join(", ")}.

Return ONLY valid JSON in this exact shape, no markdown, no preamble:
{"translations": {${requested.map((l) => `"${l}": {"title": "...", "description": "..."}`).join(", ")}}}`;

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `You are a professional construction-industry translator for AEVION QBuild.

Hard rules:
- Translate the vacancy title and description into the requested locales.
- Preserve technical terms (welding, scaffolding, AutoCAD, etc.) — use the
  natural local form, do not translate brand names.
- Match the register of the source (formal job posting), no marketing fluff.
- Keep paragraph breaks. No markdown headings.
- Return ONLY a JSON object — no preamble, no code fences.
- Do not invent facts that aren't in the source.`,
      messages: [{ role: "user", content: userPayload }],
      maxTokens: 2200,
      cacheSystem: false,
    });

    const stripped = reply.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    let parsed: { translations?: Record<string, { title?: string; description?: string }> } = {};
    try {
      parsed = JSON.parse(stripped) as typeof parsed;
    } catch {
      return fail(res, 502, "ai_translate_invalid_json", { details: stripped.slice(0, 200) });
    }

    const translations: Record<string, { title: string; description: string }> = {};
    for (const loc of requested) {
      const t = parsed.translations?.[loc];
      if (t && typeof t.title === "string" && typeof t.description === "string") {
        translations[loc] = { title: t.title, description: t.description };
      }
    }

    return ok(res, {
      translations,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_translate_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/cover-letter
// Body: { vacancyId: string, locale?: "ru" | "en" | "kz" }
// Generates a tailored cover note from the user's profile + vacancy. The
// candidate sees a draft they can edit before submitting — never auto-submits.
aiRouter.post("/cover-letter", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const vacancyId = vString(req.body?.vacancyId, "vacancyId", { min: 1, max: 64 });
    if (!vacancyId.ok) return fail(res, 400, vacancyId.error);
    const locale = typeof req.body?.locale === "string" ? req.body.locale.trim().slice(0, 8) : "ru";

    const [vRow, pRow] = await Promise.all([
      pool.query(
        `SELECT v."title", v."description", v."skillsJson", v."salary", v."salaryCurrency", v."city",
                p."title" AS "projectTitle", p."city" AS "projectCity"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE v."id" = $1 LIMIT 1`,
        [vacancyId.value],
      ),
      pool.query(
        `SELECT "name","title","summary","skillsJson","experienceYears","city"
         FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
        [auth.sub],
      ),
    ]);
    if (vRow.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (pRow.rowCount === 0) return fail(res, 400, "profile_required_for_ai_cover_letter");

    const v = vRow.rows[0];
    const p = pRow.rows[0];
    const vacancySkills = safeParseJson(v.skillsJson, [] as string[]);
    const profileSkills = safeParseJson(p.skillsJson, [] as string[]);
    const overlap = vacancySkills.filter((s: string) =>
      profileSkills.some((ps: string) => ps.toLowerCase() === s.toLowerCase()),
    );

    const userPayload = `VACANCY:
Title: ${v.title}
Project: ${v.projectTitle || "—"}
City: ${v.city || v.projectCity || "—"}
Salary: ${v.salary > 0 ? `${v.salary} ${v.salaryCurrency || "USD"}` : "не указано"}
Description:
${v.description}
Required skills: ${vacancySkills.join(", ") || "—"}

CANDIDATE PROFILE:
Name: ${p.name}
Headline: ${p.title || "—"}
City: ${p.city || "—"}
Years experience: ${p.experienceYears ?? 0}
Skills: ${profileSkills.join(", ") || "—"}
Skills overlap with vacancy: ${overlap.join(", ") || "(none)"}
Summary:
${p.summary || "—"}

Сформируй сопроводительное. 3–5 коротких предложений. Без markdown.`;

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — карьерный консультант на платформе AEVION QBuild (стройка/инженерные роли).
Сгенерируй сопроводительное письмо к отклику от лица кандидата.

Жёсткие правила:
- 3–5 коротких предложений, разговорный, профессиональный.
- Опирайся ТОЛЬКО на данные из профиля. Никаких вымышленных компаний, объектов, цифр.
- Если в профиле нет нужного навыка — НЕ заявляй, что он есть.
- Подсвети 1–2 совпадения между навыками вакансии и профилем.
- Заверши готовностью обсудить детали и выйти.
- Ответ строго на ${locale === "en" ? "English" : locale === "kz" ? "Kazakh" : "Russian"}.
- Без преамбул типа "Вот письмо:". Только сам текст.
- Без markdown.`,
      messages: [{ role: "user", content: userPayload }],
      maxTokens: 700,
      cacheSystem: false,
    });

    return ok(res, {
      coverLetter: reply.text.trim(),
      skillsOverlap: overlap,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_cover_letter_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/why-match
// Body: { applicationId: string, force?: boolean }
// Recruiter-side: explains in 2-3 sentences why a specific candidate matches
// (or doesn't match) a vacancy. Cached on BuildApplication.aiWhyMatch so
// re-opening the same candidate doesn't burn tokens. Pass force:true to
// regenerate.
aiRouter.post("/why-match", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 64 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);
    const force = req.body?.force === true;

    const r = await pool.query(
      `SELECT a."id", a."message", a."aiWhyMatch", a."matchScore",
              v."title" AS "vacancyTitle", v."description" AS "vacancyDesc",
              v."skillsJson" AS "vacancySkillsJson",
              p."clientId",
              prof."name" AS "candidateName", prof."title" AS "candidateHeadline",
              prof."skillsJson" AS "candidateSkillsJson",
              prof."experienceYears", prof."summary"
       FROM "BuildApplication" a
       JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       LEFT JOIN "BuildProfile" prof ON prof."userId" = a."userId"
       WHERE a."id" = $1 LIMIT 1`,
      [applicationId.value],
    );
    if (r.rowCount === 0) return fail(res, 404, "application_not_found");
    const row = r.rows[0];
    if (row.clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    if (!force && row.aiWhyMatch) {
      return ok(res, { explanation: row.aiWhyMatch, cached: true });
    }

    const vSkills = safeParseJson(row.vacancySkillsJson, [] as string[]);
    const cSkills = safeParseJson(row.candidateSkillsJson, [] as string[]);
    const overlap = vSkills.filter((s: string) =>
      cSkills.some((cs: string) => cs.toLowerCase() === s.toLowerCase()),
    );
    const missing = vSkills.filter((s: string) => !overlap.includes(s));

    const userPayload = `VACANCY:
Title: ${row.vacancyTitle}
Description: ${String(row.vacancyDesc || "").slice(0, 1000)}
Required skills: ${vSkills.join(", ") || "—"}

CANDIDATE:
Name: ${row.candidateName || "Anonymous"}
Headline: ${row.candidateHeadline || "—"}
Years experience: ${row.experienceYears ?? 0}
Skills: ${cSkills.join(", ") || "—"}
Skills match: ${overlap.join(", ") || "(none)"}
Skills missing: ${missing.join(", ") || "(none)"}
Match score: ${row.matchScore ?? "n/a"}
Cover note: ${String(row.message || "").slice(0, 400) || "(none)"}
Summary: ${String(row.summary || "").slice(0, 400) || "(none)"}

Объясни в 2-3 предложениях, насколько кандидат подходит. Без markdown, без списков.`;

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — рекрутинг-ассистент AEVION QBuild. Объясняешь рекрутеру, почему кандидат подходит (или не подходит) к вакансии.

Жёсткие правила:
- 2-3 предложения, по сути.
- Опирайся ТОЛЬКО на предоставленные данные. Никаких выдумок про опыт или сертификаты.
- Назови 1-2 сильные стороны и 1 риск/пробел.
- Без markdown, без эмодзи, без списков.
- Тональность нейтральная и трезвая, без пафоса.
- Если match очень слабый — скажи это прямо.
- Ответ на русском.`,
      messages: [{ role: "user", content: userPayload }],
      maxTokens: 400,
      cacheSystem: false,
    });

    const explanation = reply.text.trim().slice(0, 2000);
    await pool.query(
      `UPDATE "BuildApplication" SET "aiWhyMatch" = $1 WHERE "id" = $2`,
      [explanation, applicationId.value],
    );

    return ok(res, {
      explanation,
      cached: false,
      skillsOverlap: overlap,
      skillsMissing: missing,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_why_match_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/vacancy-feedback — owner-only quality review of a vacancy.
// Returns a 0-100 score, what's working, and 3-5 concrete improvement bullets.
// Body: { vacancyId: string }
aiRouter.post("/vacancy-feedback", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const vacancyId = vString(req.body?.vacancyId, "vacancyId", { min: 1, max: 64 });
    if (!vacancyId.ok) return fail(res, 400, vacancyId.error);

    const r = await pool.query(
      `SELECT v."id", v."title", v."description", v."skillsJson", v."salary", v."salaryCurrency", v."city",
              p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [vacancyId.value],
    );
    if (r.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    const row = r.rows[0];
    if (row.clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    let skills: string[] = [];
    try {
      const parsed = JSON.parse(row.skillsJson ?? "[]");
      if (Array.isArray(parsed)) skills = parsed.filter((s) => typeof s === "string");
    } catch {
      /* ignore */
    }

    const lines = [
      `Title: ${row.title}`,
      `City: ${row.city || "—"}`,
      `Salary: ${row.salary > 0 ? `${row.salary} ${row.salaryCurrency || "USD"}` : "not posted"}`,
      `Skills tags: ${skills.length ? skills.join(", ") : "none"}`,
      "",
      `Description:`,
      row.description || "(empty)",
    ].join("\n");

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — рекрутер-эксперт на платформе AEVION QBuild (стройка/инженерия).
Тебе дают полный текст вакансии. Оцени её качество с точки зрения кандидата.

Ответь СТРОГО валидным JSON, без markdown, без бэктиков, без преамбулы:
{
  "score": <0..100, целое число>,
  "strengths": ["<плюс 1>", "<плюс 2>"],   // 2–4 коротких bullet
  "suggestions": ["<совет 1>", "<совет 2>"] // 3–5 коротких конкретных bullet
}

Критерии оценки:
- Указана ли зарплата / вилка (без неё − 25 баллов)
- Конкретность задач (не "выполнение работ", а "монтаж металлоконструкций до 3 тонн")
- Условия: смены, оплата, проживание, спецодежда
- Требования: опыт в годах, сертификаты, инструменты
- Длина: меньше 200 символов = плохо, больше 3000 = тоже плохо

Тон советов — деловой, без вежливых преамбул, прямые рекомендации.
Язык ответа — русский.`,
      messages: [{ role: "user", content: lines }],
      maxTokens: 600,
      cacheSystem: false,
    });

    let parsed: { score: number; strengths: string[]; suggestions: string[] } | null = null;
    try {
      const txt = reply.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      parsed = JSON.parse(txt);
    } catch {
      /* fall through */
    }
    if (!parsed || typeof parsed.score !== "number") {
      return fail(res, 502, "ai_response_unparseable", { raw: reply.text.slice(0, 200) });
    }

    return ok(res, {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      strengths: (parsed.strengths || []).slice(0, 5).map(String),
      suggestions: (parsed.suggestions || []).slice(0, 5).map(String),
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_vacancy_feedback_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/dm-suggest — 3 short reply suggestions for a DM thread.
// Body: { peerId: string }. Reads the last ~10 messages between auth.sub and peerId.
aiRouter.post("/dm-suggest", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const peerId = vString(req.body?.peerId, "peerId", { min: 1, max: 64 });
    if (!peerId.ok) return fail(res, 400, peerId.error);

    const r = await pool.query(
      `SELECT m."senderId", m."content", m."createdAt"
       FROM "BuildMessage" m
       WHERE (m."senderId" = $1 AND m."receiverId" = $2)
          OR (m."senderId" = $2 AND m."receiverId" = $1)
       ORDER BY m."createdAt" DESC LIMIT 10`,
      [auth.sub, peerId.value],
    );
    const ordered = r.rows.reverse();
    if (ordered.length === 0) {
      // Fresh thread — return universal openers without burning a Claude call.
      return ok(res, {
        suggestions: [
          "Здравствуйте! Спасибо за интерес к нашей вакансии. Когда вам удобно созвониться?",
          "Здравствуйте! Подскажите, пожалуйста, ваш опыт работы и желаемый выход на смены.",
          "Здравствуйте! Готовы пообщаться по деталям — хотите Zoom или офис?",
        ],
        cached: true,
      });
    }

    const transcript = ordered
      .map((m: { senderId: string; content: string }) =>
        `${m.senderId === auth.sub ? "Я" : "Собеседник"}: ${m.content}`,
      )
      .join("\n")
      .slice(-3000);

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — ассистент рекрутера на платформе AEVION QBuild.
Тебе дают переписку между рекрутером ("Я") и кандидатом/работодателем ("Собеседник").
Предложи 3 коротких реплики (1–2 предложения каждая), которые рекрутер может отправить следующим сообщением.

Ответь строго JSON-массивом из 3 строк, без markdown:
["вариант 1", "вариант 2", "вариант 3"]

Реплики должны:
- продвигать диалог (предложить созвон, уточнить детали, договориться о слоте)
- быть на том же языке, что и последнее сообщение собеседника
- избегать общих фраз вроде "Спасибо за информацию"
- быть готовы к отправке как есть, без правок`,
      messages: [{ role: "user", content: transcript }],
      maxTokens: 400,
      cacheSystem: false,
    });

    let suggestions: string[] = [];
    try {
      const txt = reply.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      const arr = JSON.parse(txt);
      if (Array.isArray(arr)) suggestions = arr.map(String).slice(0, 3);
    } catch {
      /* ignore */
    }
    if (suggestions.length === 0) {
      return fail(res, 502, "ai_response_unparseable", { raw: reply.text.slice(0, 200) });
    }

    return ok(res, {
      suggestions,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_dm_suggest_failed", { details: (err as Error).message });
  }
});
