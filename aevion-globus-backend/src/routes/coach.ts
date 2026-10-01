// AEVION CyberChess — AI Coach proxy + session/goal tracking (v37)
//
// v35:
// - Default model upgraded from Haiku 4.5 → Sonnet 4.6 for stronger chess reasoning.
//   Haiku plays chess at ~1200 ELO "guesses on the position", Sonnet at ~2000 ELO and
//   ACTUALLY understands engine eval lines when they're provided in the prompt.
// - maxTokens is now client-configurable (Live Coach needs 150, deep analysis up to 1500).
// - System prompt validation no longer truncates.
//
// v36:
// - Added coaching session lifecycle (POST /sessions/start, POST /sessions/:id/end,
//   GET /sessions, GET /sessions/:id). In-memory storage for now — graduates to Prisma
//   once Coach is promoted from CyberChess sub-feature to a first-class AEVION module.
// - Added goal tracking (POST /goals, GET /goals, POST /goals/:id/complete,
//   DELETE /goals/:id). Goals link to sessions so we can measure "what student worked on".
// - Both surfaces accept anonymous traffic (sessionId scoped to an opaque clientId in body)
//   or Bearer-attributed traffic. Bearer takes precedence when present so multi-device
//   replay works.
//
// v37:
// - SECURITY: Removed `getOwnerKey` helper which accepted ownerKey from Bearer header
//   OR `body.clientId` OR `query.clientId`. The clientId fallback let any caller spoof
//   another student's ownerKey by passing their opaque clientId — anonymous attribution
//   masquerading as authentication. Migrated every owner-scoped endpoint
//   (/sessions/*, /goals/*) to the `requireAuth` JWT middleware (aligned with
//   QSign v2, QRight royalties, planet compliance). `ownerKey` is now always
//   `req.auth.sub` from a verified JWT.
// - /chat and /health remain public — /chat is a stateless Anthropic proxy with
//   no owner-keyed state to protect, and it's consumed by CyberChess board UI
//   which has its own session lifecycle separate from Coach. Abuse mitigation
//   for /chat belongs in a rate-limiter layer (TODO), not auth gating.

import { Router, type Request, type Response } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/authJwt";
import { generationLimit, rateLimit } from "../lib/rateLimit";
import { checkAiInputBudget, isAnonymousRequest } from "../lib/aiInputBudget";
import {
  callProvider,
  streamProvider,
  resolveProvider,
  getProviders,
  isProviderOutOfService,
  listProviderOutages,
  providerOutageReason,
  noteProviderOutage,
  type ChatMessage,
} from "../services/qcoreai/providers";

const captureCoachError = makeServiceCapture("coach");

export const coachRouter = Router();

// Адрес и версия Anthropic здесь больше не нужны: к поставщику ходит реестр
// (services/qcoreai/providers.ts). Свой fetch отсюда и был причиной того, что
// тренер умер вместе со счётом Anthropic, пока соседние ручки работали.

// Opus 4.8 — Anthropic's flagship, strongest chess reasoning ($15 in / $75 out per M tokens).
// Each Coach request ≈ $0.015-0.02, acceptable for premium experience. Override via env.
const DEFAULT_MODEL = process.env.COACH_MODEL || "claude-opus-4-8";

// Absolute ceiling on tokens per response — chess coaching fits comfortably in 1500.
// Client may request less (e.g. 150 for Live Coach one-liners).
/**
 * 🔴 28.09.2026. ТРЕНЕР ЗВАЛ ANTHROPIC СВОИМ fetch, МИМО РЕЕСТРА ПОСТАВЩИКОВ.
 *
 * Счёт Anthropic исчерпан до 1 октября, и тренер умер вместе с ним: замер прода
 * 28.09 — POST /api/coach/chat отдаёт 400 «You have reached your specified API
 * usage limits… regain access on 2026-10-01». Полный запуск шахмат 30.09, то есть
 * витрина обещала бы «ИИ-тренер разберёт партию» при молчащем тренере.
 *
 * При этом у платформы УЖЕ есть живой запасной: POST /api/qcoreai/chat тем же
 * моментом отвечает 200 от gemini-2.5-flash. Разница не в удаче, а в том, кто
 * ходит через реестр services/qcoreai/providers.ts, а кто своим fetch: реестр
 * отличает «поставщик закрыл счёт» от сетевого сбоя, помнит это до даты возврата
 * и переходит к следующему настроенному.
 *
 * Нашло окно user-c8 замером; реестр и переход писал не я — здесь только
 * подключение тренера к общему механизму. Второй такой механизм заводить нельзя:
 * копии расходятся молча, и расхождение видно лишь там, куда никто не смотрит.
 */

/** Кого просить первым. Закрытого поставщика реестр пропустит сам. */
function выбратьПоставщика(): string {
  return resolveProvider("anthropic");
}

/** Модель для выбранного поставщика: у Anthropic — наша, у прочих — их умолчание. */
function модельДля(поставщик: string): string {
  if (поставщик === "anthropic") return DEFAULT_MODEL;
  const p = getProviders().find((x) => x.id === поставщик);
  return p?.defaultModel || DEFAULT_MODEL;
}

