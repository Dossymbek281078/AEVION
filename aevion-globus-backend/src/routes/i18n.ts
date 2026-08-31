import { generationLimit } from "../lib/rateLimit";
/**
 * AEVION i18n — live batch translation for the client-side DOM translator.
 *
 * POST /api/i18n/translate  { texts: string[], target: lang }  -> { translations: string[] }
 *
 * Most AEVION pages are RU/EN-literal (no t() hooks). The client AutoTranslate
 * walks the DOM and sends untranslated visible strings here. We translate via
 * DeepL for DeepL-supported targets, and via Claude (the qcoreai Anthropic
 * provider) for Kazakh (kk) which DeepL does not support. Results are cached
 * server-side (in-memory) and again client-side (localStorage), so each unique
 * string×language is paid for once.
 */

import { Router } from "express";
import { callProvider, type ChatMessage } from "../services/qcoreai/providers";

export const i18nRouter = Router();

// our lang code -> DeepL target_lang. kk (Kazakh) intentionally absent — DeepL
// has no Kazakh; it routes to the Claude fallback below.
const DEEPL_TARGET: Record<string, string> = {
  en: "EN-US",
  ru: "RU",
  de: "DE",
  fr: "FR",
  es: "ES",
  zh: "ZH",
  ja: "JA",
  ar: "AR",
  pt: "PT-PT",
  tr: "TR",
};

// Full language names for the Claude translation prompt. Used for kk (which
// DeepL lacks) AND as the fallback for every DeepL target when DEEPL_API_KEY is
// not configured — so all 11 languages translate off the already-configured
// Anthropic key instead of silently 500-ing.
const LANG_NAME: Record<string, string> = {
  en: "English",
  ru: "Russian (Русский)",
  kk: "Kazakh (Қазақ тілі)",
  de: "German (Deutsch)",
  fr: "French (Français)",
  es: "Spanish (Español)",
  zh: "Simplified Chinese (简体中文)",
  ja: "Japanese (日本語)",
  ar: "Arabic (العربية)",
  pt: "Portuguese (Português)",
  tr: "Turkish (Türkçe)",
};

