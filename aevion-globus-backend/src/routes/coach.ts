// AEVION CyberChess — AI Coach proxy route (v35)
//
// Receives { system, messages, maxTokens? } from frontend and proxies to Claude API.
// Hides API key from client.
//
// v35 changes:
// - Default model upgraded from Haiku 4.5 → Sonnet 4.6 for stronger chess reasoning.
//   Haiku plays chess at ~1200 ELO "guesses on the position", Sonnet at ~2000 ELO and
//   ACTUALLY understands engine eval lines when they're provided in the prompt.
// - maxTokens is now client-configurable (Live Coach needs 150, deep analysis up to 1500).
// - System prompt validation no longer truncates.

import { Router, type Request, type Response } from "express";

export const coachRouter = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Opus 4.7 — Anthropic's flagship, strongest chess reasoning ($15 in / $75 out per M tokens).
// Each Coach request ≈ $0.015-0.02, acceptable for premium experience. Override via env.
const DEFAULT_MODEL = process.env.COACH_MODEL || "claude-opus-4-7";

// Absolute ceiling on tokens per response — chess coaching fits comfortably in 1500.
// Client may request less (e.g. 150 for Live Coach one-liners).
const MAX_TOKENS_CEILING = 1500;
const DEFAULT_MAX_TOKENS = 800;

// Input size limits — chess context (FEN + engine PVs + move list) fits comfortably
// in a few KB per message. These limits prevent abuse / runaway costs.
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 16000;
const MAX_SYSTEM_CHARS = 8000;

coachRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server misconfigured: ANTHROPIC_API_KEY not set",
      });
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

    // Resolve max_tokens with sensible clamping.
    let resolvedMaxTokens = DEFAULT_MAX_TOKENS;
    if (typeof maxTokens === "number" && maxTokens > 0) {
      resolvedMaxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CEILING);
    }

    // ─── Forward to Anthropic ────────────────────────────────────────────
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: resolvedMaxTokens,
        system,
        messages,
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const errMsg =
        (data && (data.error?.message || data.message)) ||
        `Upstream error (HTTP ${upstream.status})`;
      console.error("[coach] Anthropic API error:", upstream.status, errMsg);
      return res.status(upstream.status).json({ error: errMsg });
    }

    return res.json(data);
  } catch (err: any) {
    console.error("[coach] Unexpected error:", err);
    return res.status(500).json({
      error: err?.message || "Internal server error",
    });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────
coachRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL,
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    defaultMaxTokens: DEFAULT_MAX_TOKENS,
    maxTokensCeiling: MAX_TOKENS_CEILING,
  });
});