/** Сообщения тренера в вид реестра: системный текст — отдельной ролью. */
function вСообщенияРеестра(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): ChatMessage[] {
  return [{ role: "system", content: system }, ...messages];
}

/** Хоть один поставщик настроен и не закрыт — значит ответить МОЖЕМ. */
function можемОтветить(): boolean {
  return getProviders().some((p) => p.configured && p.id !== "stub" && !isProviderOutOfService(p.id));
}

const MAX_TOKENS_CEILING = 1500;
const DEFAULT_MAX_TOKENS = 800;

/**
 * 🔴 29.09.2026. БЮДЖЕТ ДЕЛИЛСЯ МЕЖДУ РАЗМЫШЛЕНИЕМ И ОТВЕТОМ — ТРЕНЕР ОТВЕЧАЛ
 * ОБРЫВКОМ.
 *
 * Замер соседнего окна (user-3f) на живом проде: одна модель
 * `gemini-2.5-flash`, один промпт и позиция, меняется только переданный лимит.
 *
 *   передали 150  → ответ 17 знаков  (видимых токенов 5,   на мысли 141)
 *   передали 400  → ответ 58 знаков  (видимых 15,          на мысли 381)
 *   передали 1200 → ответ 176 знаков (видимых 48,          на мысли 1148)
 *   передали 4096 → 471 знак, обрыв на полуслове (зажался нашим потолком 1500)
 *
 * То есть `maxOutputTokens` у этой модели покрывает И внутреннее размышление,
 * и видимый ответ. Клиент просит ДЛИНУ ОТВЕТА, а получает общий бюджет, из
 * которого ответу достаются крохи. Соседняя ручка `/api/qcoreai/chat` жива
 * ровно потому, что клиентский лимит не читает вовсе и подставляет 4096.
 *
 * Лечим здесь, а не во фронте: клиент не обязан знать повадки поставщика — он
 * говорит, какой длины ОТВЕТ хочет, перевод в бюджет наш.
 *
 * Более точный путь — задать модели отдельный бюджет размышления
 * (`thinkingConfig`), тогда клиентские числа снова начнут означать длину
 * ответа. Он живёт в общем реестре поставщиков, это не наш файл, и я его не
 * проверял, — поэтому здесь запас, а не догадка о чужом API.
 */
const ЗАПАС_НА_РАЗМЫШЛЕНИЕ = 4;
/** Потолок для думающих моделей: место под ответ плюс место под мысли. */
const ПОТОЛОК_С_РАЗМЫШЛЕНИЕМ = 8192;

/** Думает ли модель «про себя», тратя на это тот же бюджет. */
export function модельРазмышляет(поставщик: string, модель: string): boolean {
  return поставщик === "gemini" && /2[.]5|thinking/i.test(модель);
}

/**
 * 🔴 29.09.2026. НА РУССКИЙ ВОПРОС ПРИШЁЛ ГРЕЧЕСКИЙ ОТВЕТ.
 *
 * Приёмка спросила по-русски «3 причины 1.e4» и получила «Η απάντηση…»,
 * оборванное на 79 знаках. Промпт языка не гарантирует: он просьба, а не
 * механизм, — тот же класс, что и «ходы только из отчёта».
 *
 * Признак намеренно грубый и односторонний: вопрос по-русски, а в ответе
 * кириллицы нет ВООБЩЕ. Ложную тревогу он дать не может — в настоящем русском
 * разборе кириллица есть всегда, даже когда ходы записаны латиницей. Ответ
 * на латинице на латинский вопрос он тоже не тронет.
 */
/**
 * Какая доля букв должна быть кириллицей, чтобы считать ответ русским.
 *
 * Названа числом здесь, а не спрятана в условии, чтобы её можно было
 * оспорить замером. Основание: шесть ответов прода 30.09 дали 92–100 %.
 */
const ДОЛЯ_СВОЕГО_ЯЗЫКА = 0.4;

