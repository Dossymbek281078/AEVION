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
];

/** Map a tool name → the DevHub endpoint path that performs it. */
const ENDPOINT_BY_TOOL: Record<string, string> = {
  generate_image: "/api/devhub/media/image",
  text_to_speech: "/api/devhub/media/tts",
  payment_link: "/api/devhub/media/payment-link",
  send_email: "/api/devhub/media/email",
};

/** Rename model-facing params to the DevHub endpoint's body shape where needed. */
function toBody(name: string, input: Record<string, unknown>): Record<string, unknown> {
  if (name === "generate_image") return { prompt: input.prompt, ...(input.size ? { size: input.size } : {}) };
  if (name === "text_to_speech") return { text: input.text, ...(input.voice ? { voice: input.voice } : {}) };
  if (name === "payment_link") return { name: input.name ?? "AEVION payment", amountCents: input.amountCents, description: input.description ?? "" };
  if (name === "send_email") return { to: input.to, subject: input.subject ?? "Message from AEVION Agent", htmlBody: input.htmlBody };
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
