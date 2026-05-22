/**
 * Constitution AI advisor.
 *
 * POST /api/constitution/ai-suggest
 *   body: { description: string }
 *   returns: { sliders: Record<keyof Sliders, number>, explanation: string }
 *
 * Pipeline:
 *   1) Build system+user messages with a strict JSON-output contract
 *   2) Call internal /api/qcoreai/chat (reuses provider routing, key
 *      management, rate-limits — single source of truth for AI calls)
 *   3) Extract JSON block from the reply, validate slider shape
 *   4) Return sliders + a short human explanation
 *
 * If QCoreAI returns "stub" mode (no provider configured), we return a
 * heuristic stub answer so the UI flow stays demonstrable.
 */

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";

const SLIDER_KEYS = [
  "floor",
  "ruleOfLaw",
  "rotation",
  "transparency",
  "multiStatus",
  "skinInGame",
  "polycentricity",
  "positiveSum",
] as const;

type SliderKey = (typeof SLIDER_KEYS)[number];
type Sliders = Record<SliderKey, number>;

const SYSTEM_PROMPT = `You are an expert in political economy, history of governance, and institutional analysis.

Your job: read a free-form description of a country, society, or hypothetical system, and return calibrated slider values (0-100) for 8 governance dimensions, plus a 1-3 sentence explanation in the user's own language.

The 8 sliders:
- floor: how strong the universal floor is (UBI, free education, healthcare). 0 = nothing, 100 = nobody falls below.
- ruleOfLaw: how much law binds the top elite. 0 = law for the poor only, 100 = oligarchs lose in court too.
- rotation: how much rotation and sortition exists (random citizens in deliberative bodies). 0 = lifetime castes, 100 = regular sortition.
- transparency: how open elite decisions are. 0 = dark rooms, 100 = glass corridors.
- multiStatus: how many legitimate status axes exist (science, craft, care, art, not only money/power). 0 = one axis, 100 = many.
- skinInGame: how much decision-makers personally bear consequences. 0 = decide-without-risk, 100 = everybody at stake.
- polycentricity: how much real sovereignty local jurisdictions have. 0 = super-state, 100 = federation of locales.
- positiveSum: how much the pie is really and visibly growing. 0 = pure distribution / extraction, 100 = inclusive growth.

OUTPUT FORMAT — STRICT:
Reply with ONLY a fenced JSON block. No prose outside the block.
\`\`\`json
{
  "sliders": {
    "floor": 0-100,
    "ruleOfLaw": 0-100,
    "rotation": 0-100,
    "transparency": 0-100,
    "multiStatus": 0-100,
    "skinInGame": 0-100,
    "polycentricity": 0-100,
    "positiveSum": 0-100
  },
  "explanation": "1-3 sentences in the user's own language about the key choices."
}
\`\`\``;

function clampSlider(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extractJson(text: string): unknown {
  // Try fenced block first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : text).trim();
  // Try direct parse
  try {
    return JSON.parse(candidate);
  } catch {
    /* try to find first { ... } */
  }
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function parseSliders(parsed: unknown): { sliders: Sliders; explanation: string } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const slidersRaw = (o.sliders ?? o) as Record<string, unknown>;
  if (!slidersRaw || typeof slidersRaw !== "object") return null;
  const sliders = {} as Sliders;
  for (const k of SLIDER_KEYS) {
    sliders[k] = clampSlider(slidersRaw[k]);
  }
  const explanation =
    typeof o.explanation === "string"
      ? o.explanation.slice(0, 800)
      : "AI-предложение по 8 ползункам устройства мира.";
  return { sliders, explanation };
}

/** Heuristic stub when QCoreAI returns "stub" mode (no provider key). */
function stubSuggest(description: string): { sliders: Sliders; explanation: string } {
  const text = description.toLowerCase();
  const sliders: Sliders = {
    floor: 40,
    ruleOfLaw: 50,
    rotation: 25,
    transparency: 40,
    multiStatus: 40,
    skinInGame: 40,
    polycentricity: 35,
    positiveSum: 55,
  };
  if (/норвег|sweden|сканд|nordic|финлянд|denmark/i.test(text)) {
    Object.assign(sliders, { floor: 85, ruleOfLaw: 88, transparency: 85, positiveSum: 70 });
  }
  if (/коре|kor|kp|кндр|dprk/i.test(text) && /север|north|кндр/i.test(text)) {
    Object.assign(sliders, { floor: 15, ruleOfLaw: 8, rotation: 5, transparency: 5, positiveSum: 20 });
  }
  if (/сингапур|singapor/i.test(text)) {
    Object.assign(sliders, { floor: 65, ruleOfLaw: 80, transparency: 65, positiveSum: 85, rotation: 15, polycentricity: 10 });
  }
  if (/казахст|kazakh|казах/i.test(text)) {
    Object.assign(sliders, { floor: 50, ruleOfLaw: 40, transparency: 30, positiveSum: 60, polycentricity: 25 });
  }
  return {
    sliders,
    explanation:
      "QCoreAI provider не настроен — это эвристическое приближение по ключевым словам. Чтобы получить настоящий AI-анализ, добавь OPENAI_API_KEY / ANTHROPIC_API_KEY в backend env.",
  };
}

async function callQCoreAiChat(description: string): Promise<{
  reply: string;
  mode: string;
}> {
  const port = process.env.PORT || 4001;
  const url = `http://127.0.0.1:${port}/api/qcoreai/chat`;
  const body = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: description.slice(0, 4000) },
    ],
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`QCoreAI HTTP ${r.status}`);
  }
  const j = (await r.json()) as { reply?: string; mode?: string };
  return { reply: j.reply ?? "", mode: j.mode ?? "unknown" };
}

export const constitutionAiRouter = Router();

const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "constitution-ai",
});

constitutionAiRouter.post(
  "/ai-suggest",
  limiter as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const description = typeof body.description === "string"
        ? body.description.trim()
        : "";
      if (!description || description.length < 8) {
        return res.status(400).json({
          error: "description_too_short",
          hint: "Опиши страну/общество одним-двумя предложениями.",
        });
      }
      let qc: { reply: string; mode: string };
      try {
        qc = await callQCoreAiChat(description);
      } catch (err) {
        const stub = stubSuggest(description);
        return res.json({
          ...stub,
          provider: "stub-error",
          note:
            "QCoreAI call failed: " +
            (err instanceof Error ? err.message : "unknown"),
        });
      }
      if (qc.mode === "stub") {
        const stub = stubSuggest(description);
        return res.json({
          ...stub,
          provider: "stub-mode",
        });
      }
      const parsed = extractJson(qc.reply);
      const result = parseSliders(parsed);
      if (!result) {
        // Provider replied but JSON couldn't be extracted
        const stub = stubSuggest(description);
        return res.json({
          ...stub,
          provider: qc.mode,
          note: "AI ответил не JSON; вернули эвристику. Реальный ответ: " + qc.reply.slice(0, 200),
        });
      }
      return res.json({ ...result, provider: qc.mode });
    } catch (err) {
      res.status(500).json({
        error: "ai_suggest_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);
