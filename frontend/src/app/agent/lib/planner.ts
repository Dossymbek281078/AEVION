/**
 * AEVION Agent — planner.
 *
 * One window, two modes: plain TEXT (chat) or an ACTION carried out through an
 * existing AEVION capability — without opening a second tab. This module is the
 * deterministic "head": it reads a message and decides whether to answer as
 * chat or to route to a tool, and it builds that tool's request body.
 *
 * Design note: this is intentionally a pure, rule-based planner (no LLM call),
 * so it is fully unit-testable and cannot silently misfire. The page executes
 * the plan against endpoints that ALREADY exist (QCoreAI chat + DevHub media
 * actions); nothing here touches the multichat or qcoreai internals owned by
 * other work streams. A future phase can swap this for LLM function-calling.
 */

export type AgentMode = "chat" | "action";
export type ToolResultKind = "image" | "audio" | "link" | "email" | "text";

export interface AgentTool {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** apiUrl() path of the EXISTING backend endpoint this tool calls. */
  endpoint: string;
  method: "POST";
  resultKind: ToolResultKind;
  /** Intent patterns — first tool whose pattern matches wins. */
  patterns: RegExp[];
  /** Build the request body for the matched message. */
  buildBody: (message: string) => Record<string, unknown>;
  /** Body keys that must be non-empty for the action to run. */
  required: string[];
}

export interface AgentPlan {
  mode: AgentMode;
  toolId: string | null;
  tool: AgentTool | null;
  params: Record<string, unknown> | null;
  /** Required params the planner could not fill from the message. */
  missing: string[];
  rationale: string;
}

