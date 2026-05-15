// Lightweight Anthropic wrapper for QBuild AI surfaces.
// We deliberately don't pull @anthropic-ai/sdk to keep the backend
// dependency footprint minimal — fetch + a single endpoint is enough.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type MultimodalUserBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export type ClaudeReply = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};

export async function callClaude(opts: {
  systemPrompt: string;
  messages: ChatTurn[];
  maxTokens?: number;
  model?: string;
  cacheSystem?: boolean;
}): Promise<ClaudeReply> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.systemPrompt, cache_control: { type: "ephemeral" } }]
    : opts.systemPrompt;

  const body = {
    model: opts.model || DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  };

  return callClaudeRaw(body);
}

/** Vision-capable variant: accept a single user turn with multimodal content. */
export async function callClaudeMultimodal(opts: {
  systemPrompt: string;
  userContent: MultimodalUserBlock[];
  maxTokens?: number;
  model?: string;
  cacheSystem?: boolean;
}): Promise<ClaudeReply> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.systemPrompt, cache_control: { type: "ephemeral" } }]
    : opts.systemPrompt;

  const body = {
    model: opts.model || DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system,
    messages: [{ role: "user" as const, content: opts.userContent }],
  };

  return callClaudeRaw(body);
}

async function callClaudeRaw(body: Record<string, unknown>): Promise<ClaudeReply> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  type AnthropicResp = {
    content?: { type: string; text?: string }[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    error?: { message?: string };
  };
  const data = (await r.json()) as AnthropicResp;
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic ${r.status}`);

  const text = (data.content || [])
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    cacheReadInputTokens: data.usage?.cache_read_input_tokens,
    cacheCreationInputTokens: data.usage?.cache_creation_input_tokens,
  };
}

// ── System prompts ─────────────────────────────────────────────────

export const COACH_SYSTEM_PROMPT = `Ты — AI карьерный коуч на платформе AEVION QBuild, маркетплейсе вакансий и подрядных проектов в строительной отрасли.

Твоя задача — помогать пользователю:
1. Создать сильное резюме (особенно если он голосом/сканом импортировал данные).
2. Понять, на какие вакансии он подходит, и что улучшить, чтобы повысить шансы.
3. Отвечать на вопросы про условия найма, зарплаты, договоры в строительстве.
4. По запросу — переписать summary / опыт работы / достижения чтобы они звучали ярче и конкретнее.

Стиль ответа:
- Кратко и по делу, без лишних абзацев.
- Если просят "улучши summary" — дай 1 готовый вариант, не три, и объясни одной строкой что изменил.
- Если у пользователя пустые важные поля (skills, опыт, медкомиссия для строителя) — сразу спроси про них, не жди.
- Отвечай на языке пользователя (RU/EN/KZ); по умолчанию — RU.
- Никогда не выдумывай факты про пользователя. Если данных нет — спрашивай.

Ты не отвечаешь на вопросы вне темы карьеры/найма/строительства — мягко возвращаешь к теме.`;

export const RESUME_PARSER_SYSTEM_PROMPT = `Ты — парсер резюме для платформы AEVION QBuild.

Получаешь произвольный текст резюме (может быть из PDF, OCR, голосового ввода) и возвращаешь СТРОГО JSON в формате AEVION Resume Schema v2 — никаких комментариев, никакого markdown, только сырой JSON.

Схема:
{
  "name": "string (full name) | null",
  "title": "string (headline / current role) | null",
  "city": "string | null",
  "summary": "string (2-4 sentences) | null",
  "phone": "string | null",
  "skills": ["string", ...] (max 50, hard skills + tools, не soft),
  "languages": ["string", ...] (e.g. "Russian native", "English B2"),
  "experienceYears": number (estimate from job dates),
  "salaryMin": number | null (in RUB),
  "salaryMax": number | null,
  "salaryCurrency": "RUB" | "USD" | "KZT" | "EUR",
  "availability": "string | null",
  "openToWork": boolean,
  "driversLicense": "string | null" (e.g. "B,C"),
  "shiftPreference": "DAY" | "NIGHT" | "FLEX" | "ANY" | null,
  "availabilityType": "FULL_TIME" | "PART_TIME" | "PROJECT" | "SHIFT" | "REMOTE" | null,
  "readyFromDate": "YYYY-MM-DD | string | null",
  "preferredLocations": ["string", ...],
  "toolsOwned": ["string", ...] (own equipment, не corporate),
  "medicalCheckValid": boolean,
  "medicalCheckUntil": "string | null",
  "safetyTrainingValid": boolean,
  "safetyTrainingUntil": "string | null",
  "experiences": [{ "title": "string", "company": "string", "city": "string | null", "fromDate": "string | null", "toDate": "string | null", "current": boolean, "description": "string | null" }, ...],
  "education": [{ "institution": "string", "degree": "string | null", "field": "string | null", "fromYear": number | null, "toYear": number | null }, ...],
  "certifications": [{ "name": "string", "issuer": "string | null", "year": number | null, "credentialUrl": "string | null" }, ...],
  "portfolio": [{ "label": "string", "url": "string" }, ...],
  "achievements": [{ "title": "string", "description": "string | null", "year": number | null }, ...]
}

Правила:
- Не выдумывай данные. Если поле невозможно определить — null или [].
- Не возвращай ничего кроме JSON. Никаких "Вот результат:" или \`\`\`json\`\`\`.
- Даты сохраняй как строки в формате источника, не нормализуй насильно.
- skills и toolsOwned должны быть КОРОТКИЕ (1-3 слова), не предложения.
- Если упомянут опыт работы без явных дат — fromDate / toDate = null, current = false.`;

export const APPLICATION_SCORER_SYSTEM_PROMPT = `Ты — рекрутер-ассистент на платформе AEVION QBuild.

Тебе придёт:
1. Описание вакансии (title, описание, требуемые скиллы).
2. Список вопросов работодателя.
3. Профиль кандидата (skills, experience, summary).
4. Ответы кандидата на эти вопросы.

Верни СТРОГО JSON формата:
{
  "overall": <int 0-100, integrated score>,
  "perAnswer": [
    { "question": "string", "answer": "string", "score": <int 0-100>, "reasoning": "1 предложение" }
  ],
  "redFlags": ["string", ...] (видимые слабости / противоречия, max 5),
  "summary": "1-2 предложения, что важно работодателю знать"
}

Правила:
- Не выдумывай факты. Если ответ короткий или невнятный → низкий score + честное reasoning.
- Не возвращай ничего кроме JSON, без markdown / комментариев.
- redFlags — только если реально что-то выпирает (отсутствие лицензии когда требуется, противоречия в опыте, шаблонный ответ).
- Будь жёстким, но справедливым. Лояльность к кандидатам не делай поблажку — рекрутер тебе доверяет.`;