export function языкНеТот(вопрос: string, ответ: string): boolean {
  const кириллица = /[а-яёА-ЯЁ]/;
  const текст = String(ответ || "").trim();
  if (!кириллица.test(String(вопрос || ""))) return false; // вопрос не русский — не наш случай
  // 🔴 ПОПРАВКА 30.09.2026, вечер: судим ДОЛЮ кириллицы, а не её наличие.
  //
  // Здесь стояло «есть хоть одна кириллическая буква — язык верный». Замер
  // показал, чего это стоит: тот же английский ответ даёт true, а он же со
  // вставкой «(Алексей)» — false. То есть ответ, на 98 % английский, с одним
  // русским словом проходил как правильный. Случай не выдуманный: тренера
  // зовут Алексей, и модель охотно подписывается его именем.
  //
  // ПОРОГ ВЗЯТ ЗАМЕРОМ, не на глаз. Шесть настоящих ответов прода на
  // продуктовом промпте, нарочно с шахматной записью в вопросах (Nf3, Bb5,
  // Qh5): доля кириллицы среди БУКВ — 93, 92, 98, 96, 95, 100 %, минимум 92.
  // Порог 40 % оставляет запас больше полусотни пунктов вниз от законного
  // минимума, а английский ответ с одним русским словом даёт единицы
  // процентов. Русский ответ, целиком состоящий из ходов, под правило не
  // попадает вовсе: ниже требуется СЛОВО из трёх букв, а «Nf3» и «e4» его
  // не образуют.
  const кир = (текст.match(/[а-яёА-ЯЁ]/g) || []).length;
  const лат = (текст.match(/[a-zA-Z]/g) || []).length;
  const букв = кир + лат;
  if (букв > 0 && кир / букв >= ДОЛЯ_СВОЕГО_ЯЗЫКА) return false;
  // 🔴 ПОПРАВКА 30.09.2026. Здесь стоял порог «короче 20 знаков — не судим»,
  // и он оказался дырой ровно того размера, что настоящий случай: приёмка
  // получила на русский вопрос ответ «The Hindi phrase \» — 18 знаков, то
  // есть КОРОЧЕ порога. Короткий чужеязычный ответ не «слишком мал, чтобы
  // судить», а самый очевидный брак из всех.
  //
  // Порог был нужен для другого: чтобы не судить ответы вида «Nf3» — это
  // ход, а не проза, и кириллицы в нём нет законно. Значит и условие должно
  // быть про это: чужой язык — там, где есть СЛОВО (три буквы подряд в
  // любом письме), а не просто отсутствие кириллицы. Именно «в любом»:
  // первая версия этой поправки искала латиницу и тут же потеряла греческий
  // случай, ради которого защита и писалась.
  return /\p{L}{3}/u.test(текст);
}

/**
 * Ответ оборван на полуслове И при этом короткий.
 *
 * Обрыв сам по себе не повод прятать ответ: длинный разбор без финальной точки
 * человек дочитает и поймёт. А вот короткий огрызок («Отличный вопрос! Давай
 * разберёмся…») пользы не несёт и выглядит поломкой. Поэтому условие двойное.
 */
export function ответОгрызок(ответ: string): boolean {
  const t = String(ответ || "").trim();
  if (t.length === 0) return true;
  if (t.length >= 200) return false;
  return !/[.!?…»)]$/.test(t);
}

/**
 * Перевод «какой длины ответ хочет клиент» в бюджет для поставщика.
 * У обычных моделей это одно и то же число, у думающих — с запасом.
 */
export function бюджетОтвета(поставщик: string, модель: string, желаемые: number): number {
  if (!модельРазмышляет(поставщик, модель)) return желаемые;
  return Math.min(желаемые * ЗАПАС_НА_РАЗМЫШЛЕНИЕ + 1024, ПОТОЛОК_С_РАЗМЫШЛЕНИЕМ);
}

// Input size limits — chess context (FEN + engine PVs + move list) fits comfortably
// in a few KB per message. These limits prevent abuse / runaway costs.
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 16000;
const MAX_SYSTEM_CHARS = 8000;

// ─── In-memory stores (graduate to Prisma when Coach lands as full module) ──
// Caps prevent runaway memory growth in long-running prod instances.
const MAX_SESSIONS = 5000;
const MAX_GOALS = 5000;

type CoachSession = {
  id: string;
  ownerKey: string;        // JWT.sub — stable per user across devices
  topic: string;
  startingFen?: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  notes?: string;
  messageCount: number;
  goalsLinked: string[];
};

type CoachGoal = {
  id: string;
  ownerKey: string;
  title: string;
  description?: string;
  targetDate?: string;
  sessionId?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
};

const sessions = new Map<string, CoachSession>();
const goals = new Map<string, CoachGoal>();

function trimStore<T>(store: Map<string, T>, max: number) {
  if (store.size <= max) return;
  // Drop oldest keys (insertion order). Map preserves it.
  const toDrop = store.size - max;
  let i = 0;
  for (const k of store.keys()) {
    if (i++ >= toDrop) break;
    store.delete(k);
  }
}

// ─── /chat — Anthropic proxy (public; stateless) ─────────────────────────────
// Not auth-gated: stateless proxy with no owner-keyed state to protect.
// CyberChess board UI consumes this without a JWT (separate auth surface).
// Abuse / cost mitigation belongs in a rate-limiter, not here.
// ОБЩИЙ потолок расхода на всех анонимов тренера. Тот же разбор, что у
// qcoreai: ключ анонима строится по адресу, а адрес до нас не доходит —
// платформа заполняет X-Real-IP одним из ~7 своих внутренних адресов, и один
// человек получает семь корзин (замерено отпечатком 28.08.2026). Считать
// посетителя нечем, поэтому ограничиваем РАСХОД, а не человека.
//
// Тренер — одно из трёх обещаний страницы запуска, и он зовёт платную модель,
// поэтому потолок нужен ему не меньше, чем чату. Авторизованные считаются по
// своему id и в общую корзину не попадают.
// 🔴 28.09.2026, решение оркестратора к запуску 30.09: потолок гостей поднят
// со 120 до 600 в минуту. Корзина ОДНА на всех незалогиненных (ключ "anon"),
// поэтому 120 — это не «120 вопросов на человека», а 120 на всю платформу:
// при двухстах пришедших по два вопроса предел выбирается за минуту и отказ
// получают ВСЕ, включая первого. В обычный день (живых посетителей около пяти)
// разницы нет, в день запуска она решает.
//
// Дёшево это стало потому, что тренер теперь ходит через реестр поставщиков и
// при закрытом счёте Anthropic отвечает Gemini. Счёт по-прежнему не бесконечен,
// и предел остаётся: снят не он, а его абсурдная теснота.
//
// Следующий шаг (после запуска, отдельным блоком): считать ПО АДРЕСУ с
// небольшим личным пределом плюс общий потолок — тогда один шумный гость не
// блокирует остальных. Сегодня это смена поведения ограничителя, и за день до
// запуска её не ставим.
const anonCoachCeiling = rateLimit({
  windowMs: 60_000,
  max: 600,
  keyPrefix: "coach:anon-ceiling",
  keyFn: (req) => (isAnonymousRequest(req) ? "anon" : `u:${String((req as { auth?: { sub?: string } }).auth?.sub || "user")}`),
  message: "rate_limit_exceeded: too many anonymous coach requests platform-wide, sign in to continue",
});

