"use client";

/**
 * Точка входа из LMS (smeta-rk-kurs).
 * URL: /smeta-trainer/lms?module=2.3&return=<url>&sid=<студент>&origin=<origin>
 *
 * Сохраняет контекст запуска (для возврата зачёта после сдачи) и направляет
 * студента в нужный режим тренажёра. Если модуль не поддержан — показывает
 * список доступных модулей.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseLmsParams,
  destinationFor,
  destinationHref,
  saveLmsContext,
  MODULE_DESTINATIONS,
  type LmsContext,
  type ModuleDestination,
} from "../lib/lms";

export default function LmsEntryPage() {
  const [ctx, setCtx] = useState<LmsContext | null>(null);
  const [dest, setDest] = useState<ModuleDestination | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = parseLmsParams(params);
    if (parsed) {
      saveLmsContext(parsed);
      setCtx(parsed);
      setDest(destinationFor(parsed.module));
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">🎓 Тренажёр сметного дела</h1>
        <p className="text-sm text-slate-600 mb-5">Запуск из курса smeta-rk-kurs</p>

        {ctx && dest ? (
          <section className="bg-white border border-emerald-200 rounded-lg p-5 mb-4">
            <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">
              Модуль {ctx.module}
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{dest.label}</h2>
            <p className="text-sm text-slate-600 mt-1">{dest.description}</p>
            {ctx.returnUrl && (
              <p className="text-[11px] text-slate-500 mt-2">
                После выполнения зачёт вернётся в курс автоматически.
              </p>
            )}
            <Link
              href={destinationHref(dest)}
              className="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700"
            >
              Открыть режим →
            </Link>
          </section>
        ) : ctx && !dest ? (
          <section className="bg-white border border-amber-200 rounded-lg p-5 mb-4">
            <h2 className="text-base font-semibold text-amber-800">
              Модуль «{ctx.module}» пока не привязан к тренажёру
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Выберите доступный режим ниже или вернитесь в курс.
            </p>
          </section>
        ) : (
          <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <h2 className="text-base font-semibold text-slate-800">Прямой вход без модуля</h2>
            <p className="text-sm text-slate-600 mt-1">
              Обычно сюда направляет курс. Ниже — все привязанные модули.
            </p>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Привязанные модули курса</h3>
          <ul className="divide-y divide-slate-100">
            {Object.entries(MODULE_DESTINATIONS).map(([mod, d]) => (
              <li key={mod} className="py-2 flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 w-16 shrink-0">
                  {mod === "capstone" ? "кейс" : `мод. ${mod}`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 truncate">{d.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{d.description}</div>
                </div>
                <Link
                  href={destinationHref(d)}
                  className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-100 shrink-0"
                >
                  Открыть
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-4 text-center">
          <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
            ← На главную тренажёра
          </Link>
        </div>
      </div>
    </div>
  );
}
