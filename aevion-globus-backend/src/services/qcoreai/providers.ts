/**
 * QCoreAI providers — common adapter layer for all supported LLMs.
 *
 * Two surfaces:
 *   - callProvider(...) — classic non-streaming, returns { reply, model, usage }.
 *   - streamProvider(...) — async generator yielding text chunks + final event.
 *
 * Used by both the legacy POST /api/qcoreai/chat route and the new
 * multi-agent orchestrator.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Provider = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  envKey: string;
  configured: boolean;
};

export type StreamEvent =
  | { kind: "text"; text: string }
  | { kind: "done"; tokensIn?: number; tokensOut?: number };

export function getProviders(): Provider[] {
  return [
    {
      id: "anthropic",
      name: "Claude (Anthropic)",
      models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
      defaultModel: "claude-sonnet-4-20250514",
      envKey: "ANTHROPIC_API_KEY",
      configured: !!process.env.ANTHROPIC_API_KEY?.trim(),
    },
    {
      id: "openai",
      name: "GPT (OpenAI)",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
      defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      envKey: "OPENAI_API_KEY",
      configured: !!process.env.OPENAI_API_KEY?.trim(),
    },
    {
      id: "gemini",
      name: "Gemini (Google)",
      models: ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-1.5-pro"],
      defaultModel: "gemini-2.5-flash",
      envKey: "GEMINI_API_KEY",
      configured: !!process.env.GEMINI_API_KEY?.trim(),
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      models: ["deepseek-chat", "deepseek-reasoner"],
      defaultModel: "deepseek-chat",
      envKey: "DEEPSEEK_API_KEY",
      configured: !!process.env.DEEPSEEK_API_KEY?.trim(),
    },
    {
      id: "grok",
      name: "Grok (xAI)",
      models: ["grok-3", "grok-3-mini"],
      defaultModel: "grok-3-mini",
      envKey: "GROK_API_KEY",
      configured: !!process.env.GROK_API_KEY?.trim(),
    },
  ];
}

export function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content: content.slice(0, 32000) });
  }
  return out.length ? out : null;
}

export function resolveProvider(providerId?: string): string {
  if (providerId) {
    const p = getProviders().find((p) => p.id === providerId);
    if (p?.configured) return p.id;
  }
  for (const p of getProviders()) {
    if (p.configured) return p.id;
  }
  return "stub";
}

/** Pick a provider id from a preference list; fallback to first configured. */
export function pickConfiguredProvider(preferred?: string): string {
  return resolveProvider(preferred);
}

/* ═══════════════════════════════════════════════════════════════════════
   Non-streaming calls (legacy /chat endpoint)
   ═══════════════════════════════════════════════════════════════════════ */

export type CallResult = {
  reply: string;
  model: string;
  usage: any;
};

