// Общий клиент fal.ai queue API — единая точка для всех модулей AEVION,
// которым нужны прямые интеграции с генеративными моделями (QReal, TikTok-
// фабрика, ежедневная лента). Не плодим копии: submit/status/result здесь.
//
//   submit: POST https://queue.fal.run/{modelId}            → { request_id }
//   status: GET  https://queue.fal.run/{modelId}/requests/{id}/status
//   result: GET  https://queue.fal.run/{modelId}/requests/{id}
// Auth: Authorization: Key <FAL_KEY>

export function falKey(): string {
  return process.env.FAL_KEY?.trim() || "";
}

export type FalSubmitResult = { ok: true; requestId: string } | { ok: false; error: string };

export async function falQueueSubmit(modelId: string, input: Record<string, unknown>): Promise<FalSubmitResult> {
  const key = falKey();
  if (!key) return { ok: false, error: "FAL_KEY not configured" };
  try {
    const r = await fetch(`https://queue.fal.run/${modelId}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
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

export type FalPollResult =
  | { state: "queued" | "in_progress" }
  | { state: "completed"; result: unknown }
  | { state: "failed"; error: string };

/** Request-эндпоинты fal живут на БАЗОВОМ id приложения (первые 2 сегмента):
 *  submit — на полный путь модели, а status/result для
 *  fal-ai/kling-video/v3/standard/text-to-video — на fal-ai/kling-video.
 *  Полный путь в requests-URL даёт 405 (выяснено боем 2026-07-21). */
function falRequestsBase(modelId: string): string {
  return modelId.split("/").slice(0, 2).join("/");
}

export async function falQueuePoll(modelId: string, requestId: string): Promise<FalPollResult> {
  const key = falKey();
  if (!key) return { state: "failed", error: "FAL_KEY not configured" };
  try {
    const base = `https://queue.fal.run/${falRequestsBase(modelId)}/requests/${requestId}`;
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
    return { state: "completed", result: (await r.json().catch(() => ({}))) as unknown };
  } catch (err) {
    return { state: "failed", error: err instanceof Error ? err.message : "fal poll failed" };
  }
}

/** Ищем первую видео-ссылку в произвольной форме ответа (схемы моделей различаются). */
export function falExtractVideoUrl(obj: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (x: unknown): string | null => {
    if (!x || seen.has(x)) return null;
    if (typeof x === "string") {
      return /^https?:\/\/\S+\.(mp4|webm|mov)(\?|$)/i.test(x) ? x : null;
    }
    if (typeof x !== "object") return null;
    seen.add(x);
    const o = x as Record<string, unknown>;
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
