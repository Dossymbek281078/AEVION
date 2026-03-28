"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qcoreaiRouter = void 0;
const express_1 = require("express");
exports.qcoreaiRouter = (0, express_1.Router)();
function sanitizeMessages(raw) {
    if (!Array.isArray(raw))
        return null;
    const out = [];
    for (const m of raw) {
        if (!m || typeof m !== "object")
            continue;
        const role = m.role;
        const content = m.content;
        if (role !== "user" && role !== "assistant" && role !== "system")
            continue;
        if (typeof content !== "string" || !content.trim())
            continue;
        out.push({ role, content: content.slice(0, 32000) });
    }
    return out.length ? out : null;
}
/** Минимальный чат: OpenAI при наличии ключа, иначе осмысленный stub. */
exports.qcoreaiRouter.post("/chat", async (req, res) => {
    try {
        const messages = sanitizeMessages(req.body?.messages);
        if (!messages) {
            return res.status(400).json({
                error: "messages required: [{ role: user|assistant|system, content: string }, ...]",
            });
        }
        const modelName = (typeof req.body?.model === "string" && req.body.model) ||
            process.env.OPENAI_MODEL ||
            "gpt-4o-mini";
        const key = process.env.OPENAI_API_KEY?.trim();
        if (!key) {
            const lastUser = [...messages].reverse().find((m) => m.role === "user");
            const snippet = lastUser?.content?.slice(0, 280) || "";
            return res.json({
                mode: "stub",
                model: modelName,
                reply: `[QCoreAI / режим заглушки — задайте OPENAI_API_KEY в .env]\n\n` +
                    `Кратко по вашему запросу: «${snippet}»\n\n` +
                    `Дальше: подключите ключ OpenAI (или совместимый прокси через OPENAI_BASE_URL) — тот же эндпоинт начнёт отвечать моделью.`,
                usage: null,
            });
        }
        const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
        const r = await fetch(`${base}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                temperature: typeof req.body?.temperature === "number" ? req.body.temperature : 0.6,
            }),
        });
        const data = (await r.json());
        if (!r.ok) {
            return res.status(502).json({
                error: "upstream_error",
                status: r.status,
                details: data,
            });
        }
        const choices = data.choices;
        const reply = choices?.[0]?.message?.content ?? "";
        res.json({
            mode: "openai",
            model: data.model || modelName,
            reply,
            usage: data.usage ?? null,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "chat failed";
        res.status(500).json({ error: msg });
    }
});
exports.qcoreaiRouter.get("/health", (_req, res) => {
    res.json({
        service: "qcoreai",
        ok: true,
        openaiConfigured: !!process.env.OPENAI_API_KEY?.trim(),
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
        at: new Date().toISOString(),
    });
});
