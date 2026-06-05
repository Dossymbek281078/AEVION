"use client";

/**
 * Баннер возврата зачёта в LMS. Показывается на странице экзамена, если
 * тренажёр был открыт из курса (есть LmsContext) и этот экзамен соответствует
 * модулю запуска. После сдачи отправляет зачёт родительскому окну (postMessage)
 * и предлагает вернуться в курс по return-URL с результатом в query.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadLmsContext,
  destinationFor,
  buildReturnUrl,
  postLmsCompletion,
  clearLmsContext,
  LMS_PASS_THRESHOLD,
  type LmsContext,
  type LmsCompletion,
} from "../lib/lms";

export function LmsReturnBanner({
  taskId,
  score,
  grade,
}: {
  taskId: string;
  score: number | null;
  grade: string | null;
}) {
  const [ctx, setCtx] = useState<LmsContext | null>(null);
  const posted = useRef(false);

  useEffect(() => {
    const c = loadLmsContext();
    if (c && destinationFor(c.module)?.examTaskId === taskId) setCtx(c);
  }, [taskId]);

  const completion = useMemo<LmsCompletion | null>(() => {
    if (!ctx || score == null || grade == null) return null;
    return {
      module: ctx.module,
      taskId,
      score,
      grade,
      passed: score >= LMS_PASS_THRESHOLD,
      at: new Date().toISOString(),
    };
  }, [ctx, score, grade, taskId]);

  // Отправляем зачёт родителю один раз при появлении результата.
  useEffect(() => {
    if (ctx && completion && !posted.current) {
      posted.current = true;
      postLmsCompletion(ctx, completion);
    }
  }, [ctx, completion]);

  if (!ctx) return null;

  const returnUrl = completion ? buildReturnUrl(ctx, completion) : null;
  const passed = completion?.passed ?? false;

  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">
            Курс · модуль {ctx.module}
          </div>
          <div className="text-sm text-slate-800 mt-0.5">
            {completion ? (
              passed ? (
                <>✅ Зачёт {score}/100 ({grade}) отправлен в курс.</>
              ) : (
                <>⚠️ Результат {score}/100 ({grade}) — для зачёта нужно ≥ {LMS_PASS_THRESHOLD}. Можно пересдать.</>
              )
            ) : (
              <>Сдайте экзамен — результат вернётся в курс.</>
            )}
          </div>
        </div>
        {returnUrl && (
          <a
            href={returnUrl}
            onClick={() => clearLmsContext()}
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shrink-0"
          >
            Вернуться в курс →
          </a>
        )}
      </div>
    </div>
  );
}
