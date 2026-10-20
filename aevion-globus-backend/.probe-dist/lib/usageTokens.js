"use strict";
// Нормализация provider-specific `usage` → { tokensIn, tokensOut }.
//
// У каждого провайдера своё имя для одного и того же числа:
//   Anthropic     input_tokens / output_tokens
//   OpenAI-style  prompt_tokens / completion_tokens (Groq, DeepSeek, Together…)
//   Gemini        promptTokenCount / candidatesTokenCount
//
// Общий дом нужен, потому что расчёт токенов раньше жил только внутри
// routes/qcoreai.ts приватной функцией: любой другой модуль либо писал свою
// копию, либо (как multichat) вообще не считал токены и показывал нули.
// Когда зона qcoreai освободится — его локальную копию заменить импортом
// отсюда, чтобы способ остался один.
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageToTokens = usageToTokens;
function usageToTokens(u) {
    const o = (u ?? {});
    const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
    const tokensIn = num(o.input_tokens) || num(o.prompt_tokens) || num(o.promptTokenCount) || 0;
    const tokensOut = num(o.output_tokens) || num(o.completion_tokens) || num(o.candidatesTokenCount) || 0;
    return { tokensIn, tokensOut };
}
