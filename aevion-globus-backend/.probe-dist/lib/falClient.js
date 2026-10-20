"use strict";
// Общий клиент fal.ai queue API — единая точка для всех модулей AEVION,
// которым нужны прямые интеграции с генеративными моделями (QReal, TikTok-
// фабрика, ежедневная лента). Не плодим копии: submit/status/result здесь.
//
//   submit: POST https://queue.fal.run/{modelId}            → { request_id }
//   status: GET  https://queue.fal.run/{modelId}/requests/{id}/status
//   result: GET  https://queue.fal.run/{modelId}/requests/{id}
// Auth: Authorization: Key <FAL_KEY>
Object.defineProperty(exports, "__esModule", { value: true });
exports.falKey = falKey;
exports.falQueueSubmit = falQueueSubmit;
exports.falQueuePoll = falQueuePoll;
exports.falExtractVideoUrl = falExtractVideoUrl;
function falKey() {
    return process.env.FAL_KEY?.trim() || "";
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** «User is locked. Reason: Exhausted balance» держится ещё ~2 мин ПОСЛЕ
 *  пополнения кредитов (лаг биллинга fal, воспроизведено 2026-07-21) —
 *  поэтому lock-ошибку ретраим с бэкоффом, а не хороним задачу сразу. */
function isBalanceLagError(msg) {
    return /locked|exhausted balance/i.test(msg);
}
async function falQueueSubmit(modelId, input) {
    const key = falKey();
    if (!key)
        return { ok: false, error: "FAL_KEY not configured" };
    const backoffsMs = [20000, 40000];
    for (let attempt = 0;; attempt++) {
        let error;
        try {
            const r = await fetch(`https://queue.fal.run/${modelId}`, {
                method: "POST",
                headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const data = (await r.json().catch(() => ({})));
            if (r.ok && data?.request_id)
                return { ok: true, requestId: String(data.request_id) };
            error = String(data?.detail || data?.error || `fal ${r.status}`).slice(0, 300);
        }
        catch (err) {
            error = err instanceof Error ? err.message : "fal submit failed";
        }
        if (attempt >= backoffsMs.length || !isBalanceLagError(error))
            return { ok: false, error };
        await sleep(backoffsMs[attempt]);
    }
}
/** Request-эндпоинты fal живут на БАЗОВОМ id приложения (первые 2 сегмента):
 *  submit — на полный путь модели, а status/result для
 *  fal-ai/kling-video/v3/standard/text-to-video — на fal-ai/kling-video.
 *  Полный путь в requests-URL даёт 405 (выяснено боем 2026-07-21). */
function falRequestsBase(modelId) {
    return modelId.split("/").slice(0, 2).join("/");
}
async function falQueuePoll(modelId, requestId) {
    const key = falKey();
    if (!key)
        return { state: "failed", error: "FAL_KEY not configured" };
    try {
        const base = `https://queue.fal.run/${falRequestsBase(modelId)}/requests/${requestId}`;
        const s = await fetch(`${base}/status`, { headers: { Authorization: `Key ${key}` } });
        const sd = (await s.json().catch(() => ({})));
        const status = String(sd?.status || "").toUpperCase();
        if (status === "IN_QUEUE")
            return { state: "queued" };
        if (status === "IN_PROGRESS")
            return { state: "in_progress" };
        if (status !== "COMPLETED") {
            if (!s.ok)
                return { state: "failed", error: `fal status ${s.status}` };
            return { state: "in_progress" };
        }
        const r = await fetch(base, { headers: { Authorization: `Key ${key}` } });
        return { state: "completed", result: (await r.json().catch(() => ({}))) };
    }
    catch (err) {
        return { state: "failed", error: err instanceof Error ? err.message : "fal poll failed" };
    }
}
/** Ищем первую видео-ссылку в произвольной форме ответа (схемы моделей различаются). */
function falExtractVideoUrl(obj) {
    const seen = new Set();
    const walk = (x) => {
        if (!x || seen.has(x))
            return null;
        if (typeof x === "string") {
            return /^https?:\/\/\S+\.(mp4|webm|mov)(\?|$)/i.test(x) ? x : null;
        }
        if (typeof x !== "object")
            return null;
        seen.add(x);
        const o = x;
        if (typeof o.video?.url === "string")
            return o.video.url;
        if (typeof o.url === "string" && walk(o.url))
            return o.url;
        for (const v of Object.values(o)) {
            const hit = walk(v);
            if (hit)
                return hit;
        }
        return null;
    };
    return walk(obj);
}
