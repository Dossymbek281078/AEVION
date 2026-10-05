/**
 * Отличает «ключ годен» от «этим ключом можно тратить».
 *
 * Повод. 26.09–03.10 в Sentry дважды прилетело
 * `openai 429: insufficient_quota / credit_balance_exhausted`, а наша проверка
 * провайдеров в это же время отвечала `openai: ok` с honest-пометкой
 * «key valid (billing not visible here)». Мы спрашивали у поставщика
 * «не отозван ли ключ», а знать надо было «есть ли деньги». Признак отвечал на
 * другой вопрос, чем тот, который задаёт панель, — и отказ был виден только
 * постфактум и только тому, кто смотрит в Sentry.
 *
 * Что делает этот модуль: шлёт САМЫЙ ДЕШЁВЫЙ настоящий запрос (один токен на
 * выходе) и разбирает ответ по смыслу:
 *
 *   200                      → `ok`          — ключ годен и деньги есть
 *   429 + признак квоты      → `нет денег`   — ключ годен, тратить нечем
 *   429 без признака квоты   → `предел`      — упёрлись в частоту, не в деньги
 *   400 + признак баланса    → `нет денег`   — так отвечает Anthropic
 *   401 / 403                → `ключ плох`
 *   остальное                → `непонятно`   — честнее, чем врать «ok»
 *
 * ⚠️ Почему «предел» и «нет денег» разведены. У Gemini бесплатный уровень
 * отдаёт 429 и при нехватке денег, и при превышении частоты. Склеить их в
 * «нет денег» значит звать основателя платить там, где надо просто подождать.
 */

export type СостояниеРасхода = "ok" | "нет денег" | "предел" | "ключ плох" | "непонятно";

export interface ОтветПоставщика {
  status: number;
  /** сырое тело; разбирается как текст, потому что у поставщиков разная форма */
  body: string;
}

/** Слова, которыми поставщики говорят «денег нет». Проверено по их докам и по нашему Sentry. */
const ПРИЗНАКИ_ДЕНЕГ = [
  "insufficient_quota",
  "credit_balance_exhausted",
  "credit balance is too low",
  "billing_not_active",
  "exceeded your current quota",
  "quota exceeded for quota metric", // Gemini: биллинговая квота проекта
];

/** Слова, которыми поставщики говорят «слишком часто». Это НЕ про деньги. */
const ПРИЗНАКИ_ЧАСТОТЫ = [
  "rate_limit_exceeded",
  "rate limit",
  "too many requests",
  "requests per minute",
  "resource_exhausted", // Gemini отдаёт его и на частоту тоже
];

export function классифицировать(ответ: ОтветПоставщика): СостояниеРасхода {
  const тело = (ответ.body || "").toLowerCase();
  const естьДеньгиСлова = ПРИЗНАКИ_ДЕНЕГ.some((с) => тело.includes(с));
  const естьЧастотаСлова = ПРИЗНАКИ_ЧАСТОТЫ.some((с) => тело.includes(с));

  if (ответ.status === 401 || ответ.status === 403) return "ключ плох";
  // Деньги проверяем ПЕРВЫМИ: у Gemini в теле могут стоять оба признака сразу,
  // и «нет денег» — более дорогая для нас новость, терять её нельзя.
  if (естьДеньгиСлова) return "нет денег";
  // 429 без слов про деньги — это частота. Слова про деньги уже разобраны выше,
  // поэтому тернарник здесь был бы враньём: обе ветки дают одно и то же.
  if (ответ.status === 429) return "предел";
  if (ответ.status === 400 && естьЧастотаСлова) return "предел";
  if (ответ.status >= 200 && ответ.status < 300) return "ok";
  return "непонятно";
}

/** Человеческая подпись для панели — чтобы не читали коды. */
export function подпись(с: СостояниеРасхода): string {
  switch (с) {
    case "ok": return "ключ годен, деньги есть (проверено тратой 1 токена)";
    case "нет денег": return "КЛЮЧ ГОДЕН, НО ДЕНЕГ НЕТ — поставщик отказал по квоте";
    case "предел": return "упёрлись в частоту запросов, не в деньги";
    case "ключ плох": return "ключ не принят";
    default: return "ответ не разобран — считаем, что НЕ ЗНАЕМ";
  }
}