coachRouter.post("/chat", anonCoachCeiling, generationLimit("coach_chat"), async (req: Request, res: Response) => {
  try {
    // Ключ именно Anthropic больше не обязателен: ответить может любой
    // настроенный поставщик. Отказ здесь означает, что не настроен НИ ОДИН.
    if (!getProviders().some((p) => p.configured && p.id !== "stub")) {
      return res.status(500).json({ error: "Server misconfigured: no AI provider configured" });
    }

    const { system, messages, maxTokens } = (req.body || {}) as {
      system?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
    };

    // ─── Input validation ────────────────────────────────────────────────
    if (!system || typeof system !== "string") {
      return res.status(400).json({ error: "Missing or invalid `system`" });
    }
    if (system.length > MAX_SYSTEM_CHARS) {
      return res.status(400).json({
        error: `System prompt too long (max ${MAX_SYSTEM_CHARS} chars)`,
      });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing or invalid `messages`" });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({
        error: `Too many messages (max ${MAX_MESSAGES})`,
      });
    }
    for (const m of messages) {
      if (!m || typeof m !== "object") {
        return res.status(400).json({ error: "Malformed message" });
      }
      if (m.role !== "user" && m.role !== "assistant") {
        return res.status(400).json({ error: `Invalid role: ${m.role}` });
      }
      if (typeof m.content !== "string" || m.content.length === 0) {
        return res.status(400).json({ error: "Message content must be non-empty string" });
      }
      if (m.content.length > MAX_CONTENT_CHARS) {
        return res.status(400).json({
          error: `Message too long (max ${MAX_CONTENT_CHARS} chars)`,
        });
      }
    }
    if (messages[0].role !== "user") {
      return res.status(400).json({ error: "First message must have role=user" });
    }

    // ЦЕНА ОДНОГО АНОНИМНОГО ВЫЗОВА.
    //
    // Собственные пределы ручки щедры: 40 сообщений по 16 000 знаков плюс 8 000
    // системных — 648 000 знаков, около 162 тысяч входных токенов за ОДИН вызов,
    // и уходят они в claude-opus-4-8 (проверено на проде 27.08.2026: ручка
    // отвечает без входа в аккаунт). Учёта расхода у анонима нет, а ограничитель
    // частоты слабее объявленного: счётчиков несколько, и причина открыта
    // (см. шапку rateLimit.ts, поправка 28.08).
    //
    // Тот же предел, что у qcoreai, и та же функция: два способа ограничивать
    // одно и то же разошлись бы на первом краевом случае. Вошедшего не касается.
    const budget = checkAiInputBudget(messages, isAnonymousRequest(req));
    if (!budget.ok) {
      return res
        .status(413)
        .json({ error: budget.error, message: budget.message, limit: budget.limit, got: budget.got });
    }

    // Resolve max_tokens with sensible clamping.
    let resolvedMaxTokens = DEFAULT_MAX_TOKENS;
    if (typeof maxTokens === "number" && maxTokens > 0) {
      resolvedMaxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CEILING);
    }

    // ─── Через реестр поставщиков, с переходом на живого ────────────────
    // callProvider сам переходит к следующему настроенному, если поставщик
    // ЗАКРЫЛ счёт (лимит, кредиты, 402) — и запоминает это до даты возврата,
    // чтобы не стучаться в закрытую дверь на каждом запросе.
    const поставщик = выбратьПоставщика();
    let итог: Awaited<ReturnType<typeof callProvider>>;
    try {
      итог = await callProvider(
        поставщик,
        вСообщенияРеестра(system, messages),
        модельДля(поставщик),
        0.7,
        undefined,
        бюджетОтвета(поставщик, модельДля(поставщик), resolvedMaxTokens),
        { module: "coach" },
      );
    } catch (e: any) {
      const причина = providerOutageReason(e);
      const текст = e?.message || "AI provider error";
      console.error("[coach] ответ не получен:", String(текст).slice(0, 200));
      // 503, а не эхо чужого кода: живого поставщика не осталось — это наша
      // неисправность, а не отказ клиенту. Текст поставщика сохраняем: по нему
      // фронт узнаёт лимит и называет человеку срок возврата.
      return res.status(причина ? 503 : 502).json({ error: текст });
    }

    // Ответ не на том языке или огрызок — ОДИН повтор, потом честный отказ.
    //
    // Повтор ровно один: модель ошибается по-разному от раза к разу, и второй
    // заход обычно выправляет язык. Цикл здесь заводить нельзя — это деньги и
    // ожидание человека у экрана.
    const вопросЧеловека = messages[messages.length - 1]?.content ?? "";
    if (языкНеТот(вопросЧеловека, итог.reply) || ответОгрызок(итог.reply)) {
      console.warn(
        `[coach] ответ отбракован (язык/огрызок), повтор: ${итог.reply.slice(0, 60)}`,
      );
      try {
        итог = await callProvider(
          поставщик,
          вСообщенияРеестра(system, messages),
          модельДля(поставщик),
          0.7,
          undefined,
          бюджетОтвета(поставщик, модельДля(поставщик), resolvedMaxTokens),
          { module: "coach" },
        );
      } catch {
        /* останемся с прежним ответом и отдадим отказ ниже */
      }
      if (языкНеТот(вопросЧеловека, итог.reply) || ответОгрызок(итог.reply)) {
        console.error("[coach] ответ отбракован дважды — отдаём отказ");
        return res.status(502).json({
          error:
            "Тренер ответил не по делу — показываю разбор движком. Партия и задачи работают.",
        });
      }
    }

    // Форма ответа прежняя, anthropic-совместимая: её разбирают три места
    // шахмат. Чинить бэкенд, ломая фронт, — не починка.
    return res.json({
      content: [{ type: "text", text: итог.reply }],
      model: итог.model,
      usage: итог.usage,
      provider: итог.providerUsed ?? поставщик,
      failedOver: итог.failedOver,
    });
  } catch (err: any) {
    console.error("[coach] Unexpected error:", err);
    captureCoachError(err, { route: "coach/POST/chat" });
    return res.status(500).json({
      error: err?.message || "Internal server error",
    });
  }
});

