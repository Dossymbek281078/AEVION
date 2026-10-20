"use strict";
/**
 * agentRuntime — real provider adapter (Anthropic Messages API, tool-use).
 *
 * Converts our neutral LoopMessage/ToolSpec format to Anthropic's tool-use wire
 * format and back into a ModelStep. This is the I/O boundary — it needs
 * ANTHROPIC_API_KEY at runtime; the loop that drives it (loop.ts) stays pure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAnthropicCallModel = makeAnthropicCallModel;
exports.причинаОтказаАгента = причинаОтказаАгента;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
/** Our transcript → Anthropic messages. */
function toAnthropicMessages(messages) {
    const out = [];
    for (const m of messages) {
        if (m.role === "user") {
            out.push({ role: "user", content: m.text ?? "" });
        }
        else if (m.role === "assistant") {
            const blocks = [];
            if (m.text)
                blocks.push({ type: "text", text: m.text });
            for (const c of m.toolCalls ?? [])
                blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
            out.push({ role: "assistant", content: blocks.length ? blocks : (m.text ?? "") });
        }
        else if (m.role === "tool") {
            const blocks = (m.toolResults ?? []).map((r) => ({
                type: "tool_result",
                tool_use_id: r.callId,
                content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
            }));
            out.push({ role: "user", content: blocks });
        }
    }
    return out;
}
/** Build a CallModel backed by the Anthropic Messages API with tool-use. */
function makeAnthropicCallModel(opts = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    const model = opts.model ?? process.env.AGENT_RUNTIME_MODEL ?? "claude-sonnet-5";
    const maxTokens = opts.maxTokens ?? 1024;
    const doFetch = opts.fetchImpl ?? fetch;
    return async (messages, tools) => {
        if (!apiKey)
            throw new Error("ANTHROPIC_API_KEY is not set — the agent runtime cannot call the model.");
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
        const data = (await r.json());
        const blocks = Array.isArray(data.content) ? data.content : [];
        const text = blocks
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
        const toolCalls = blocks
            .filter((b) => b.type === "tool_use")
            .map((b) => ({ id: b.id, name: b.name, input: b.input || {} }));
        return { text, toolCalls };
    };
}
/**
 * Человеческая причина отказа агента.
 *
 * 🔴 07.10.2026. Агенты намеренно остались на Anthropic: им нужны вызовы
 * инструментов, которых в общем реестре нет. Значит деньги на этом счёте —
 * их единственная опора, а на 07.10 там $8.93. Проверено: ручка НЕ молчит,
 * она отдаёт 502 — но текстом поставщика («Anthropic error 429: {...}»).
 * Человек читает чужую диагностику вместо ответа, а в ней бывает и лишнее.
 *
 * Поэтому причина переводится на русский по КОДУ и словам о деньгах, а сырой
 * текст уходит в поле detail — для нас, не для экрана.
 */
function причинаОтказаАгента(ошибка) {
    const текст = String(ошибка?.message ?? ошибка ?? "");
    const деньги = /insufficient|credit balance|quota|billing/i.test(текст);
    const код = /Anthropic error (\d{3})/.exec(текст)?.[1];
    if (деньги || код === "429") {
        return "Агент временно недоступен: у поставщика модели закончился доступный объём. Мы уже знаем об этом.";
    }
    if (код === "401" || код === "403") {
        return "Агент временно недоступен: доступ к модели не принят. Это наша настройка, не ваша ошибка.";
    }
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
        return "Агент выключен: на сервере не задан доступ к модели.";
    }
    return "Агент временно недоступен. Попробуйте через несколько минут.";
}
