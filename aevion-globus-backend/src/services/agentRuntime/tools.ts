/**
 * agentRuntime — tool specs + executors.
 *
 * Tools are exposed to the model as function-callable capabilities. Each maps to
 * an EXISTING DevHub media endpoint; the executor reaches it by internal HTTP so
 * we reuse that logic without importing or modifying devhub.ts (owned elsewhere).
 */

import type { ToolSpec, ToolCall, ExecTool } from "./loop";

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "generate_image",
    description: "Generate an image from a text description (DALL-E 3).",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What to draw." },
        size: { type: "string", enum: ["1024x1024", "1792x1024", "1024x1792"], description: "Optional." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "text_to_speech",
    description: "Turn text into a spoken voice clip (ElevenLabs).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to speak." },
        voice: { type: "string", description: "Optional voice name." },
      },
      required: ["text"],
    },
  },
  {
    name: "payment_link",
    description: "Create a hosted payment link / checkout for an amount.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amountCents: { type: "integer", description: "Price in cents (e.g. 2500 = $25)." },
        description: { type: "string" },
      },
      required: ["amountCents"],
    },
  },
  {
    name: "send_email",
    description: "Send a transactional email (Brevo).",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string" },
        htmlBody: { type: "string" },
      },
      required: ["to", "htmlBody"],
    },
  },
  {
    name: "generate_music",
    description: "Compose an instrumental music clip from a text description (ElevenLabs Music).",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Describe the music (mood, genre, instruments)." },
        musicLengthMs: { type: "integer", description: "Optional clip length in milliseconds (e.g. 10000 = 10s)." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_sound_effect",
    description: "Generate a short sound effect from a text description (ElevenLabs SFX).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Describe the sound (e.g. 'glass shattering on tile')." },
        durationSeconds: { type: "number", description: "Optional length in seconds (0.5–22)." },
      },
      required: ["text"],
    },
  },
  {
    name: "send_sms",
    description: "Send an SMS text message (Brevo/Twilio-backed).",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Recipient phone number in E.164 form (e.g. +15551234567)." },
        content: { type: "string", description: "Message text." },
        sender: { type: "string", description: "Optional sender name/number." },
      },
      required: ["recipient", "content"],
    },
  },
  {
    name: "translate_text",
    description: "Translate text into another language (DeepL).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to translate." },
        targetLang: { type: "string", description: "Target language code (e.g. EN, RU, KK, DE, FR)." },
        sourceLang: { type: "string", description: "Optional source language code; auto-detected if omitted." },
      },
      required: ["text", "targetLang"],
    },
  },
  {
    name: "generate_code",
    description:
      "Generate or update code file(s) with AI and save them directly into the DevHub project the user currently " +
      "has open. Only works when the request carries project context (i.e. the user is on a DevHub project page) " +
      "— if there is no open project, this tool is unavailable. When a change needs multiple files to work together " +
      "(e.g. an API route plus the page that calls it), pass all of them in targetFiles in one call so they're " +
      "generated together and kept consistent with each other — don't call this tool once per file for a coordinated change.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What to build, e.g. 'a login form with email and password fields'." },
        targetFile: { type: "string", description: "Optional single file path to write, e.g. 'pages/login.tsx'. Omit to let the generator choose. Use targetFiles instead for more than one file." },
        targetFiles: { type: "array", items: { type: "string" }, description: "Optional list of file paths to generate/edit together in one coordinated call, e.g. ['pages/api/login.ts', 'pages/login.tsx']." },
      },
      required: ["prompt"],
    },
  },
];

/** Map a tool name → the DevHub endpoint path that performs it. */
const ENDPOINT_BY_TOOL: Record<string, string> = {
  generate_image: "/api/devhub/media/image",
  text_to_speech: "/api/devhub/media/tts",
  payment_link: "/api/devhub/media/payment-link",
  send_email: "/api/devhub/media/email",
  generate_music: "/api/devhub/media/music",
  generate_sound_effect: "/api/devhub/media/sfx",
  send_sms: "/api/devhub/media/sms",
  translate_text: "/api/devhub/media/translate",
};

/** Rename model-facing params to the DevHub endpoint's body shape where needed. */
function toBody(name: string, input: Record<string, unknown>): Record<string, unknown> {
  if (name === "generate_image") return { prompt: input.prompt, ...(input.size ? { size: input.size } : {}) };
  if (name === "text_to_speech") return { text: input.text, ...(input.voice ? { voice: input.voice } : {}) };
  if (name === "payment_link") return { name: input.name ?? "AEVION payment", amountCents: input.amountCents, description: input.description ?? "" };
  if (name === "send_email") return { to: input.to, subject: input.subject ?? "Message from AEVION Agent", htmlBody: input.htmlBody };
  if (name === "generate_music") return { prompt: input.prompt, ...(input.musicLengthMs ? { musicLengthMs: input.musicLengthMs } : {}) };
  if (name === "generate_sound_effect") return { text: input.text, ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}) };
  if (name === "send_sms") return { recipient: input.recipient, content: input.content, ...(input.sender ? { sender: input.sender } : {}) };
  if (name === "translate_text") return { text: input.text, targetLang: input.targetLang, ...(input.sourceLang ? { sourceLang: input.sourceLang } : {}) };
  if (name === "generate_code") {
    return {
      prompt: input.prompt,
      ...(input.targetFile ? { targetFile: input.targetFile } : {}),
      ...(Array.isArray(input.targetFiles) ? { targetFiles: input.targetFiles } : {}),
    };
  }
  return input;
}

/** Per-request context an executor may need beyond the model's tool input. */
export interface ExecutorContext {
  /** DevHub project id, when the caller is on a DevHub project page — required by generate_code. */
  projectId?: string;
  /** Forwarded as-is to project-scoped endpoints so ownership checks (e.g. /generate) see the real caller. */
  authHeader?: string;
}

/**
 * Build an ExecTool that runs a tool call against the running server's own
 * DevHub endpoints. `baseUrl` is the server's self URL (e.g. http://127.0.0.1:PORT).
 * `context` carries per-request info (like the open project id) that isn't part
 * of the model's tool input — e.g. generate_code writes into `context.projectId`.
 */
export function makeExecutor(baseUrl: string, fetchImpl: typeof fetch = fetch, context: ExecutorContext = {}): ExecTool {
  return async (call: ToolCall) => {
    let path = ENDPOINT_BY_TOOL[call.name];
    if (call.name === "generate_code") {
      if (!context.projectId) {
        return { ok: false, content: "No DevHub project is open — generate_code needs an open project to write into." };
      }
      path = `/api/devhub/projects/${context.projectId}/generate`;
    }
    if (!path) return { ok: false, content: `Unknown tool: ${call.name}` };
    try {
      const r = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(context.authHeader ? { Authorization: context.authHeader } : {}),
        },
        body: JSON.stringify(toBody(call.name, call.input || {})),
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, content: data };
    } catch (e) {
      return { ok: false, content: (e as Error).message };
    }
  };
}
