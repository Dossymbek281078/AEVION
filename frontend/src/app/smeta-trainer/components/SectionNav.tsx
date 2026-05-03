"use client";

import type { SectionCalc } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  sections: SectionCalc[];
  activeSectionId: string;
  onSelect: (id: string) => void;
  onAddRate: () => void;
}

function completionIcon(positions: number): string {
  if (positions === 0) return "○";
  if (positions < 3) return "◑";
  return "●";
}

function completionColor(positions: number): string {
  if (positions === 0) return "text-slate-300";
  if (positions < 3) return "text-amber-400";
  return "text-emerald-500";
}

export function SectionNav({ sections, activeSectionId, onSelect, onAddRate }: Props) {
  const total = sections.reduce((s, sc) => s + sc.direct, 0);
  const filled = sections.filter((sc) => sc.positions.length > 0).length;

  return (
    <aside className="w-52 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
      {/* Прогресс */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">
          Разделов заполнено: <span className="font-semibold text-slate-600">{filled}/{sections.length}</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${sections.length > 0 ? (filled / sections.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Список разделов */}
      <div className="flex-1 overflow-auto py-1">
        {sections.map((sc) => {
          const isActive = sc.section.id === activeSectionId;
          const posCount = sc.positions.length;
          return (
            <button
              key={sc.section.id}
              onClick={() => onSelect(sc.section.id)}
              className={`w-full text-left px-3 py-2 transition-colors flex items-start gap-2 ${
                isActive
                  ? "bg-emerald-50 border-r-2 border-emerald-500"
                  : "hover:bg-white border-r-2 border-transparent"
              }`}
            >
              <span className={`text-[11px] mt-0.5 shrink-0 ${completionColor(posCount)}`}>
                {completionIcon(posCount)}
              </span>
              <div className="min-w-0">
                <div className={`text-xs leading-tight font-medium truncate ${isActive ? "text-emerald-800" : "text-slate-700"}`}>
                  {sc.section.title.replace(/^Раздел \d+\.\s*/, "")}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {posCount} поз.
                  {sc.direct > 0 && (
                    <span className="ml-1 font-mono">{(sc.direct / 1000).toFixed(0)}к ₸</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Добавить расценку */}
      <div className="shrink-0 p-2.5 border-t border-slate-200 space-y-1.5">
        <button
          onClick={onAddRate}
          className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 flex items-center justify-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          Добавить расценку
        </button>
        {total > 0 && (
          <div className="text-center text-[10px] text-slate-500">
            Итого ПЗ: <span className="font-mono font-semibold text-slate-700">{formatKzt(total)}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
