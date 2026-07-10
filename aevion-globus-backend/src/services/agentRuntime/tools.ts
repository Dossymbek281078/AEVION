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
  return input;
}

/**
 * Build an ExecTool that runs a tool call against the running server's own
 * DevHub endpoints. `baseUrl` is the server's self URL (e.g. http://127.0.0.1:PORT).
 */
export function makeExecutor(baseUrl: string, fetchImpl: typeof fetch = fetch): ExecTool {
  return async (call: ToolCall) => {
    const path = ENDPOINT_BY_TOOL[call.name];
    if (!path) return { ok: false, content: `Unknown tool: ${call.name}` };
    try {
      const r = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(call.name, call.input || {})),
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, content: data };
    } catch (e) {
      return { ok: false, content: (e as Error).message };
    }
  };
}
