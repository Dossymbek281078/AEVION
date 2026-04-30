"use client";

import type { AiNotice } from "../lib/types";

interface Props {
  notices: AiNotice[];
}

const severityStyle: Record<AiNotice["severity"], { bg: string; border: string; icon: string; iconBg: string }> = {
  info: { bg: "bg-blue-50", border: "border-blue-200", icon: "ℹ", iconBg: "bg-blue-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-300", icon: "⚠", iconBg: "bg-amber-500" },
  error: { bg: "bg-red-50", border: "border-red-300", icon: "✕", iconBg: "bg-red-500" },
};

export function AiPanel({ notices }: Props) {
  return (
    <aside className="w-80 shrink-0 bg-slate-50 border-l border-slate-200 p-4 overflow-auto">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500 text-white text-xs">AI</span>
          Советник
        </h2>
        <p className="text-xs text-slate-600 mt-1">Проверяет вашу смету и подсказывает на типовых ошибках</p>
      </div>

      {notices.length === 0 && (
        <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded p-4 text-center">
          <div className="text-emerald-600 text-2xl mb-2">✓</div>
          Замечаний нет. Продолжайте работу.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {notices.map((n) => {
          const s = severityStyle[n.severity];
          return (
            <div key={n.id} className={`${s.bg} ${s.border} border rounded-lg p-3`}>
              <div className="flex items-start gap-2">
                <span className={`${s.iconBg} text-white text-xs font-bold rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5`}>
                  {s.icon}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  <div className="text-xs text-slate-700 mt-1.5 leading-relaxed whitespace-pre-line">{n.message}</div>
                  {n.suggestion && (
                    <div className="text-xs text-slate-800 mt-2 p-2 bg-white rounded border border-slate-200">
                      <span className="font-semibold text-emerald-700">Что делать: </span>
                      {n.suggestion}
                    </div>
                  )}
                  {n.reference && (
                    <div className="text-[10px] text-slate-500 mt-2 italic">{n.reference}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