/** Parse a money amount → integer cents. "$12.50", "12 долларов", "10 usd" → 1250 / 1200 / 1000. */
export function extractAmountCents(message: string): number | null {
  const m = message.match(/(?:\$|\busd\b|(?<![а-яё])доллар[а-яё]*)\s*([0-9]+(?:[.,][0-9]{1,2})?)|([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:\$|usd|доллар\w*|бакс\w*)/i);
  if (!m) return null;
  const raw = (m[1] ?? m[2] ?? "").replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** First e-mail address in the message, or "". */
export function extractEmail(message: string): string {
  const m = message.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0] : "";
}

/**
 * Tool registry. Order = priority: the first tool whose pattern matches wins,
 * so more specific intents (payment, email) are listed before broader ones.
 */
export const TOOLS: AgentTool[] = [
  {
    id: "payment-link",
    label: "Payment link",
    emoji: "💳",
    description: "Create a hosted checkout / payment link (LemonSqueezy).",
    endpoint: "/api/devhub/media/payment-link",
    method: "POST",
    resultKind: "link",
    patterns: [/оплат|плат[её]ж|счёт|invoice|payment|checkout|charge|выстав.{0,6}счёт/i],
    buildBody: (message) => ({
      name: "AEVION payment",
      amountCents: extractAmountCents(message) ?? 1000,
      description: message.trim().slice(0, 300),
    }),
    required: ["amountCents"],
  },
  {
    id: "email",
    label: "Send email",
    emoji: "✉️",
    description: "Send a transactional email (Brevo).",
    endpoint: "/api/devhub/media/email",
    method: "POST",
    resultKind: "email",
    patterns: [/(?:отправ|напис|пошл)[а-яё]*\s+(?:письм[а-яё]*|почт[а-яё]*|mail|e-?mail|емейл)|send\s+(?:an?\s+)?e-?mail/i],
    buildBody: (message) => ({
      to: extractEmail(message),
      subject: "Message from AEVION Agent",
      htmlBody: message.trim(),
    }),
    required: ["to"],
  },
  {
    id: "image",
    label: "Generate image",
    emoji: "🎨",
    description: "Generate an image from a description (DALL-E 3).",
    endpoint: "/api/devhub/media/image",
    method: "POST",
    resultKind: "image",
    patterns: [/нарису[а-яё]*|картин[а-яё]*|изображен[а-яё]*|иллюстрац[а-яё]*|логотип|\blogo\b|\bimage\b|picture|\bdraw\b|сгенерир[а-яё]*\s+(?:картин|изображ|image)/i],
    buildBody: (message) => ({ prompt: message.trim().slice(0, 4000) }),
    required: ["prompt"],
  },
  {
    id: "tts",
    label: "Text to speech",
    emoji: "🔊",
    description: "Turn text into a spoken voice clip (ElevenLabs).",
    endpoint: "/api/devhub/media/tts",
    method: "POST",
    resultKind: "audio",
    patterns: [/озвуч[а-яё]*|голос[а-яё]*|прочит[а-яё]*\s+вслух|\bvoice\b|\bspeak\b|text-?to-?speech|\btts\b|\baudio\b/i],
    buildBody: (message) => ({ text: message.trim(), voice: "Rachel" }),
    required: ["text"],
  },
];

const NON_EMPTY = (v: unknown): boolean =>
  typeof v === "number" ? Number.isFinite(v) : typeof v === "string" ? v.trim().length > 0 : v != null;

/**
 * Decide how to handle a message. Returns a chat plan when no action intent is
 * detected, or an action plan (with built params and any missing required
 * fields flagged) when a tool matches.
 */
export function planFromMessage(message: string): AgentPlan {
  const text = (message ?? "").trim();
  if (!text) {
    return { mode: "chat", toolId: null, tool: null, params: null, missing: [], rationale: "Empty message — nothing to do." };
  }

  for (const tool of TOOLS) {
    if (tool.patterns.some((p) => p.test(text))) {
      const params = tool.buildBody(text);
      const missing = tool.required.filter((k) => !NON_EMPTY(params[k]));
      return {
        mode: "action",
        toolId: tool.id,
        tool,
        params,
        missing,
        rationale: missing.length
          ? `Matched ${tool.label}, but missing: ${missing.join(", ")}. Add it and run.`
          : `Matched ${tool.label} — ready to run without leaving this window.`,
      };
    }
  }

  return {
    mode: "chat",
    toolId: null,
    tool: null,
    params: null,
    missing: [],
    rationale: "No action intent detected — answering as text.",
  };
}

/**
 * ── LLM-assisted planning ───────────────────────────────────────────────────
 * A step up from the rule matcher: ask the model (through the EXISTING
 * /api/qcoreai/chat endpoint — no provider changes) to classify intent and
 * return JSON. This is prompt-driven planning, NOT the provider tool-use API;
 * naming it honestly matters. The page calls the chat endpoint with the system
 * prompt below, then parses the reply with `parseLLMPlan`, falling back to the
 * rule planner when the model returns anything unusable.
 */
export function buildPlannerSystemPrompt(tools: AgentTool[] = TOOLS): string {
  const list = tools
    .map((t) => `- "${t.id}": ${t.description} required params: [${t.required.join(", ") || "none"}]`)
    .join("\n");
  return (
    "You are AEVION Agent's planner. Read the user's message and decide how to handle it.\n" +
    "Reply with ONLY a JSON object, no prose, no code fences:\n" +
    '{"mode":"chat"|"action","toolId":<tool id or null>,"params":{...},"rationale":"<short>"}\n' +
    "If the user is asking a question or wants text, use mode \"chat\" (toolId null).\n" +
    "If they want one of these actions, use mode \"action\" and fill params from the message:\n" +
    list
  );
}

/**
 * Parse an LLM planner reply into an AgentPlan. Tolerant of surrounding prose /
 * code fences. Returns null when the reply is unusable or names an unknown tool
 * (caller should fall back to `planFromMessage`).
 */
export function parseLLMPlan(raw: string, tools: AgentTool[] = TOOLS): AgentPlan | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (obj.mode !== "action") {
    return {
      mode: "chat",
      toolId: null,
      tool: null,
      params: null,
      missing: [],
      rationale: typeof obj.rationale === "string" ? obj.rationale : "LLM planner: answering as text.",
    };
  }

  const tool = tools.find((t) => t.id === obj.toolId);
  if (!tool) return null; // unknown tool → let the caller fall back to rules

  const given = obj.params && typeof obj.params === "object" ? (obj.params as Record<string, unknown>) : {};
  // Merge model-provided params over the rule-built defaults so required keys exist.
  const params = { ...tool.buildBody(typeof given.text === "string" ? given.text : ""), ...given };
  const missing = tool.required.filter((k) => !NON_EMPTY(params[k]));
  return {
    mode: "action",
    toolId: tool.id,
    tool,
    params,
    missing,
    rationale: typeof obj.rationale === "string" ? obj.rationale : `LLM planner: ${tool.label}.`,
  };
}
