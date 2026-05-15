"use client";

import { useState } from "react";
import type { AppliedCoefficient } from "../lib/types";

interface Props {
  coefficients: AppliedCoefficient[];
  onChange: (updated: AppliedCoefficient[]) => void;
  disabled?: boolean;
}

const PRESETS: { kind: AppliedCoefficient["kind"]; label: string; value: number; note: string }[] = [
  { kind: "действующий-объект", label: "Действующий объект", value: 1.15, note: "ЕНиР, прил. 1, п. 2" },
  { kind: "стеснённые",         label: "Стеснённые условия",  value: 1.15, note: "ЕНиР, прил. 1, п. 3" },
  { kind: "социальный-объект",  label: "Соц. объект",         value: 1.10, note: "СН РК 8.02-07" },
  { kind: "высота",             label: "Высота > 15 м",       value: 1.25, note: "ЕНиР, прил. 1, п. 5" },
  { kind: "охранные-зоны",      label: "Охранная зона",       value: 1.25, note: "ЕНиР, прил. 1, п. 6" },
  { kind: "выходные",           label: "Выходные/праздники",  value: 1.25, note: "ТК РК, ст. 109" },
];

export function CoefBadge({ coefficients, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  const total = coefficients.reduce((acc, c) => acc * c.value, 1);

  function add(preset: typeof PRESETS[0]) {
    const already = coefficients.find((c) => c.kind === preset.kind);
    if (already) return;
    onChange([...coefficients, { kind: preset.kind, value: preset.value, justification: preset.note }]);
    setOpen(false);
  }

  function remove(kind: AppliedCoefficient["kind"]) {
    onChange(coefficients.filter((c) => c.kind !== kind));
  }

  if (disabled) {
    return coefficients.length > 0 ? (
      <div className="flex flex-wrap gap-0.5">
        {coefficients.map((c) => (
          <span key={c.kind} className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200">
            К={c.value}
          </span>
        ))}
      </div>
    ) : null;
  }

  return (
    <div className="relative inline-flex items-center gap-0.5">
      {/* Применённые коэффициенты */}
      {coefficients.map((c) => (
        <button
          key={c.kind}
          onClick={() => remove(c.kind)}
          className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200 hover:bg-red-100 hover:text-red-600 hover:border-red-300 transition-colors"
          title={`${c.justification} — нажмите для удаления`}
        >
          К={c.value} ✕
        </button>
      ))}

      {/* Итоговый множитель */}
      {total > 1.001 && (
        <span className="text-[9px] font-bold text-amber-700 ml-0.5">×{total.toFixed(2)}</span>
      )}

      {/* Кнопка добавить коэффициент */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[9px] bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700 px-1 py-0.5 rounded border border-slate-200 hover:border-amber-300 transition-colors ml-0.5"
        title="Добавить коэффициент условий производства работ"
      >
        +К
      </button>

      {/* Дропдаун */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg w-56 py-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1.5 border-b border-slate-100">
              Коэффициенты условий производства
            </div>
            {PRESETS.map((p) => {
              const applied = coefficients.some((c) => c.kind === p.kind);
              return (
                <button
                  key={p.kind}
                  onClick={() => add(p)}
                  disabled={applied}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-amber-50 flex justify-between items-center ${applied ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <div>
                    <div className="font-medium text-slate-800">{p.label}</div>
                    <div className="text-[10px] text-slate-400">{p.note}</div>
                  </div>
                  <span className="font-mono font-bold text-amber-700 shrink-0 ml-2">×{p.value}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