async function callAnthropic(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const body: any = {
    model,
    max_tokens: 4096,
    temperature,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) body.system = systemMsg.content;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic ${r.status}`);
  const reply = data.content?.map((b: any) => b.text || "").join("") || "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

async function callOpenAI(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `OpenAI ${r.status}`);
  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

async function callGemini(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: 4096 },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `Gemini ${r.status}`);
  const reply = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return { reply, model, usage: data.usageMetadata || null };
}

async function callDeepSeek(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `DeepSeek ${r.status}`);
  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

async function callGrok(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) throw new Error("GROK_API_KEY not configured");
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `Grok ${r.status}`);
  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

export async function callProvider(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): Promise<CallResult> {
  switch (providerId) {
    case "anthropic": return callAnthropic(messages, model, temperature);
    case "openai": return callOpenAI(messages, model, temperature);
    case "gemini": return callGemini(messages, model, temperature);
    case "deepseek": return callDeepSeek(messages, model, temperature);
    case "grok": return callGrok(messages, model, temperature);
    default: throw new Error("No AI provider configured");
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Streaming calls (multi-agent orchestrator)
   ═══════════════════════════════════════════════════════════════════════ */

/** Low-level SSE line reader: yields {event?, data} blocks separated by \n\n. */
async function* readSSEBlocks(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSSEBlock(block);
        if (parsed.data) yield parsed;
      }
    }
    if (buffer.trim()) {
      const parsed = parseSSEBlock(buffer);
      if (parsed.data) yield parsed;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

function parseSSEBlock(block: string): { event?: string; data: string } {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^\s/, ""));
    }
  }
  return { event, data: dataLines.join("\n") };
}

async function* streamAnthropic(
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const body: any = {
    model,
    max_tokens: 4096,
    temperature,
    stream: true,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) body.system = systemMsg.content;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`Anthropic ${r.status}: ${text.slice(0, 300)}`);
  }

  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for await (const block of readSSEBlocks(r.body as any)) {
    if (!block.data) continue;
    let payload: any;
    try { payload = JSON.parse(block.data); } catch { continue; }
    const t = payload?.type;
    if (t === "content_block_delta") {
      const delta = payload?.delta;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        yield { kind: "text", text: delta.text };
      }
    } else if (t === "message_start") {
      const u = payload?.message?.usage;
      if (u?.input_tokens != null) tokensIn = u.input_tokens;
      if (u?.output_tokens != null) tokensOut = u.output_tokens;
    } else if (t === "message_delta") {
      const u = payload?.usage;
      if (u?.output_tokens != null) tokensOut = u.output_tokens;
    }
  }
  yield { kind: "done", tokensIn, tokensOut };
}

async function* streamOpenAICompat(
  providerId: "openai" | "deepseek" | "grok",
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  let url: string;
  let key: string | undefined;
  if (providerId === "openai") {
    key = process.env.OPENAI_API_KEY?.trim();
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    url = `${base}/chat/completions`;
  } else if (providerId === "deepseek") {
    key = process.env.DEEPSEEK_API_KEY?.trim();
    url = "https://api.deepseek.com/chat/completions";
  } else {
    key = process.env.GROK_API_KEY?.trim();
    url = "https://api.x.ai/v1/chat/completions";
  }
  if (!key) throw new Error(`${providerId.toUpperCase()}_API_KEY not configured`);

  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`${providerId} ${r.status}: ${text.slice(0, 300)}`);
  }

  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for await (const block of readSSEBlocks(r.body as any)) {
    const data = block.data;
    if (!data || data === "[DONE]") continue;
    let payload: any;
    try { payload = JSON.parse(data); } catch { continue; }
    const delta = payload?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length) {
      yield { kind: "text", text: delta };
    }
    if (payload?.usage) {
      tokensIn = payload.usage.prompt_tokens ?? tokensIn;
      tokensOut = payload.usage.completion_tokens ?? tokensOut;
    }
  }
  yield { kind: "done", tokensIn, tokensOut };
}

async function* streamGemini(
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: 4096 },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
    `?alt=sse&key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`Gemini ${r.status}: ${text.slice(0, 300)}`);
  }

  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for await (const block of readSSEBlocks(r.body as any)) {
    if (!block.data) continue;
    let payload: any;
    try { payload = JSON.parse(block.data); } catch { continue; }
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (typeof p?.text === "string" && p.text.length) {
          yield { kind: "text", text: p.text };
        }
      }
    }
    const um = payload?.usageMetadata;
    if (um) {
      tokensIn = um.promptTokenCount ?? tokensIn;
      tokensOut = um.candidatesTokenCount ?? tokensOut;
    }
  }
  yield { kind: "done", tokensIn, tokensOut };
}

/**
 * Stream a provider. Yields { kind: "text", text } chunks as they arrive,
 * then a single { kind: "done", tokensIn?, tokensOut? } event at the end.
 */
export async function* streamProvider(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  switch (providerId) {
    case "anthropic":
      yield* streamAnthropic(messages, model, temperature);
      return;
    case "openai":
    case "deepseek":
    case "grok":
      yield* streamOpenAICompat(providerId, messages, model, temperature);
      return;
    case "gemini":
      yield* streamGemini(messages, model, temperature);
      return;
    default:
      throw new Error(`streamProvider: unsupported provider "${providerId}"`);
  }
}