/** ok для панели выставляем только при настоящем «ok»: «не знаю» зелёным не красим. */
export function этоОк(с: СостояниеРасхода): boolean {
  return с === "ok";
}

// ── кэш, чтобы не тратить деньги на каждый заход ────────────────────────────
//
// Живёт в памяти процесса: при выкатке сбрасывается, и это честно — после
// выкатки первая проверка снова настоящая. Хранить в базе смысла нет, вопрос
// «есть ли деньги» протухает быстрее, чем любой учёт.

interface ЗаписьКэша { когда: number; состояние: СостояниеРасхода; detail: string }
const кэш = new Map<string, ЗаписьКэша>();

/** Сколько часов верим прошлой проверке. Переменной — чтобы менять без выкатки. */
export function жизньКэшаМс(env: NodeJS.ProcessEnv = process.env): number {
  const ч = Number(env.PROVIDER_SPEND_CHECK_HOURS);
  return (Number.isFinite(ч) && ч > 0 ? ч : 6) * 3600_000;
}

/** Только для тестов: забыть всё, что помнили. */
export function забытьКэш(): void { кэш.clear(); }

export interface ИтогПроверки {
  состояние: СостояниеРасхода;
  detail: string;
  /** взято из кэша, а не спрошено заново */
  изКэша: boolean;
}

/**
 * Спросить поставщика, можно ли тратить.
 *
 * `запрос` отдаётся снаружи — так модуль проверяется мок-ответами, без сети и
 * без денег. `сейчас` тоже снаружи: иначе проверку кэша пришлось бы ждать часами.
 */
export async function проверитьРасход(
  поставщик: string,
  запрос: () => Promise<ОтветПоставщика>,
  опции: { сейчас?: number; жизньМс?: number } = {},
): Promise<ИтогПроверки> {
  const сейчас = опции.сейчас ?? Date.now();
  const жизнь = опции.жизньМс ?? жизньКэшаМс();
  const было = кэш.get(поставщик);
  if (было && сейчас - было.когда < жизнь) {
    return { состояние: было.состояние, detail: было.detail + " (из кэша)", изКэша: true };
  }
  let состояние: СостояниеРасхода;
  let хвост = "";
  try {
    const ответ = await запрос();
    состояние = классифицировать(ответ);
    хвост = ` [HTTP ${ответ.status}]`;
  } catch (e: any) {
    // Сеть упала — это НЕ «нет денег» и НЕ «ok». Говорим «не знаю».
    состояние = "непонятно";
    хвост = ` [${String(e?.message ?? e).slice(0, 60)}]`;
  }
  const detail = подпись(состояние) + хвост;
  кэш.set(поставщик, { когда: сейчас, состояние, detail });
  return { состояние, detail, изКэша: false };
}

// ── самые дешёвые запросы к каждому поставщику ──────────────────────────────
//
// Везде просим ОДИН токен на выходе. Это настоящий платный вызов, иначе он не
// ответил бы на вопрос о деньгах, но цена его — доли цента.

export async function запросOpenAI(env: NodeJS.ProcessEnv = process.env): Promise<ОтветПоставщика> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    }),
  });
  return { status: r.status, body: await r.text().catch(() => "") };
}

export async function запросAnthropic(env: NodeJS.ProcessEnv = process.env): Promise<ОтветПоставщика> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": String(env.ANTHROPIC_API_KEY ?? ""),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    }),
  });
  return { status: r.status, body: await r.text().catch(() => "") };
}

export async function запросGemini(env: NodeJS.ProcessEnv = process.env): Promise<ОтветПоставщика> {
  const модель = env.GEMINI_MODEL || "gemini-2.0-flash";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${модель}:generateContent?key=${env.GEMINI_API_KEY ?? ""}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "." }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    },
  );
  return { status: r.status, body: await r.text().catch(() => "") };
}