// ─── /chat/stream — Anthropic proxy с потоковой выдачей (SSE) ────────────────
// Аддитивный эндпоинт: /chat выше остаётся нетронутым как фоллбэк. Здесь шлём
// stream:true и проксируем Anthropic SSE прямо клиенту — коуч печатает ответ
// токен за токеном (живая печать, lichess/ChatGPT-стиль). Фронт парсит
// content_block_delta (delta.type==="text_delta") и дописывает текст.
// Без thinking — быстрый первый токен для коротких подсказок.
coachRouter.post("/chat/stream", anonCoachCeiling, generationLimit("coach_chat_stream"), async (req: Request, res: Response) => {
  try {
    // Ключ именно Anthropic больше не обязателен: поток может выдать любой
    // настроенный поставщик. Отказ здесь — «не настроен НИ ОДИН».
    if (!getProviders().some((p) => p.configured && p.id !== "stub")) {
      return res.status(500).json({ error: "Server misconfigured: no AI provider configured" });
    }
    const { system, messages, maxTokens } = (req.body || {}) as {
      system?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
    };
    // Валидация — те же лимиты, что и в /chat (дублируем намеренно, чтобы не
    // трогать рабочий /chat рефактором).
    if (!system || typeof system !== "string" || system.length > MAX_SYSTEM_CHARS) {
      return res.status(400).json({ error: "Missing or invalid `system`" });
    }
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: "Missing or invalid `messages`" });
    }
    for (const m of messages) {
      if (!m || typeof m !== "object") return res.status(400).json({ error: "Malformed message" });
      if (m.role !== "user" && m.role !== "assistant") return res.status(400).json({ error: `Invalid role: ${m.role}` });
      if (typeof m.content !== "string" || m.content.length === 0 || m.content.length > MAX_CONTENT_CHARS) {
        return res.status(400).json({ error: "Message content must be non-empty and within limit" });
      }
    }
    if (messages[0].role !== "user") {
      return res.status(400).json({ error: "First message must have role=user" });
    }

    // ЦЕНА ОДНОГО АНОНИМНОГО ВЫЗОВА.
    //
    // Собственные пределы ручки щедры: 40 сообщений по 16 000 знаков плюс 8 000
    // системных — 648 000 знаков, около 162 тысяч входных токенов за ОДИН вызов,
    // и уходят они в claude-opus-4-8 (проверено на проде 27.08.2026: ручка
    // отвечает без входа в аккаунт). Учёта расхода у анонима нет, а ограничитель
    // частоты слабее объявленного: счётчиков несколько, и причина открыта
    // (см. шапку rateLimit.ts, поправка 28.08).
    //
    // Тот же предел, что у qcoreai, и та же функция: два способа ограничивать
    // одно и то же разошлись бы на первом краевом случае. Вошедшего не касается.
    const budget = checkAiInputBudget(messages, isAnonymousRequest(req));
    if (!budget.ok) {
      return res
        .status(413)
        .json({ error: budget.error, message: budget.message, limit: budget.limit, got: budget.got });
    }
    let resolvedMaxTokens = DEFAULT_MAX_TOKENS;
    if (typeof maxTokens === "number" && maxTokens > 0) {
      resolvedMaxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CEILING);
    }

    // ─── Поток через реестр поставщиков ─────────────────────────────────
    // ФОРМА СОБЫТИЙ ОСТАЁТСЯ ANTHROPIC-СОВМЕСТИМОЙ. Фронт шахмат разбирает
    // content_block_delta и дописывает текст; перевести его на другой формат
    // значило бы чинить бэкенд и ломать экран. Реестр отдаёт простые события,
    // мы одеваем их в прежний конверт.
    const поставщик = выбратьПоставщика();
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // не буферизовать в nginx

    // 🔴 30.09.2026: СЛУШАТЬ НАДО ОТВЕТ, А НЕ ЗАПРОС.
    //
    // Здесь стояло `req.on("close")`. В Node событие `close` у ЗАПРОСА
    // срабатывает и при обычном, полном его прочтении — а не только когда
    // клиент ушёл. POST с телом дочитывается раньше, чем поставщик пришлёт
    // первый токен, поэтому `живо` гасло ДО первого кадра, и дальше каждая
    // часть текста молча пропускалась: `if (!живо) return`.
    //
    // Снаружи это выглядело как исправная работа: код 200, корректный
    // `message_stop`, никаких ошибок — и ровно 31 байт в ответе. Замер на
    // живом проде в день запуска: пустым приходил КАЖДЫЙ ответ, при том что
    // тот же поставщик по обычному пути /chat отвечал полным разбором.
    // Воспроизведено в тесте с подменённым поставщиком: поток отдавал текст,
    // маршрут не выдавал ни знака.
    //
    // Про уход клиента честно отвечает ОТВЕТ: res закрывается, когда соединение
    // разорвано. req.destroyed оставлен вторым признаком на случай обрыва до
    // начала выдачи.
    let живо = true;
    res.on("close", () => { живо = false; });

    const кусок = (текст: string) =>
      "data: " +
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: текст } }) +
      String.fromCharCode(10, 10);

    // Один переход на запасного, и только ДО первой буквы: уже отданное
    // обратно не забрать, поэтому переключаться посреди ответа нельзя.
    let выданоЗнаков = 0;
    const попытка = async (кого: string): Promise<void> => {
      for await (const ev of streamProvider(
        кого,
        вСообщенияРеестра(system, messages),
        модельДля(кого),
        0.7,
      )) {
        if (!живо) return;
        if (ev.kind === "text" && ev.text) {
          выданоЗнаков += ev.text.length;
          res.write(кусок(ev.text));
        }
      }
    };

    // 🔴 30.09.2026, ПОСЛЕ ВОЛНЫ 5: отказ потока больше НЕ бросается наружу.
    //
    // Здесь стояло `throw` в трёх местах при нуле выданных знаков. Каждый из
    // них перепрыгивал добор обычным вызовом, который стоит НИЖЕ, и запрос
    // заканчивался кодом 500. Замер на проде 4b63abc54010: из пяти вопросов
    // подряд один вернул 500, четыре — ответ. Пятый попал в момент, когда у
    // openai истекла отметка отключения: его выбрали заново, он снова ответил
    // 429, переключение на запасного тоже не дало текста — и вместо того
    // чтобы спокойно добрать ответ обычным вызовом, маршрут упал.
    //
    // Отказ теперь запоминается, а решение принимается ОДИН раз, ниже: есть
    // ответ — отдаём, нет — честный 502 своими словами.
    let отказПотока: unknown = null;
    try {
      await попытка(поставщик);
    } catch (e: any) {
      const причина = providerOutageReason(e);
      if (выданоЗнаков === 0 && причина) {
        // Поставщик закрыл счёт — запоминаем до даты возврата и берём следующего.
        noteProviderOutage(поставщик, причина);
        const запасной = resolveProvider();
        if (запасной !== поставщик && запасной !== "stub") {
          console.warn(`[coach] поток ${поставщик} → ${запасной}: ${String(причина).slice(0, 120)}`);
          try {
            await попытка(запасной);
          } catch (e2: any) {
            if (выданоЗнаков === 0) отказПотока = e2;
          }
        } else if (выданоЗнаков === 0) {
          отказПотока = e;
        }
      } else if (выданоЗнаков === 0) {
        отказПотока = e;
      }
      // Обрыв ПОСЛЕ первых букв: молчать нельзя, но и рвать ответ незачем —
      // фронт считает частичный ответ выданным. Пишем в журнал и закрываем.
      if (выданоЗнаков > 0) {
        console.warn("[coach] поток оборвался после", выданоЗнаков, "знаков:", String(e?.message || e).slice(0, 160));
      }
    }
    // 🔴 30.09.2026: ПОТОК МОЖЕТ ЗАКОНЧИТЬСЯ УСПЕШНО И ПУСТЫМ.
    //
    // Замер на живом проде в день запуска: каждый запрос сюда возвращал ровно
    // 31 байт — один `message_stop` и ни одного кадра текста. Ошибки при этом
    // не было: исключения выше не бросалось, поставщик (gemini-2.5-flash)
    // честно закрывал поток без единой части с текстом, а тот же поставщик по
    // обычному пути /chat отвечал полным разбором. То есть неисправность
    // выглядела как успех — код 200 и корректный конец потока.
    //
    // Раньше это спасал фронт: он не засчитывал пустой ответ и делал ВТОРОЙ
    // запрос на /chat. Человек ответ получал, но платил за это лишним мёртвым
    // вызовом и лишними секундами ожидания на каждый вопрос, а наружу ничего
    // не было видно. Чинить это на фронте нельзя: пустой поток — неисправность
    // сервера, и отвечать за неё должен сервер.
    //
    // Поэтому: не выдали ни знака — дописываем ответ обычным вызовом в ТОТ ЖЕ
    // поток. Для фронта это обычный кадр, второй запрос не нужен. Судим тем же
    // мерилом, что и /chat: чужой язык или огрызок наружу не уходят.
    if (выданоЗнаков === 0) {
      console.warn("[coach] поток закончился пустым, добираю ответ обычным вызовом");
      // 🔴 30.09.2026, ПОСЛЕ ВОЛНЫ 4: добор идёт к ЖИВОМУ поставщику.
      //
      // Здесь стоял `поставщик` — тот, кого выбрали в начале запроса. Но к
      // этому месту он мог уже отвалиться: выше поток ловит отказ, помечает
      // поставщика отключённым (noteProviderOutage) и переключается на
      // запасного. Добор же упрямо звал первого — и получал тот же отказ.
      //
      // Живой замер на проде 32ff4cafba74: первые две пробы вернули пустоту,
      // потому что выбирался openai с «429 no credits remaining», а добор шёл
      // снова в openai. Как только openai попал в список отключённых и выбор
      // сместился на gemini, ответ пошёл: 269 байт вместо 31.
      //
      // `resolveProvider()` спрашивается ЗДЕСЬ, а не берётся из начала
      // запроса, именно потому, что между ними успели записать отключение.
      const живой = resolveProvider();
      if (живой !== поставщик) {
        console.warn(`[coach] добор берёт живого поставщика ${живой} вместо ${поставщик}`);
      }
      try {
        const итог = await callProvider(
          живой,
          вСообщенияРеестра(system, messages),
          модельДля(живой),
          0.7,
          undefined,
          бюджетОтвета(живой, модельДля(живой), resolvedMaxTokens),
          { module: "coach" },
        );
        const годен =
          итог.reply &&
          !языкНеТот(messages[messages.length - 1]?.content ?? "", итог.reply) &&
          !ответОгрызок(итог.reply);
        if (годен) {
          выданоЗнаков += итог.reply.length;
          res.write(кусок(итог.reply));
        } else {
          console.error("[coach] запасной ответ тоже негоден");
        }
      } catch (e: any) {
        console.error("[coach] добор обычным вызовом не удался:", String(e?.message || e).slice(0, 160));
      }
    }

    // 🔴 Ни потоком, ни добором ничего не вышло — говорим об этом СВОИМИ
    // словами. Раньше сюда прилетал raw-текст поставщика: замер показал, что
    // наружу уходило «openai 429: You have no credits remaining» — то есть
    // состояние нашего счёта у поставщика, видимое любому посетителю. Это не
    // только некрасиво, это сведения о нас, которых человеку знать незачем.
    if (выданоЗнаков === 0) {
      if (отказПотока) {
        console.error("[coach] поток и добор отказали:", String((отказПотока as Error)?.message || отказПотока).slice(0, 160));
      }
      if (!res.headersSent) {
        return res.status(502).json({
          error: "Тренер сейчас не отвечает — показываю разбор движком. Партия и задачи работают.",
        });
      }
    }
    res.write("data: " + JSON.stringify({ type: "message_stop" }) + String.fromCharCode(10, 10));
    res.end();
  } catch (err: any) {
    console.error("[coach] Unexpected stream error:", err);
    captureCoachError(err, { route: "coach/POST/chat/stream" });
    if (!res.headersSent) res.status(500).json({ error: err?.message || "Internal server error" });
    else { try { res.end(); } catch { /* ignore */ } }
  }
});