// ─── Knowledge base ───────────────────────────────────────────────────────
// Hardcoded opening / tactical / strategic tips the Coach can query locally
// without going to Claude.  Used by GET /api/coach/knowledge-search?q=QUERY
// which returns the top 5 keyword-matched entries.

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  body: string;
  keywords: string[];
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── Openings ────────────────────────────────────────────────────────────
  {
    id: "k_sicilian_basics",
    category: "Дебюты",
    title: "Сицилианская защита — основы",
    body: "1.e4 c5 — самый популярный ответ на 1.e4. Чёрные сразу захватывают пространство на ферзевом фланге и нарушают симметрию. Главные варианты: Дракон, Найдорф, Шевенинген, Классический. Белые обычно продолжают 2.Кf3 и 3.d4, получая перевес в центре в обмен на инициативу чёрных.",
    keywords: ["сицилианская", "sicilian", "c5", "e4", "дракон", "найдорф", "шевенинген"],
  },
  {
    id: "k_ruy_lopez",
    category: "Дебюты",
    title: "Испанская партия (Руй Лопес)",
    body: "1.e4 e5 2.Кf3 Кc6 3.Сb5 — белые атакуют коня, защищающего пешку e5. Чёрные могут отвечать: 3...a6 (защита Морфи), 3...Кf6 (Берлинская защита), 3...d6 (защита Стейница). Берлинская стена — самый надёжный ответ на высшем уровне: после 4.С:c6 dc 5.0-0 чёрные получают здоровый эндшпиль.",
    keywords: ["испанская", "рuy lopez", "руй лопес", "берлин", "берлинская", "e4 e5"],
  },
  {
    id: "k_queens_gambit",
    category: "Дебюты",
    title: "Ферзевый гамбит",
    body: "1.d4 d5 2.c4 — белые предлагают пешку ради захвата центра. 2...dc (принятый) позволяет белым быстро развиться; 2...e6 (отклонённый) — самое надёжное продолжение; 2...c6 (Слово-защита) — солидная система с идеей e5.",
    keywords: ["ферзевый гамбит", "queens gambit", "d4 d5 c4", "принятый", "отклонённый"],
  },
  {
    id: "k_kings_indian",
    category: "Дебюты",
    title: "Защита Короля (Королевский Индиец)",
    body: "1.d4 Кf6 2.c4 g6 3.Кc3 Сg7 4.e4 d6 — чёрные уступают центр, готовя контратаку f7-f5 или c7-c5. Острая динамичная позиция. Белые строят пешечный центр, чёрные подрывают его. Популярен у Каспарова и Фишера.",
    keywords: ["королевский индиец", "kings indian", "g6", "Bg7", "fianchetto"],
  },
  {
    id: "k_french_defense",
    category: "Дебюты",
    title: "Французская защита",
    body: "1.e4 e6 2.d4 d5 — чёрные немедленно атакуют центр. Основные варианты: 3.Кc3 (Классический), 3.Кd2 (Тарраш), 3.e5 (Ход Нимцовича). Плюс: надёжная позиция; минус: слон c8 часто пассивен.",
    keywords: ["французская", "french", "e6 d5", "тарраш", "нимцович"],
  },
  {
    id: "k_caro_kann",
    category: "Дебюты",
    title: "Защита Каро-Канн",
    body: "1.e4 c6 2.d4 d5 — более надёжная альтернатива Французской. Слон c8 не заперт. Варианты: Классический (3.Кc3 dc 4.К:c4), Авансированный (3.e5 Сf5), Фантазия (3.f3). Любима Карповым — позиционный стиль без слабостей.",
    keywords: ["каро-канн", "caro kann", "c6 d5", "карпов"],
  },
  // ── Tactics ─────────────────────────────────────────────────────────────
  {
    id: "k_fork",
    category: "Тактика",
    title: "Вилка",
    body: "Вилка — одна фигура атакует две (или более) фигуры противника одновременно. Конь лучше всего подходит для вилок благодаря своему необычному ходу. Ищите ходы коня на e4/e5 d5/d4 или f6/f3 для нападения на короля и ферзя одновременно. Другие фигуры тоже делают вилки: пешка на d5 вилкует коней c6 и e6.",
    keywords: ["вилка", "fork", "конь", "knight", "двойной удар", "double attack"],
  },
  {
    id: "k_pin",
    category: "Тактика",
    title: "Связка",
    body: "Связка — фигура не может двигаться, не подставляя более ценную фигуру (или короля). Абсолютная связка: фигура связана с королём — ходить нельзя. Относительная: фигура прикрывает ценную фигуру, но технически может двигаться. Слон и ладья — главные создатели связок.",
    keywords: ["связка", "pin", "absolute pin", "relative pin", "абсолютная", "относительная"],
  },
  {
    id: "k_skewer",
    category: "Тактика",
    title: "Рентген (Скетч/Просвечивание)",
    body: "Рентген — противоположность связки: атакуется более ценная фигура, а за ней стоит менее ценная. После отступления ценной фигуры берётся задняя. Например, ладья атакует короля — король отступает, ладья берёт ферзя за ним.",
    keywords: ["рентген", "skewer", "просвечивание", "x-ray"],
  },
  {
    id: "k_discovered_attack",
    category: "Тактика",
    title: "Скрытый удар (Удар с открытием)",
    body: "Скрытый удар: одна фигура отходит, открывая нападение другой фигуры. Особенно опасен скрытый шах — фигура ходит и открывает шах от другой фигуры. Чёрный конь на d5 прыгает, открывая атаку слона g2 на ладью a8.",
    keywords: ["скрытый удар", "discovered attack", "discovered check", "скрытый шах"],
  },
  {
    id: "k_zwischenzug",
    category: "Тактика",
    title: "Промежуточный ход (Цвишенцуг)",
    body: "Цвишенцуг — неожиданный промежуточный ход вместо очевидного ответа. Обычно это шах или угроза, заставляющая противника реагировать, меняя оценку позиции. Например, вместо взятия фигуры — сначала шах, который выигрывает темп.",
    keywords: ["цвишенцуг", "zwischenzug", "промежуточный ход", "intermezzo", "in-between"],
  },
  {
    id: "k_back_rank",
    category: "Тактика",
    title: "Мат на последней горизонтали",
    body: "Угроза мата ладьёй или ферзём на 1-й (8-й) горизонтали, когда король заперт собственными пешками. Профилактика: вовремя сделать 'форточку' (h3/h6 или g3/g6). Если форточки нет — тактика на последней горизонтали выигрывает материал или даёт мат.",
    keywords: ["мат на последней горизонтали", "back rank", "back rank mate", "форточка"],
  },
  {
    id: "k_overloading",
    category: "Тактика",
    title: "Перегрузка фигуры",
    body: "Перегрузка: фигура противника выполняет сразу две защитные функции. Атакуйте обе одновременно — фигура не может защитить обе. Пример: ладья защищает и ферзя, и пешку d7 с матом. Нападая на ладью, вы забираете ферзя или даёте мат.",
    keywords: ["перегрузка", "overloading", "overloaded piece", "двойная защита"],
  },
  // ── Strategy ────────────────────────────────────────────────────────────
  {
    id: "k_outpost",
    category: "Стратегия",
    title: "Форпост (Аванпост)",
    body: "Форпост — поле, на котором фигура (обычно конь) стоит устойчиво, не может быть атакована пешками противника. Конь на e5 или d5 в центре — мощный форпост. Как создать: уничтожить пешку, которая могла бы прогнать фигуру; поддержать коня своими пешками.",
    keywords: ["форпост", "аванпост", "outpost", "конь в центре", "knight outpost"],
  },
  {
    id: "k_pawn_structure",
    category: "Стратегия",
    title: "Пешечная структура",
    body: "Пешечная структура определяет стратегический план. Слабости: изолированная пешка (нет соседних пешек того же цвета), сдвоенные пешки, отсталая пешка. Сила: проходная пешка, пешечный центр. Каждой структуре соответствует свой план: изолятор — давить на него, проходная — продвигать.",
    keywords: ["пешечная структура", "pawn structure", "изолятор", "isolated pawn", "сдвоенные", "doubled"],
  },
  {
    id: "k_open_file",
    category: "Стратегия",
    title: "Открытая линия и ладья",
    body: "Ладья максимально сильна на открытой или полуоткрытой линии (без пешек или только с пешкой противника). Захватите открытую линию ладьёй раньше противника. Цель: вторжение на 7-ю горизонталь ('поросячья ладья') или давление на слабую пешку.",
    keywords: ["открытая линия", "open file", "ладья", "rook", "7-я горизонталь", "seventh rank"],
  },
  {
    id: "k_bishop_pair",
    category: "Стратегия",
    title: "Два слона",
    body: "Пара слонов в открытой позиции сильнее пары коней или слона с конём. Слоны бьют по длинным диагоналям и хорошо координируются. В закрытых позициях кони могут оказаться сильнее. Получив пару слонов — открывайте позицию.",
    keywords: ["два слона", "bishop pair", "слоны", "bishops", "fianchetto"],
  },
  {
    id: "k_king_safety",
    category: "Стратегия",
    title: "Безопасность короля",
    body: "Король должен быть в безопасности, особенно в миттельшпиле. Рокируйтесь вовремя. После рокировки не двигайте пешки перед королём без необходимости. Если противник вскрывает позицию перед вашим королём — ищите контригру или укрепляйте позицию. Слабый король — постоянная тактическая угроза.",
    keywords: ["безопасность короля", "king safety", "рокировка", "castling", "атака на короля"],
  },
  {
    id: "k_zugzwang",
    category: "Стратегия",
    title: "Цугцванг",
    body: "Цугцванг — положение, когда любой ход ухудшает позицию. Типично в эндшпиле: один ход теряет пешку, другой — позицию. Достигается оппозицией королей. Пример: белый король на e5, чёрный на e7 — очередь хода белых. Но если очередь чёрных — цугцванг, и ход e7-d7/f7 проигрывает.",
    keywords: ["цугцванг", "zugzwang", "оппозиция", "opposition", "эндшпиль"],
  },
  // ── Endgame ─────────────────────────────────────────────────────────────
  {
    id: "k_rook_endgame",
    category: "Эндшпиль",
    title: "Ладейный эндшпиль — основы",
    body: "Ладейные окончания — самые распространённые. Правила: активизируйте ладью, режьте короля (ладья на 4-й горизонтали отрезает короля); при защите — используйте 'метод Луцкера' (ладья атакует проходную сбоку). Теорема Филидора: ладья на 6-й горизонтали спасает при защите пешки 'е'.",
    keywords: ["ладейный эндшпиль", "rook endgame", "Philidor", "Lucena", "проходная", "passed pawn"],
  },
  {
    id: "k_king_pawn_endgame",
    category: "Эндшпиль",
    title: "Пешечный эндшпиль — квадрат пешки",
    body: "Квадрат проходной пешки: если король противника не попадает в квадрат, пешка проходит в ферзи. Строится от пешки по диагонали до конца доски. Оппозиция королей: короли на одной линии, расстояние нечётное, очередь хода у того, кто хочет избежать оппозиции — он проигрывает. Проходная в эндшпиле — решающее преимущество.",
    keywords: ["пешечный эндшпиль", "pawn endgame", "квадрат", "square rule", "оппозиция"],
  },
  {
    id: "k_knight_endgame",
    category: "Эндшпиль",
    title: "Конь в эндшпиле",
    body: "Конь плохо борется с проходными пешками на краях доски — не успевает. Конь силён в центре (контролирует 8 клеток) и слаб на краю (2-4 клетки). Конь и пешка vs король: если пешка ладейная (a или h) и конь не того цвета — ничья. Конь не может выиграть темп (не может ходить и возвращаться, теряя один темп).",
    keywords: ["конь эндшпиль", "knight endgame", "ладейная пешка", "rook pawn", "knight vs king"],
  },
  // ── Time management ──────────────────────────────────────────────────────
  {
    id: "k_time_management",
    category: "Время",
    title: "Управление временем в партии",
    body: "Не тратьте много времени на первые 10-12 ходов, если знаете дебют. Распределяйте время равномерно на сложные позиции. Флаг — признак недостатка анализа в миттельшпиле. При цейтноте: упрощайте позицию, идите на эндшпиль, избегайте острых осложнений. Не торопитесь в «выигранных» позициях — здесь особенно легко зевнуть.",
    keywords: ["время", "time management", "цейтнот", "time trouble", "блиц", "blitz", "темп"],
  },
];

// Simple keyword-frequency scorer
function scoreEntry(entry: KnowledgeEntry, terms: string[]): number {
  if (terms.length === 0) return 0;
  const haystack = [entry.title, entry.body, ...entry.keywords, entry.category]
    .join(" ")
    .toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      // Title / keyword matches count more
      const titleMatch = entry.title.toLowerCase().includes(term) ? 3 : 0;
      const kwMatch = entry.keywords.some((kw) => kw.toLowerCase().includes(term)) ? 2 : 0;
      score += 1 + titleMatch + kwMatch;
    }
  }
  return score;
}

// GET /api/coach/knowledge-search?q=QUERY
// Returns top 5 matches; empty array when no query is given.
coachRouter.get("/knowledge-search", (req: Request, res: Response) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!raw) {
    return res.json({ query: "", results: [] });
  }
  const terms = raw
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const scored = KNOWLEDGE_BASE.map((entry) => ({
    entry,
    score: scoreEntry(entry, terms),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ entry }) => ({
      id: entry.id,
      category: entry.category,
      title: entry.title,
      body: entry.body,
    }));

  return res.json({ query: raw, results: scored });
});
