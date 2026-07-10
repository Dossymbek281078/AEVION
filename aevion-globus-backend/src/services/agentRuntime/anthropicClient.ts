/**
 * agentRuntime — real provider adapter (Anthropic Messages API, tool-use).
 *
 * Converts our neutral LoopMessage/ToolSpec format to Anthropic's tool-use wire
 * format and back into a ModelStep. This is the I/O boundary — it needs
 * ANTHROPIC_API_KEY at runtime; the loop that drives it (loop.ts) stays pure.
 */

import type { CallModel, LoopMessage, ModelStep, ToolSpec } from "./loop";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicBlock[];
}

/** Our transcript → Anthropic messages. */
function toAnthropicMessages(messages: LoopMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text ?? "" });
    } else if (m.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (m.text) blocks.push({ type: "text", text: m.text });
      for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      out.push({ role: "assistant", content: blocks.length ? blocks : (m.text ?? "") });
    } else if (m.role === "tool") {
      const blocks: AnthropicBlock[] = (m.toolResults ?? []).map((r) => ({
        type: "tool_result",
        tool_use_id: r.callId,
        content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
      }));
      out.push({ role: "user", content: blocks });
    }
  }
  return out;
}

export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  system?: string;
  fetchImpl?: typeof fetch;
}

/** Build a CallModel backed by the Anthropic Messages API with tool-use. */
export function makeAnthropicCallModel(opts: AnthropicOptions = {}): CallModel {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
  const model = opts.model ?? process.env.AGENT_RUNTIME_MODEL ?? "claude-sonnet-5";
  const maxTokens = opts.maxTokens ?? 1024;
  const doFetch = opts.fetchImpl ?? fetch;

  return async (messages: LoopMessage[], tools: ToolSpec[]): Promise<ModelStep> => {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — the agent runtime cannot call the model.");

    const r = await doFetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
        messages: toAnthropicMessages(messages),
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      throw new Error(`Anthropic error ${r.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await r.json()) as { content?: AnthropicBlock[] };
    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks
      .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolCalls = blocks
      .filter((b): b is Extract<AnthropicBlock, { type: "tool_use" }> => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input || {} }));

    return { text, toolCalls };
  };
}
