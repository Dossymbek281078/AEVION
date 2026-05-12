/**
 * QFusionAI — smart router across multiple LLM providers.
 *
 * Thin orchestration on top of /api/qcoreai providers: classifies a prompt into
 * one of a few categories and routes to the strongest *configured* provider for
 * that category. Provides a single endpoint partners can call without owning
 * provider keys themselves.
 */

import { Router, type Request, type Response } from "express";
import {
  callProvider,
  getProviders,
  sanitizeMessages,
  type ChatMessage,
} from "../services/qcoreai/providers";
import { rateLimit } from "../lib/rateLimit";

export const qfusionaiRouter = Router();

// ── Routing policy ──────────────────────────────────────────────────────────
// Order = preference. First configured provider in the list wins.
const ROUTING: Record<string, string[]> = {
  code: ["deepseek", "anthropic", "openai", "gemini", "grok"],
  creative: ["anthropic", "openai", "grok", "gemini", "deepseek"],
  factual: ["openai", "anthropic", "gemini", "deepseek", "grok"],
  longctx: ["gemini", "anthropic", "openai", "deepseek", "grok"],
  math: ["deepseek", "openai", "anthropic", "gemini", "grok"],
  general: ["anthropic", "openai", "gemini", "deepseek", "grok"],
};

type Category = keyof typeof ROUTING;

function classifyPrompt(prompt: string): Category {
  const p = prompt.toLowerCase();
  const codeHints = /\b(code|function|class|bug|error|stack ?trace|typescript|python|rust|javascript|java|c\+\+|sql|regex|api|debug|refactor|компил|функци|класс|баг|ошибк|регэксп)\b/;
  const mathHints = /\b(equation|solve|derivative|integral|matrix|prob[ae]bility|theorem|proof|уравнен|производн|интеграл|матриц|вероятн|теорем|доказательств)\b/;
  const creativeHints = /\b(story|poem|song|joke|роман|рассказ|стих|шутк|сценар|character|персонаж|metaphor|метафор)\b/;
  const factualHints = /\b(what is|when did|who is|where is|define|history of|что так|когда|кто так|где|определени|истори)\b/;
  if (codeHints.test(p)) return "code";
  if (mathHints.test(p)) return "math";
  if (creativeHints.test(p)) return "creative";
  if (prompt.length > 4000) return "longctx";
  if (factualHints.test(p)) return "factual";
  return "general";
}

function pickProviderFor(category: Category): string | null {
  const configured = new Set(getProviders().filter((p) => p.configured).map((p) => p.id));
  for (const id of ROUTING[category]) {
    if (configured.has(id)) return id;
  }
  return null;
}

// ── Endpoints ───────────────────────────────────────────────────────────────

const routeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "qfusionai:route",
  message: "rate_limit_exceeded: max 20 routes per minute per IP",
});

qfusionaiRouter.get("/health", (_req, res) => {
  const providers = getProviders().map((p) => ({ id: p.id, name: p.name, configured: p.configured }));
  res.json({
    ok: true,
    module: "qfusionai",
    providers,
    routes: Object.keys(ROUTING),
  });
});

qfusionaiRouter.post("/route", routeLimiter, async (req: Request, res: Response) => {
  const body = req.body || {};
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "prompt-required" });
  }
  if (prompt.length > 32000) {
    return res.status(413).json({ error: "prompt-too-long", maxLength: 32000 });
  }

  const hint =
    typeof body.hint === "string" && body.hint in ROUTING
      ? (body.hint as Category)
      : "auto";

  const category: Category = hint === "auto" ? classifyPrompt(prompt) : hint;
  const provider = pickProviderFor(category);

  if (!provider) {
    return res.status(503).json({
      error: "no-provider-configured",
      category,
      hint:
        "Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, or GROK_API_KEY on the server.",
    });
  }

  const providerMeta = getProviders().find((p) => p.id === provider);
  if (!providerMeta) {
    return res.status(503).json({ error: "provider-not-found", provider });
  }
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim().slice(0, 100)
      : providerMeta.defaultModel;
  const rawTemp = typeof body.temperature === "number" ? body.temperature : 0.7;
  if (!Number.isFinite(rawTemp) || rawTemp < 0 || rawTemp > 2) {
    return res.status(400).json({ error: "invalid-temperature", hint: "must be a finite number in [0, 2]" });
  }
  const temperature = rawTemp;

  const messages: ChatMessage[] =
    sanitizeMessages(body.messages) ?? [
      { role: "system", content: "You are AEVION QFusionAI, routing prompts to the best provider for each task." },
      { role: "user", content: prompt },
    ];

  const t0 = Date.now();
  try {
    const result = await callProvider(provider, messages, model, temperature);
    res.json({
      provider,
      providerName: providerMeta.name,
      model: result.model,
      reply: result.reply,
      category,
      hint,
      durationMs: Date.now() - t0,
      usage: result.usage ?? null,
    });
  } catch (err) {
    console.error("[qfusionai] provider call failed", { provider, model, err: err instanceof Error ? err.message : err });
    res.status(502).json({
      error: "provider-error",
      provider,
      durationMs: Date.now() - t0,
    });
  }
});

qfusionaiRouter.options("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

qfusionaiRouter.get("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const base = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/$/, "");
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEVION QFusionAI",
      version: "1.0.0",
      description:
        "Smart multi-provider LLM router. Classifies prompts and picks the strongest configured provider (Anthropic / OpenAI / Gemini / DeepSeek / Grok).",
      contact: { name: "AEVION", url: "https://aevion.app", email: "support@aevion.app" },
    },
    servers: [{ url: `${base}/api/qfusionai`, description: "Production" }],
    paths: {
      "/health": {
        get: {
          summary: "Health + configured providers",
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      module: { type: "string" },
                      providers: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            configured: { type: "boolean" },
                          },
                        },
                      },
                      routes: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/route": {
        post: {
          summary: "Route a prompt to the best provider",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["prompt"],
                  properties: {
                    prompt: { type: "string", maxLength: 32000 },
                    hint: {
                      type: "string",
                      enum: ["auto", "code", "creative", "factual", "longctx", "math", "general"],
                      default: "auto",
                    },
                    model: { type: "string" },
                    temperature: { type: "number", minimum: 0, maximum: 2 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Routed reply",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      provider: { type: "string" },
                      providerName: { type: "string" },
                      model: { type: "string" },
                      reply: { type: "string" },
                      category: { type: "string" },
                      durationMs: { type: "integer" },
                    },
                  },
                },
              },
            },
            "400": { description: "prompt missing" },
            "413": { description: "prompt too long" },
            "503": { description: "no configured provider" },
          },
        },
      },
    },
  });
});