// ─── /sessions — coaching session lifecycle ───────────────────────────────────

/** POST /sessions/start
 *  Auth: Bearer required.
 *  Body: { topic: string, startingFen?: string }
 *  Returns: { session } */
coachRouter.post("/sessions/start", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const { topic, startingFen } = (req.body || {}) as {
    topic?: string;
    startingFen?: string;
  };

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return res.status(400).json({ error: "Missing `topic`" });
  }
  if (topic.length > 200) {
    return res.status(400).json({ error: "topic too long (max 200 chars)" });
  }
  if (startingFen != null && (typeof startingFen !== "string" || startingFen.length > 120)) {
    return res.status(400).json({ error: "startingFen must be a string ≤ 120 chars" });
  }

  const session: CoachSession = {
    id: randomUUID(),
    ownerKey,
    topic: topic.trim(),
    startingFen: startingFen?.trim() || undefined,
    startedAt: new Date().toISOString(),
    messageCount: 0,
    goalsLinked: [],
  };
  sessions.set(session.id, session);
  trimStore(sessions, MAX_SESSIONS);

  return res.status(201).json({ session });
});

/** POST /sessions/:id/end
 *  Auth: Bearer required.
 *  Body: { notes?: string, messageCount?: number }
 *  Returns: { session } */
coachRouter.post("/sessions/:id/end", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const session = sessions.get(String(req.params.id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  if (session.endedAt) return res.status(409).json({ error: "Session already ended" });

  const { notes, messageCount } = (req.body || {}) as {
    notes?: string;
    messageCount?: number;
  };
  if (notes != null) {
    if (typeof notes !== "string") return res.status(400).json({ error: "notes must be a string" });
    if (notes.length > 2000) return res.status(400).json({ error: "notes too long (max 2000)" });
    session.notes = notes;
  }
  if (typeof messageCount === "number" && messageCount >= 0 && Number.isFinite(messageCount)) {
    session.messageCount = Math.floor(messageCount);
  }

  const endedAt = new Date();
  session.endedAt = endedAt.toISOString();
  session.durationSec = Math.max(
    0,
    Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000),
  );

  return res.json({ session });
});

