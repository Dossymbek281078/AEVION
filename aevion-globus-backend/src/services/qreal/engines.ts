// QReal — собственный слой рендер-движков. ПРЯМЫЕ интеграции с провайдерами
// моделей через общий fal-клиент (lib/falClient), БЕЗ Higgsfield в цепочке
// (решение основателя 2026-07-21: делаем сами — лучше, эффективнее, дешевле).
//
// Model-id по умолчанию проверены по fal.ai 2026-07-21; на случай ротации
// каталога переопределяются через env (QREAL_FAL_MODEL_*).

import { falKey, falQueueSubmit, falQueuePoll, falExtractVideoUrl } from "../../lib/falClient";

export type RenderEngine = {
  id: string;
  label: string;
  falModelId: string | null;
  modality: string[];
  /** USD за секунду готового видео со звуком (прайс fal.ai, для честной юнит-экономики). */
  usdPerSecond: number | null;
  configured: boolean;
  note: string;
};

export function renderEngines(): RenderEngine[] {
  const falOk = Boolean(falKey());
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

export function pickVideoEngine(preferred?: string): RenderEngine | null {
  const engines = renderEngines().filter((e) => e.modality.includes("video") && e.configured);
  if (!engines.length) return null;
  return engines.find((e) => e.id === preferred) || engines[0];
}

/** Входной payload под конкретный движок (форматы полей у моделей различаются). */
function buildFalInput(engineId: string, prompt: string, durationSec: number): Record<string, unknown> {
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

export type FalSubmit = { ok: true; requestId: string } | { ok: false; error: string };

export async function falSubmit(engine: RenderEngine, prompt: string, durationSec: number): Promise<FalSubmit> {
  if (!engine.falModelId) return { ok: false, error: "engine has no fal model" };
  return falQueueSubmit(engine.falModelId, buildFalInput(engine.id, prompt, durationSec));
}

export type FalPoll =
  | { state: "queued" | "in_progress" }
  | { state: "completed"; videoUrl: string | null }
  | { state: "failed"; error: string };

export async function falPoll(engine: RenderEngine, requestId: string): Promise<FalPoll> {
  if (!engine.falModelId) return { state: "failed", error: "engine has no fal model" };
  const poll = await falQueuePoll(engine.falModelId, requestId);
  if (poll.state === "completed") return { state: "completed", videoUrl: falExtractVideoUrl(poll.result) };
  return poll;
}