// Brand / product / technical tokens that must survive translation verbatim.
// DeepL has no notion of this on its own (it turned "QVenture benchmark" into
// "Тестирование QVenture"), so we wrap these in ignore tags for DeepL and list
// them in the Claude prompt. Case-sensitive, whole-token match only.
const BRAND_TOKENS = [
  "AEVION", "QVenture", "QVentures", "QCoreAI", "QFusionAI", "QRight", "QSign",
  "QShield", "QTrade", "QPayNet", "QMaskCard", "QContract", "QChainGov",
  "Quantum Shield", "Planet", "Bureau", "NeuroDx", "Globus",
  "MOIC", "IRR", "MRR", "ARR", "NRR", "CAC", "LTV", "GMV", "HMAC", "JWT",
  "API", "SDK", "AEC", "AEV", "SaaS", "VC",
];
// Longest first so multi-word / superset tokens win before their substrings
// (e.g. "Quantum Shield" before "Shield").
const BRAND_SORTED = [...BRAND_TOKENS].sort((a, b) => b.length - a.length);
const BRAND_PROMPT_LIST = BRAND_TOKENS.join(", ");

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function xmlUnescape(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
// Wrap brand tokens in <x>…</x> so DeepL (tag_handling=xml, ignore_tags=x)
// leaves them untranslated. Boundaries are non-alphanumeric, so "API" inside a
// larger word is never matched.
function protectBrands(text: string): string {
  let out = xmlEscape(text);
  for (const b of BRAND_SORTED) {
    const re = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(b)})(?=[^A-Za-z0-9]|$)`, "g");
    out = out.replace(re, (_m, pre: string, tok: string) => `${pre}<x>${tok}</x>`);
  }
  return out;
}
function unprotectBrands(text: string): string {
  return xmlUnescape(text.replace(/<\/?x>/g, ""));
}

// Server-side translation cache: `${target}${text}` -> translation.
// Bounded; survives within a deploy. Client localStorage covers cross-deploy.
const cache = new Map<string, string>();
const MAX_CACHE = 60_000;
const MAX_TEXTS = 200;
const MAX_LEN = 5_000;

const ckey = (target: string, text: string) => `${target}${text}`;

/**
 * Remember a translation only when the engine actually produced one.
 *
 * `undefined` means the engine gave us nothing and the caller fell back to the
 * source; an unchanged string means nothing was translated. Neither is worth
 * pinning: the next request should get a fresh attempt rather than a permanent
 * echo of the source text.
 */
export function shouldCache(source: string, engineResult: string | undefined): boolean {
  if (typeof engineResult !== "string" || engineResult === "") return false;
  return engineResult !== source;
}

async function deeplBatch(texts: string[], deeplTarget: string): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPL_API_KEY not configured");
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = new URLSearchParams();
  // Wrap brand tokens in <x>…</x> and tell DeepL to ignore that tag, so brand /
  // product / technical names survive untranslated instead of being mangled.
  for (const t of texts) params.append("text", protectBrands(t));
  params.set("target_lang", deeplTarget);
  params.set("tag_handling", "xml");
  params.set("ignore_tags", "x");
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await r.json()) as { translations?: { text: string }[]; message?: string };
  if (!r.ok) throw new Error(`DeepL ${r.status}: ${(data?.message || JSON.stringify(data)).slice(0, 200)}`);
  const out = (data.translations || []).map((t) => unprotectBrands(t.text));
  if (out.length !== texts.length) throw new Error("DeepL length mismatch");
  return out;
}

async function claudeBatch(texts: string[], langName: string): Promise<string[]> {
  const sys =
    `You are a precise UI string translator. Translate each input string to ${langName}. ` +
    `Rules: keep placeholders ({x}, %s, :id), numbers, URLs, and brand/product names ` +
    `(${BRAND_PROMPT_LIST}) ` +
    `untranslated. Preserve leading/trailing punctuation and arrows (→, ·). ` +
    `Return ONLY a JSON array of strings — exactly the same length and order as the input, no prose.`;
  const messages: ChatMessage[] = [
    { role: "system", content: sys },
    { role: "user", content: JSON.stringify(texts) },
  ];
  // Haiku is cheap and fully capable for translation; temperature 0 for determinism.
  const res = await callProvider("anthropic", messages, "claude-haiku-4-5-20251001", 0);
  let arr: unknown = null;
  try {
    arr = JSON.parse(res.reply);
  } catch {
    const m = res.reply.match(/\[[\s\S]*\]/);
    if (m) {
      try { arr = JSON.parse(m[0]); } catch { /* fall through */ }
    }
  }
  if (!Array.isArray(arr) || arr.length !== texts.length) {
    throw new Error("Claude translation parse/length mismatch");
  }
  return arr.map((x) => String(x));
}

/**
 * Translate a batch: DeepL when its key is set AND the language is DeepL-backed,
 * otherwise Claude. If a DeepL call throws (quota 456 / invalid key / network),
 * fall back to Claude instead of failing the whole request — a broken or
 * over-quota DeepL key must not take down site-wide translation.
 */
/**
 * Передышка после исчерпанной квоты DeepL.
 *
 * Замер на проде 28.08.2026: в журнале 34 строки подряд
 * «DeepL failed (456: Quota exceeded); falling back to Claude». Исчерпанная
 * квота — состояние НАДОЛГО, а не разовый сбой: мы всё равно ходили в DeepL
 * перед каждым переводом, получали тот же отказ и только потом звали запасной
 * путь. То есть на каждый перевод — лишний сетевой вызов, лишняя задержка и
 * строка в журнале, которая заглушает настоящие ошибки.
 *
 * Заметив именно квоту, молчим полчаса. Прочие ошибки DeepL (сеть, ключ) сюда
 * НЕ попадают: они бывают разовыми, и гасить их на полчаса было бы хуже.
 */
export const DEEPL_QUOTA_COOLDOWN_MS = 30 * 60 * 1000;
let deeplQuotaUntil = 0;

/** Спрашивать ли DeepL сейчас. Экспортировано ради проверки: без этого
 *  «передышку» пришлось бы утверждать по тексту исходника, а такая проверка
 *  остаётся зелёной, когда передышку убирают целиком (проверено мутацией). */
export function shouldAskDeepl(now = Date.now()): boolean {
  return now >= deeplQuotaUntil;
}

/** Запомнить, что квота исчерпана. */
export function noteQuotaExhausted(now = Date.now()): void {
  deeplQuotaUntil = now + DEEPL_QUOTA_COOLDOWN_MS;
}

/** Только для тестов: вернуть состояние в исходное. */
export function resetQuotaCooldownForTests(): void {
  deeplQuotaUntil = 0;
}

export function isQuotaError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  // Границы слова пишутся классами символов НАМЕРЕННО. Первая версия этой
  // строки содержала «», и обратный слэш потерялся при передаче правки:
  // в файл уехал НЕВИДИМЫЙ символ backspace, глазами не видный, а ветка про
  // код 456 стала мёртвой. Проверять такое надо не взглядом, а repr.
  return m.toLowerCase().includes("quota exceeded") || /(^|[^0-9])456([^0-9]|$)/.test(m);
}

async function translateBatch(target: string, texts: string[]): Promise<string[]> {
  const deeplReady = !!process.env.DEEPL_API_KEY?.trim();
  const deeplTarget = DEEPL_TARGET[target];
  const now = Date.now();
  if (deeplReady && deeplTarget && shouldAskDeepl(now)) {
    try {
      return await deeplBatch(texts, deeplTarget);
    } catch (e) {
      if (isQuotaError(e)) {
        noteQuotaExhausted(now);
        // Одна строка на передышку, а не на каждый перевод: журнал, забитый
        // одинаковыми записями, перестают читать, и настоящая авария в нём
        // теряется.
        console.warn(
          `[i18n] квота DeepL исчерпана — не спрашиваем его ${DEEPL_QUOTA_COOLDOWN_MS / 60000} мин, переводим запасным путём`
        );
      } else {
        console.warn(
          `[i18n] DeepL failed for "${target}" (${e instanceof Error ? e.message : e}); falling back to Claude`
        );
      }
    }
  }
  return claudeBatch(texts, LANG_NAME[target] || target);
}

i18nRouter.post("/translate", generationLimit("i_n_translate"), async (req, res) => {
  try {
    const target = String(req.body?.target || "").toLowerCase().trim();
    const raw = req.body?.texts;
    if (!target || !Array.isArray(raw)) {
      return res.status(400).json({ error: "target and texts[] required" });
    }
    const texts = raw
      .filter((t: unknown): t is string => typeof t === "string")
      .slice(0, MAX_TEXTS)
      .map((t) => t.slice(0, MAX_LEN));
    if (!texts.length) return res.json({ translations: [], target });
    if (!DEEPL_TARGET[target] && !LANG_NAME[target]) {
      return res.status(400).json({ error: `unsupported target language: ${target}` });
    }

    const out: string[] = new Array(texts.length);
    const missIdx: number[] = [];
    const missTexts: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const hit = cache.get(ckey(target, texts[i]));
      if (hit !== undefined) out[i] = hit;
      else { missIdx.push(i); missTexts.push(texts[i]); }
    }

    if (missTexts.length) {
      // Prefer DeepL when its key is configured; fall back to the already-
      // configured Anthropic key (Claude Haiku) both when DEEPL_API_KEY is unset
      // AND when a DeepL call FAILS at runtime (quota 456, bad key, network).
      // Without this, site-wide language switching 500s whenever DeepL is missing
      // or over quota — which is exactly what broke it in production for years.
      const translated = await translateBatch(target, missTexts);
      for (let j = 0; j < missIdx.length; j++) {
        const engine = translated[j];
        const tr = engine ?? missTexts[j];
        out[missIdx[j]] = tr;
        // Only a real translation is worth remembering. A result equal to the
        // source is either a brand token (cheap to ask again) or the shape a
        // failure takes here — and caching that pins the failure for the life
        // of the deploy. Measured 28.07.2026: 39 module captions on the home
        // page came back as themselves for every German visitor, while the
        // same strings sent fresh translated correctly. The cache was serving
        // an old identity answer, not the engine.
        if (shouldCache(missTexts[j], engine) && cache.size < MAX_CACHE) {
          cache.set(ckey(target, missTexts[j]), tr);
        }
      }
    }

    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({ translations: out, target, cached: texts.length - missTexts.length });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "translate failed" });
  }
});

/**
 * POST /api/i18n/cache/clear   header X-Admin-Token
 *
 * Drops the server-side translation cache. It exists because the cache lives in
 * process memory: when a bad answer got in — the engine occasionally returns a
 * string unchanged — every visitor was served that echo until the next deploy.
 * Measured 28.07.2026: 104 visible strings across six pages were stuck in
 * Russian for German visitors this way. Caching such answers is fixed above;
 * this is the way to recover a cache that was poisoned before the fix, without
 * waiting for a deploy or restarting the service.
 *
 * Fails closed. Every miss costs a paid call to DeepL or Claude, so an open
 * endpoint would be a way to burn the budget; without ADMIN_TOKEN configured it
 * refuses rather than allowing anyone to clear it.
 */
i18nRouter.post("/cache/clear", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    return res.status(503).json({ error: "ADMIN_TOKEN not configured; refusing to expose cache control" });
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (got !== required) return res.status(401).json({ error: "unauthorized" });

  const target = typeof req.query.target === "string" ? req.query.target.trim() : "";
  let cleared = 0;
  if (target) {
    for (const key of [...cache.keys()]) {
      if (key.startsWith(target)) { cache.delete(key); cleared++; }
    }
  } else {
    cleared = cache.size;
    cache.clear();
  }
  res.json({ cleared, remaining: cache.size, target: target || "all" });
});

i18nRouter.get("/health", (_req, res) => {
  const deeplConfigured = !!process.env.DEEPL_API_KEY?.trim();
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY?.trim();
  res.json({
    status: "ok",
    service: "i18n-translate",
    deeplConfigured,
    anthropicConfigured,
    // Effective engine. With DeepL configured, Claude is the runtime fallback
    // (quota/errors) and also handles kk. "none" means neither key is set →
    // translation fails for all languages.
    engine: deeplConfigured
      ? (anthropicConfigured ? "deepl→claude(fallback)" : "deepl(no-fallback)")
      : anthropicConfigured ? "claude(all)" : "none",
    languages: Array.from(new Set([...Object.keys(DEEPL_TARGET), ...Object.keys(LANG_NAME)])).sort(),
    cacheSize: cache.size,
  });
});

// Diagnostic: report DeepL quota state WITHOUT exposing the key. Answers
// "is DeepL over quota?" — the exact prod condition that used to 500 site-wide
// translation before the Claude fallback landed. keyType is inferred from the
// ":fx" free-key suffix; usage comes from DeepL's /v2/usage endpoint.
i18nRouter.get("/deepl-usage", async (_req, res) => {
  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) return res.json({ configured: false, note: "DEEPL_API_KEY not set; all languages route to Claude" });
  const free = apiKey.endsWith(":fx");
  const endpoint = free ? "https://api-free.deepl.com/v2/usage" : "https://api.deepl.com/v2/usage";
  try {
    const r = await fetch(endpoint, { headers: { Authorization: `DeepL-Auth-Key ${apiKey}` } });
    const data = (await r.json()) as { character_count?: number; character_limit?: number; message?: string };
    if (!r.ok) throw new Error(`DeepL ${r.status}: ${data?.message || JSON.stringify(data)}`);
    const used = data.character_count ?? 0;
    const limit = data.character_limit ?? 0;
    res.json({
      configured: true,
      keyType: free ? "free" : "pro",
      characterCount: used,
      characterLimit: limit,
      percentUsed: limit ? Math.round((used / limit) * 1000) / 10 : null,
      overQuota: limit > 0 && used >= limit,
      note: "over quota → translation transparently falls back to Claude (no user-facing break)",
    });
  } catch (e) {
    res.status(502).json({ configured: true, keyType: free ? "free" : "pro", error: e instanceof Error ? e.message : "usage check failed" });
  }
});
