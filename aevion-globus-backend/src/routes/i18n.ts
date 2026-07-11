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

// Server-side translation cache: `${target}${text}` -> translation.
// Bounded; survives within a deploy. Client localStorage covers cross-deploy.
const cache = new Map<string, string>();
const MAX_CACHE = 60_000;
const MAX_TEXTS = 200;
const MAX_LEN = 5_000;

const ckey = (target: string, text: string) => `${target}${text}`;

async function deeplBatch(texts: string[], deeplTarget: string): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPL_API_KEY not configured");
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = new URLSearchParams();
  for (const t of texts) params.append("text", t);
  params.set("target_lang", deeplTarget);
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
  const out = (data.translations || []).map((t) => t.text);
  if (out.length !== texts.length) throw new Error("DeepL length mismatch");
  return out;
}

async function claudeBatch(texts: string[], langName: string): Promise<string[]> {
  const sys =
    `You are a precise UI string translator. Translate each input string to ${langName}. ` +
    `Rules: keep placeholders ({x}, %s, :id), numbers, URLs, and brand/product names ` +
    `(AEVION, Planet, QSign, QRight, QShield, QCoreAI, Bureau, API, SDK, AEC, AEV, HMAC, JWT) ` +
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
async function translateBatch(target: string, texts: string[]): Promise<string[]> {
  const deeplReady = !!process.env.DEEPL_API_KEY?.trim();
  const deeplTarget = DEEPL_TARGET[target];
  if (deeplReady && deeplTarget) {
    try {
      return await deeplBatch(texts, deeplTarget);
    } catch (e) {
      console.warn(
        `[i18n] DeepL failed for "${target}" (${e instanceof Error ? e.message : e}); falling back to Claude`
      );
    }
  }
  return claudeBatch(texts, LANG_NAME[target] || target);
}

i18nRouter.post("/translate", async (req, res) => {
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
        const tr = translated[j] ?? missTexts[j];
        out[missIdx[j]] = tr;
        if (cache.size < MAX_CACHE) cache.set(ckey(target, missTexts[j]), tr);
      }
    }

    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({ translations: out, target, cached: texts.length - missTexts.length });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "translate failed" });
  }
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