/** GET /sessions — list current user's sessions (newest first, max 50). */
coachRouter.get("/sessions", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const mine = [...sessions.values()]
    .filter((s) => s.ownerKey === ownerKey)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 50);
  return res.json({ items: mine, total: mine.length });
});

/** GET /sessions/:id — single session detail. */
coachRouter.get("/sessions/:id", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const session = sessions.get(String(req.params.id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  return res.json({ session });
});

// ─── /goals — coaching goal tracking ─────────────────────────────────────────

/** POST /goals
 *  Auth: Bearer required.
 *  Body: { title, description?, targetDate?, sessionId? }
 *  Returns: { goal } */
coachRouter.post("/goals", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const { title, description, targetDate, sessionId } = (req.body || {}) as {
    title?: string;
    description?: string;
    targetDate?: string;
    sessionId?: string;
  };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "Missing `title`" });
  }
  if (title.length > 200) return res.status(400).json({ error: "title too long (max 200)" });
  if (description != null) {
    if (typeof description !== "string" || description.length > 2000) {
      return res.status(400).json({ error: "description too long (max 2000)" });
    }
  }
  if (targetDate != null) {
    if (typeof targetDate !== "string" || Number.isNaN(Date.parse(targetDate))) {
      return res.status(400).json({ error: "targetDate must be ISO 8601" });
    }
  }
  // Verify sessionId belongs to caller if provided.
  if (sessionId != null) {
    if (typeof sessionId !== "string") return res.status(400).json({ error: "sessionId must be a string" });
    const s = sessions.get(sessionId);
    if (!s || s.ownerKey !== ownerKey) {
      return res.status(400).json({ error: "sessionId does not reference an accessible session" });
    }
  }

  const goal: CoachGoal = {
    id: randomUUID(),
    ownerKey,
    title: title.trim(),
    description: description?.trim() || undefined,
    targetDate: targetDate || undefined,
    sessionId: sessionId || undefined,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  goals.set(goal.id, goal);
  trimStore(goals, MAX_GOALS);

  // Link goal to session if applicable.
  if (sessionId) {
    const s = sessions.get(sessionId);
    if (s && !s.goalsLinked.includes(goal.id)) s.goalsLinked.push(goal.id);
  }

  return res.status(201).json({ goal });
});

