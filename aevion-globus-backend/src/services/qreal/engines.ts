// QReal — собственный слой рендер-движков. ПРЯМЫЕ интеграции с провайдерами
// моделей через fal.ai (queue API), БЕЗ Higgsfield в цепочке (решение
// основателя 2026-07-21: делаем сами — лучше, эффективнее, дешевле).
//
// fal.ai queue API:
//   submit: POST https://queue.fal.run/{modelId}            → { request_id }
//   status: GET  https://queue.fal.run/{modelId}/requests/{id}/status
//   result: GET  https://queue.fal.run/{modelId}/requests/{id}
// Auth: Authorization: Key <FAL_KEY>
//
// Model-id по умолчанию проверены по fal.ai 2026-07-21; на случай ротации
// каталога переопределяются через env (QREAL_FAL_MODEL_*).

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

const FAL_KEY = () => process.env.FAL_KEY?.trim() || "";

export function renderEngines(): RenderEngine[] {
  const falOk = Boolean(FAL_KEY());
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
function buildFalInput(engineId: string, prompt: string, durationSec: number) {
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
  const key = FAL_KEY();
  if (!key || !engine.falModelId) return { ok: false, error: "FAL_KEY not configured" };
  try {
    const r = await fetch(`https://queue.fal.run/${engine.falModelId}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildFalInput(engine.id, prompt, durationSec)),
    });
    const data = (await r.json().catch(() => ({}))) as any;
    if (!r.ok || !data?.request_id) {
      return { ok: false, error: String(data?.detail || data?.error || `fal ${r.status}`).slice(0, 300) };
    }
    return { ok: true, requestId: String(data.request_id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fal submit failed" };
  }
}

export type FalPoll =
  | { state: "queued" | "in_progress" }
  | { state: "completed"; videoUrl: string | null }
  | { state: "failed"; error: string };

/** Ищем первую .mp4/видео-ссылку в произвольной форме ответа (у моделей разные схемы). */
function extractVideoUrl(obj: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (x: unknown): string | null => {
    if (!x || seen.has(x)) return null;
    if (typeof x === "string") {
      return /^https?:\/\/\S+\.(mp4|webm|mov)(\?|$)/i.test(x) ? x : null;
    }
    if (typeof x !== "object") return null;
    seen.add(x);
    const o = x as Record<string, unknown>;
    // приоритет типовым формам: {video:{url}}, {url}
    if (typeof (o.video as any)?.url === "string") return (o.video as any).url;
    if (typeof o.url === "string" && walk(o.url)) return o.url as string;
    for (const v of Object.values(o)) {
      const hit = walk(v);
      if (hit) return hit;
    }
    return null;
  };
  return walk(obj);
}

export async function falPoll(engine: RenderEngine, requestId: string): Promise<FalPoll> {
  const key = FAL_KEY();
  if (!key || !engine.falModelId) return { state: "failed", error: "FAL_KEY not configured" };
  try {
    const base = `https://queue.fal.run/${engine.falModelId}/requests/${requestId}`;
    const s = await fetch(`${base}/status`, { headers: { Authorization: `Key ${key}` } });
    const sd = (await s.json().catch(() => ({}))) as any;
    const status = String(sd?.status || "").toUpperCase();
    if (status === "IN_QUEUE") return { state: "queued" };
    if (status === "IN_PROGRESS") return { state: "in_progress" };
    if (status !== "COMPLETED") {
      if (!s.ok) return { state: "failed", error: `fal status ${s.status}` };
      return { state: "in_progress" };
    }
    const r = await fetch(base, { headers: { Authorization: `Key ${key}` } });
    const rd = (await r.json().catch(() => ({}))) as any;
    return { state: "completed", videoUrl: extractVideoUrl(rd) };
  } catch (err) {
    return { state: "failed", error: err instanceof Error ? err.message : "fal poll failed" };
  }
}
