import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
    return ipKeyGenerator(req.ip ?? "::1");
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

// POST /api/build/ai/generate-vacancy — turn a one-line brief into a
// structured BuildVacancy draft (title + skills[] + description +
// salary range guess). Recruiter UI calls this from the "create vacancy"
// flow so they don't have to fight a blank textarea.
aiRouter.post("/generate-vacancy", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const brief = vString(req.body?.brief, "brief", { min: 5, max: 800 });
    if (!brief.ok) return fail(res, 400, brief.error);
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100);
    const localeRaw = typeof req.body?.locale === "string" ? req.body.locale : "ru";
    const locale = ["ru", "en", "kz"].includes(localeRaw) ? localeRaw : "ru";

    const { callClaude } = await import("../../lib/build/ai");

    const sys = `Ты — HR-эксперт стройплощадки на платформе AEVION QBuild.
Получаешь короткий бриф вакансии от работодателя и возвращаешь СТРОГИЙ JSON со схемой:
{
  "title": string,            // 4–80 символов, конкретно (не "Сотрудник", а "Сварщик 5 разряда")
  "skills": string[],         // 3–8 конкретных навыков
  "description": string,      // 60–800 символов: задачи, требования, условия (смены, оплата, тип занятости)
  "salaryMin": number|null,   // оценка по рынку, ${city ? `город: ${city}` : "Россия/СНГ"}
  "salaryMax": number|null,
  "salaryCurrency": "RUB"|"KZT"|"USD",
  "questions": string[]       // 3–5 коротких квалификационных вопросов кандидату
}

Правила:
- Не выдумывай факты, которых нет в брифе. Если не указано "сменно/вахта" — пиши "обсуждаемо".
- Зарплата — вилка по рынку, не точная цифра. Если бриф не упоминает уровень — bias к низу–середине.
- Язык всех полей: ${locale === "en" ? "English" : locale === "kz" ? "Kazakh (cyrillic)" : "Russian"}.
- Никакого markdown, никакого text вне JSON. Только raw JSON.
- Не пиши \`\`\`json\`\`\`-обёртку.`;

    const reply = await callClaude({
      systemPrompt: sys,
      messages: [{ role: "user", content: brief.value }],
      maxTokens: 1024,
      cacheSystem: true,
    });

    const cleaned = reply.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return fail(res, 502, "ai_returned_invalid_json", {
        sample: cleaned.slice(0, 200),
      });
    }
    return ok(res, {
      draft: parsed,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_generate_vacancy_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/match-vacancy — score how well a candidate profile
// matches a vacancy. UI on /build/ai-match shows the score + breakdown.
aiRouter.post("/match-vacancy", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const profileText = vString(req.body?.profileText, "profileText", { min: 20, max: 4000 });
    if (!profileText.ok) return fail(res, 400, profileText.error);
    const vacancyText = vString(req.body?.vacancyText, "vacancyText", { min: 20, max: 4000 });
    if (!vacancyText.ok) return fail(res, 400, vacancyText.error);

    const { callClaude } = await import("../../lib/build/ai");
    const sys = `Ты — рекрутер на стройплощадке платформы AEVION QBuild.
Получаешь две блока текста: профиль кандидата и описание вакансии. Возвращаешь СТРОГИЙ JSON:
{
  "score": number,             // 0-100, насколько профиль подходит
  "label": string,              // короткая метка ("Сильное совпадение", "Частичное", "Не подходит")
  "strengths": string[],        // 2-5 пунктов, что у кандидата совпадает с требованиями
  "gaps": string[],             // 0-5 пунктов, чего не хватает
  "tip": string                 // одно предложение совета кандидату для отклика
}

Правила:
- Не выдумывай факты, которых нет в текстах. Если в профиле нет упоминания навыка — это gap.
- score < 50 ⇒ label "Не подходит"; 50-79 ⇒ "Частичное совпадение"; 80+ ⇒ "Сильное совпадение".
- Никакого markdown, никакой обёртки \`\`\`json\`\`\`. Только raw JSON.
- Язык ответа: русский.`;

    const reply = await callClaude({
      systemPrompt: sys,
      messages: [{ role: "user", content: `ПРОФИЛЬ:\n${profileText.value}\n\n---\n\nВАКАНСИЯ:\n${vacancyText.value}` }],
      maxTokens: 800,
      cacheSystem: true,
    });

    const cleaned = reply.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return fail(res, 502, "ai_returned_invalid_json", { sample: cleaned.slice(0, 200) });
    }
    return ok(res, {
      match: parsed,
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_match_vacancy_failed", { details: (err as Error).message });
  }
});

// POST /api/build/ai/cover-letter — generate a tailored cover letter from
// profile + vacancy. UI on /build/ai-match offers tone presets.
aiRouter.post("/cover-letter", aiRateLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const profileText = vString(req.body?.profileText, "profileText", { min: 20, max: 4000 });
    if (!profileText.ok) return fail(res, 400, profileText.error);
    const vacancyText = vString(req.body?.vacancyText, "vacancyText", { min: 20, max: 4000 });
    if (!vacancyText.ok) return fail(res, 400, vacancyText.error);
    const toneRaw = typeof req.body?.tone === "string" ? req.body.tone : "professional";
    const tone = ["professional", "friendly", "concise"].includes(toneRaw) ? toneRaw : "professional";

    const toneGuide: Record<string, string> = {
      professional: "Деловой тон. Сухо, по делу, без эмоций. 4-6 предложений.",
      friendly: "Тёплый дружелюбный тон, но без панибратства. 4-6 предложений.",
      concise: "Максимально коротко: 2-3 предложения. Только опыт + готов начать.",
    };

    const { callClaude } = await import("../../lib/build/ai");
    const reply = await callClaude({
      systemPrompt: `Ты — редактор сопроводительных писем для строителей на платформе AEVION QBuild.
Получаешь профиль кандидата и описание вакансии. Возвращаешь готовое сопроводительное письмо ПРОСТЫМ ТЕКСТОМ (без markdown, без подписи "С уважением, ...", без email-шапки).

${toneGuide[tone]}

Правила:
- Используй только факты из профиля. Не выдумывай работодателей, годы, проекты.
- Связывай конкретные навыки кандидата с конкретными требованиями вакансии.
- Без преамбулы вроде "Вот письмо:". Только сам текст.
- Язык: русский.`,
      messages: [{ role: "user", content: `ПРОФИЛЬ:\n${profileText.value}\n\n---\n\nВАКАНСИЯ:\n${vacancyText.value}` }],
      maxTokens: 800,
      cacheSystem: true,
    });

    return ok(res, {
      coverLetter: reply.text.trim(),
      usage: { input: reply.inputTokens, output: reply.outputTokens },
    });
  } catch (err: unknown) {
    return fail(res, 500, "ai_cover_letter_failed", { details: (err as Error).message });
  }
});