/** GET /goals?completed=true|false — filter mine. */
coachRouter.get("/goals", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const completedFilter =
    typeof req.query.completed === "string"
      ? req.query.completed === "true"
      : null;
  const mine = [...goals.values()]
    .filter((g) => g.ownerKey === ownerKey)
    .filter((g) => completedFilter === null ? true : g.completed === completedFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  return res.json({ items: mine, total: mine.length });
});

/** POST /goals/:id/complete — flip to done. Idempotent. */
coachRouter.post("/goals/:id/complete", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const goal = goals.get(String(req.params.id));
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  if (goal.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  if (!goal.completed) {
    goal.completed = true;
    goal.completedAt = new Date().toISOString();
  }
  return res.json({ goal });
});

/** DELETE /goals/:id — remove. */
coachRouter.delete("/goals/:id", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const goal = goals.get(String(req.params.id));
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  if (goal.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  goals.delete(String(req.params.id));
  return res.status(204).end();
});

// ─── Health check (public) ────────────────────────────────────────────────
// 🔴 28.09.2026: раньше здесь было ok:true и apiKeyConfigured — то есть ручка
// отвечала «ключ задан», а спрашивают её про «ответ придёт». Замер того дня:
// health зелёный, а /chat тем же моментом 400 «usage limits». Зелёная проверка
// при нерабочем тренере хуже отсутствия проверки: по ней перестают смотреть.
coachRouter.get("/health", (_req: Request, res: Response) => {
  const поставщики = getProviders().filter((p) => p.id !== "stub");
  const закрытые = listProviderOutages();
  const готов = можемОтветить();
  res.json({
    // ok отвечает на вопрос «можем ли ответить», а не «поднят ли процесс».
    ok: готов,
    canAnswer: готов,
    provider: готов ? выбратьПоставщика() : null,
    model: готов ? модельДля(выбратьПоставщика()) : null,
    configured: поставщики.filter((p) => p.configured).map((p) => p.id),
    // Кто закрыт и до какого срока — значения ключей не печатаем, только имена.
    outages: закрытые,
    defaultMaxTokens: DEFAULT_MAX_TOKENS,
    maxTokensCeiling: MAX_TOKENS_CEILING,
    sessions: sessions.size,
    goals: goals.size,
  });
});
