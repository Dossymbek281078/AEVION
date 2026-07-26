// QReal — вызов VLM-судьи. Отделён от judge.ts намеренно: там чистые функции
// (скор, вердикт, якоря), которые гоняются юнит-тестом без сети; здесь весь I/O.
//
// Модель: fal-ai/video-understanding — принимает video_url НАПРЯМУЮ и отвечает
// текстом на вопрос о содержимом (схема проверена по fal.ai 2026-07-26:
// вход video_url + prompt + detailed_analysis, выход { output: string }).
// Это снимает целый слой, который казался обязательным: извлекать кадры
// через ffmpeg и слать картинки не нужно.
//
// Судейство ПЛАТНОЕ, поэтому вызывается только по явному запросу
// (`POST /qc {"judge":true}`), никогда неявно.

import { falKey, falQueueSubmit, falQueuePoll } from "../../lib/falClient";
import { buildJudgePrompt, type CriterionDef, type RawScore } from "./judge";

export function vlmJudgeModel(): string {
  return process.env.QREAL_FAL_MODEL_VLM_JUDGE?.trim() || "fal-ai/video-understanding";
}

export function vlmJudgeConfigured(): boolean {
  return Boolean(falKey());
}

export type VlmJudgeResult =
  | { ok: true; scores: RawScore[]; raw: string; dropped: string[] }
  | { ok: false; error: string };

/** Модель отвечает текстом, а не структурой, поэтому JSON приходится доставать
 *  из прозы — как в aiStoryboard. Отдельная функция, чтобы это можно было
 *  проверить без сети. */
export function parseJudgeReply(text: string, defs: CriterionDef[]): { scores: RawScore[]; dropped: string[] } {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  // Ответ бывает обёрнут в пояснения — берём первый сбалансированный объект.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { scores: [], dropped: [] };
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { scores: [], dropped: [] };
  }
  const arr = Array.isArray(parsed) ? parsed : parsed?.scores;
  if (!Array.isArray(arr)) return { scores: [], dropped: [] };

  const known = new Set(defs.map((d) => d.id));
  const scores: RawScore[] = [];
  const dropped: string[] = [];
  for (const row of arr) {
    const id = String(row?.id || "");
    // Судья может выдумать критерий — такой скор нельзя молча вливать в тотал.
    if (!known.has(id)) { if (id) dropped.push(id); continue; }
    const n = row?.score == null ? null : Number(row.score);
    const valid = n != null && Number.isFinite(n) && n >= 1 && n <= 5;
    scores.push({ id, score: valid ? n : null, note: row?.note ? String(row.note).slice(0, 400) : null });
  }
  return { scores, dropped };
}

/** Один рендер → оценки. Ждём результат поллингом: судейство идёт секунды,
 *  а не минуты, но очередь fal всё равно асинхронная. */
export async function judgeRender(
  videoUrl: string,
  defs: CriterionDef[],
  shot: { description: string; dialogue?: string | null; soundscape?: string },
  opts: { timeoutMs?: number } = {}
): Promise<VlmJudgeResult> {
  if (!vlmJudgeConfigured()) return { ok: false, error: "FAL_KEY не задан — VLM-судья недоступен" };
  const model = vlmJudgeModel();
  const { system, user } = buildJudgePrompt(defs, shot);

  const sub = await falQueueSubmit(model, {
    video_url: videoUrl,
    prompt: `${system}\n\n${user}`,
    detailed_analysis: true,
  });
  if (!sub.ok) return { ok: false, error: sub.error };

  const deadline = Date.now() + (opts.timeoutMs ?? 180_000);
  while (Date.now() < deadline) {
    const p = await falQueuePoll(model, sub.requestId);
    if (p.state === "failed") return { ok: false, error: p.error };
    if (p.state === "completed") {
      const out = (p.result as any)?.output;
      const text = typeof out === "string" ? out : JSON.stringify(out ?? "");
      const { scores, dropped } = parseJudgeReply(text, defs);
      if (!scores.length) {
        // Пустой разбор — это НЕ «кадр плохой». Отдаём ошибку, иначе кадр
        // получит вердикт insufficient и будет выглядеть как судимый.
        return { ok: false, error: `судья ответил, но оценок не разобрать: ${text.slice(0, 200)}` };
      }
      return { ok: true, scores, raw: text.slice(0, 4000), dropped };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, error: "VLM-судья не ответил в отведённое время" };
}
