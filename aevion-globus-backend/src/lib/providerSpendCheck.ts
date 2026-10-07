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

/**
 * Gemini спрашиваем в два шага, и это не перестраховка.
 *
 * Живой замер 05.10.2026, через час после выкатки этой самой проверки:
 * `gemini → ответ не разобран, HTTP 404`. Имя модели в коде (`gemini-2.0-flash`)
 * у нашего ключа не существует, и проверка честно отвечала «НЕ ЗНАЮ» — лучше,
 * чем зелёный обман, но вопрос «есть ли деньги» оставался без ответа навсегда.
 *
 * Жёстко вписать другое имя — значит повторить ошибку: имена моделей у Google
 * меняются и уходят в отставку, а проверка должна пережить отставку. Поэтому на
 * 404 (и только на него) спрашиваем СПИСОК моделей и берём первую, умеющую
 * generateContent. Список бесплатен, сам по себе про деньги не отвечает — он
 * нужен лишь чтобы знать, у кого спросить.
 */
async function вызовGemini(
  модель: string,
  ключ: string,
  fetchFn: typeof fetch,
): Promise<ОтветПоставщика> {
  const r = await fetchFn(
    `https://generativelanguage.googleapis.com/v1beta/models/${модель}:generateContent?key=${ключ}`,
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

/** Первое имя модели, умеющей generateContent. null — спросить не вышло. */
async function перваяЖиваяМодель(ключ: string, fetchFn: typeof fetch): Promise<string | null> {
  try {
    const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models?key=${ключ}`);
    if (!r.ok) return null;
    const j = JSON.parse(await r.text()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    const годная = (j.models ?? []).find((m) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"),
    );
    if (!годная?.name) return null;
    // Приходит "models/gemini-...", а в адрес нужна часть после "models/".
    return годная.name.replace(/^models\//, "");
  } catch {
    return null;
  }
}

export async function запросGemini(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<ОтветПоставщика> {
  const ключ = String(env.GEMINI_API_KEY ?? "");
  const первый = await вызовGemini(env.GEMINI_MODEL || "gemini-flash-latest", ключ, fetchFn);
  if (первый.status !== 404) return первый;
  const имя = await перваяЖиваяМодель(ключ, fetchFn);
  // Имени не нашлось — отдаём ПЕРВЫЙ ответ как есть. Выдумывать «ok» здесь
  // нельзя: 404 означает, что про деньги мы так и не спросили.
  if (!имя) return первый;
  return вызовGemini(имя, ключ, fetchFn);
}

// ── ElevenLabs: тут деньги ВИДНЫ, и не спрашивать их было бы ленью ──────────
//
// Повод тот же, что и у всей этой проверки, но с другого конца. Ручка
// `/v1/user/subscription` отдаёт `character_count` и `character_limit` — то
// есть прямой ответ на вопрос «можно ли ещё озвучивать». Код смотрел только на
// HTTP 200 и писал «key valid», оставляя числа лежать в теле нетронутыми.
//
// Платного вызова здесь НЕ нужно: ответ бесплатен и точен. Это тот редкий
// случай, когда дорогой вопрос стоит дешевле дешёвого.

export function разборElevenLabs(ответ: ОтветПоставщика): { состояние: СостояниеРасхода; detail: string } {
  if (ответ.status === 401 || ответ.status === 403) {
    return { состояние: "ключ плох", detail: подпись("ключ плох") };
  }
  if (ответ.status < 200 || ответ.status >= 300) {
    return { состояние: "непонятно", detail: `ответ ${ответ.status}, остаток знаков не прочитан` };
  }
  let тело: { character_count?: number; character_limit?: number; status?: string };
  try {
    тело = JSON.parse(ответ.body || "{}");
  } catch {
    // Тело не разобралось — это «не знаю», а не «всё хорошо».
    return { состояние: "непонятно", detail: "ответ 200, но тело не разобрано" };
  }
  const потрачено = Number(тело.character_count);
  const предел = Number(тело.character_limit);
  // Нет чисел — значит ответили не тем, чем мы думали. Выдавать это за «деньги
  // есть» нельзя: именно так и появляется зелёный кружок при пустом счёте.
  if (!Number.isFinite(потрачено) || !Number.isFinite(предел) || предел <= 0) {
    return { состояние: "непонятно", detail: "ответ 200, но остатка знаков в нём нет" };
  }
  const осталось = предел - потрачено;
  if (осталось <= 0) {
    return { состояние: "нет денег", detail: `ЗНАКИ КОНЧИЛИСЬ: ${потрачено} из ${предел}` };
  }
  return { состояние: "ok", detail: `осталось ${осталось} знаков из ${предел}` };
}

/**
 * Можно ли ещё озвучивать — С КЭШЕМ и своим разборщиком.
 *
 * 🔴 06.10.2026. Почему нельзя взять общую `проверитьРасход`: она классифицирует
 * ответ правилом `классифицировать`, а оно на любом 2xx отвечает «ok». У ElevenLabs
 * исчерпанный пакет приходит с HTTP **200**, и остаток лежит в теле
 * (`character_count` / `character_limit`) — ровно тот случай, из-за которого рядом и
 * написан `разборElevenLabs`. Общая проверка сказала бы «ok» при кончившихся знаках.
 *
 * Кэш — ТОТ ЖЕ, что у `проверитьРасход` (ключ «elevenlabs»): второго кэша с собственным
 * сроком жизни не появляется, иначе два механизма отвечали бы по-разному про одного
 * поставщика. Запрос бесплатный, но на каждую озвучку ходить к нему незачем.
 */
export async function проверитьElevenLabs(
  опции: { сейчас?: number; жизньМс?: number; запрос?: () => Promise<ОтветПоставщика> } = {},
): Promise<ИтогПроверки> {
  const сейчас = опции.сейчас ?? Date.now();
  const жизнь = опции.жизньМс ?? жизньКэшаМс();
  const было = кэш.get("elevenlabs");
  if (было && сейчас - было.когда < жизнь) {
    return { состояние: было.состояние, detail: было.detail + " (из кэша)", изКэша: true };
  }
  let состояние: СостояниеРасхода;
  let detail: string;
  try {
    const ответ = await (опции.запрос ?? (() => запросElevenLabs()))();
    const итог = разборElevenLabs(ответ);
    состояние = итог.состояние;
    detail = итог.detail;
  } catch (e: unknown) {
    // Сеть упала — это «не знаю», а не «нет денег» и не «ok» (§14: три исхода).
    состояние = "непонятно";
    detail = `запрос не выполнен: ${String((e as Error)?.message ?? e).slice(0, 60)}`;
  }
  кэш.set("elevenlabs", { когда: сейчас, состояние, detail });
  return { состояние, detail, изКэша: false };
}

export async function запросElevenLabs(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<ОтветПоставщика> {
  const r = await fetchFn("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": String(env.ELEVENLABS_API_KEY ?? "") },
  });
  return { status: r.status, body: await r.text().catch(() => "") };
}

// ── Brevo: остаток писем лежит в теле /v3/account и до 06.10 не читался ─────
//
// Повод. 05.10 в 14:22 Brevo прислал «Your Brevo API keys have been marked as
// inactive». Наша проверка в это же время отвечала `brevo: ok, HTTP 200`,
// потому что смотрела ТОЛЬКО на код ответа. Ключ действительно отвечает — но
// «ключ годен» и «письма уйдут» это разные утверждения, и через Brevo у нас
// идёт сбор адресов со всех витрин.
//
// Форма ответа: `plan` — массив записей вида
// `{ type: "free" | "subscription" | "sms" | …, creditsType: "sendLimit", credits: N }`.
// Про письма отвечает запись с `creditsType: "sendLimit"`; записи по SMS к
// почте отношения не имеют и в расчёт не берутся.

interface ЗаписьПлана { type?: string; creditsType?: string; credits?: number }

export function разборBrevo(ответ: ОтветПоставщика): { состояние: СостояниеРасхода; detail: string } {
  if (ответ.status === 401 || ответ.status === 403) {
    return { состояние: "ключ плох", detail: подпись("ключ плох") + ` [HTTP ${ответ.status}]` };
  }
  if (ответ.status < 200 || ответ.status >= 300) {
    return { состояние: "непонятно", detail: `ответ ${ответ.status}, остаток писем не прочитан` };
  }
  let тело: { plan?: ЗаписьПлана[] };
  try {
    тело = JSON.parse(ответ.body || "{}");
  } catch {
    return { состояние: "непонятно", detail: "ответ 200, но тело не разобрано" };
  }
  const план = Array.isArray(тело.plan) ? тело.plan : [];
  const почтовые = план.filter((p) => p && p.creditsType === "sendLimit" && Number.isFinite(Number(p.credits)));
  if (!почтовые.length) {
    // Тариф без счётчика писем (безлимитный или иная форма ответа) — честное
    // «не знаю». Красить зелёным нельзя: именно так и прошёл незамеченным
    // отключённый ключ.
    return { состояние: "непонятно", detail: "ответ 200, но остатка писем в нём нет" };
  }
  const осталось = почтовые.reduce((s, p) => s + Number(p.credits), 0);
  if (осталось <= 0) {
    return { состояние: "нет денег", detail: `ПИСЬМА КОНЧИЛИСЬ: остаток ${осталось}` };
  }
  return { состояние: "ok", detail: `осталось ${осталось} писем` };
}

export async function запросBrevo(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<ОтветПоставщика> {
  const r = await fetchFn("https://api.brevo.com/v3/account", {
    headers: { "api-key": String(env.BREVO_API_KEY ?? ""), accept: "application/json" },
  });
  return { status: r.status, body: await r.text().catch(() => "") };
}
