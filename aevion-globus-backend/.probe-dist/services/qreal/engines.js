"use strict";
// QReal — собственный слой рендер-движков. ПРЯМЫЕ интеграции с провайдерами
// моделей через общий fal-клиент (lib/falClient), БЕЗ Higgsfield в цепочке
// (решение основателя 2026-07-21: делаем сами — лучше, эффективнее, дешевле).
//
// Model-id по умолчанию проверены по fal.ai 2026-07-21; на случай ротации
// каталога переопределяются через env (QREAL_FAL_MODEL_*).
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderEngines = renderEngines;
exports.pickVideoEngine = pickVideoEngine;
exports.referenceModelId = referenceModelId;
exports.falSubmit = falSubmit;
exports.falPoll = falPoll;
const falClient_1 = require("../../lib/falClient");
function renderEngines() {
    const falOk = Boolean((0, falClient_1.falKey)());
    return [
        {
            id: "seedance",
            label: "Seedance 2.0 (ByteDance, прямой API)",
            falModelId: process.env.QREAL_FAL_MODEL_SEEDANCE?.trim() || "bytedance/seedance-2.0/text-to-video",
            modality: ["video", "audio"],
            usdPerSecond: 0.3034,
            configured: falOk,
            note: "дефолт QReal: лучший adherence к режиссуре (A/B 2026-07-21); reference-to-video до 9 изображений — задел консистентности",
        },
        {
            id: "kling",
            label: "Kling v3 standard (Kuaishou, прямой API)",
            falModelId: process.env.QREAL_FAL_MODEL_KLING?.trim() || "fal-ai/kling-video/v3/standard/text-to-video",
            modality: ["video", "audio"],
            usdPerSecond: 0.126,
            configured: falOk,
            note: "бюджетный вариант: $0.126/с со звуком — в ~2.4 раза дешевле Seedance",
        },
        {
            id: "elevenlabs",
            label: "ElevenLabs (голос, диалоги, фоли)",
            falModelId: null,
            modality: ["voice", "sfx"],
            usdPerSecond: null,
            configured: Boolean(process.env.ELEVENLABS_API_KEY),
            note: "речь отдельным слоем, когда нативный звук движка проигрывает",
        },
        {
            id: "local-ffmpeg",
            label: "FFmpeg-сборка (склейка, грейд, лауднесс)",
            falModelId: null,
            modality: ["assembly"],
            usdPerSecond: 0,
            configured: true,
            note: "финальная сборка кадров и дорожек, $0",
        },
    ];
}
function pickVideoEngine(preferred) {
    const engines = renderEngines().filter((e) => e.modality.includes("video") && e.configured);
    if (!engines.length)
        return null;
    return engines.find((e) => e.id === preferred) || engines[0];
}
/** Reference-to-video вариант модели: тот же движок, но принимает опорные
 *  изображения персонажей. Схема сверена по каталогу fal 2026-07-26 —
 *  `image_urls` (до 9), картинки адресуются В ПРОМТЕ как @Image1, @Image2.
 *  Возвращаем null, если у движка такого варианта нет: подменять модель
 *  наугад значит платить за отказ. */
function referenceModelId(engine) {
    if (engine.id !== "seedance")
        return null;
    return process.env.QREAL_FAL_MODEL_SEEDANCE_REF?.trim() || "bytedance/seedance-2.0/reference-to-video";
}
/** Входной payload под конкретный движок (форматы полей у моделей различаются). */
function buildFalInput(engineId, prompt, durationSec, imageUrls) {
    if (imageUrls?.length && engineId === "seedance") {
        return {
            prompt,
            image_urls: imageUrls.slice(0, 9),
            duration: Math.max(4, Math.min(15, Math.round(durationSec))),
            resolution: "720p",
            aspect_ratio: "16:9",
            generate_audio: true,
        };
    }
    if (engineId === "kling") {
        // Kling принимает дискретные длительности.
        return {
            prompt,
            duration: durationSec <= 7 ? "5" : "10",
            aspect_ratio: "16:9",
            generate_audio: true,
        };
    }
    // seedance и совместимые: непрерывная длительность 4-15с.
    return {
        prompt,
        duration: Math.max(4, Math.min(15, Math.round(durationSec))),
        resolution: "720p",
        aspect_ratio: "16:9",
        generate_audio: true,
    };
}
async function falSubmit(engine, prompt, durationSec, imageUrls) {
    // Есть референсы персонажей — уходим на reference-вариант модели: только он
    // умеет image_urls. Нет варианта или нет картинок — обычный text-to-video.
    const refModel = imageUrls?.length ? referenceModelId(engine) : null;
    const modelId = refModel || engine.falModelId;
    if (!modelId)
        return { ok: false, error: "engine has no fal model" };
    return (0, falClient_1.falQueueSubmit)(modelId, buildFalInput(engine.id, prompt, durationSec, refModel ? imageUrls : undefined));
}
async function falPoll(engine, requestId, usedReference = false) {
    // Опрашивать надо ТУ модель, в которую сабмитили: у reference-варианта свой
    // requests-путь, и опрос по text-to-video отдаст 404 на живую задачу.
    const modelId = (usedReference ? referenceModelId(engine) : null) || engine.falModelId;
    if (!modelId)
        return { state: "failed", error: "engine has no fal model" };
    const poll = await (0, falClient_1.falQueuePoll)(modelId, requestId);
    if (poll.state === "completed")
        return { state: "completed", videoUrl: (0, falClient_1.falExtractVideoUrl)(poll.result) };
    return poll;
}
