"use client";

import type { LsrCalc } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  calc: LsrCalc;
}

export function StickyTotals({ calc }: Props) {
  const direct = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const overhead = calc.sections.reduce((s, sc) => s + sc.overhead + sc.profit, 0);
  const total = calc.totalBeforeVat;
  const vat = calc.vat;
  const grand = calc.totalWithVat;
  const totalPositions = calc.sections.reduce((s, sc) => s + sc.positions.length, 0);

  if (totalPositions === 0) return null;

  const pctDone = (direct > 0 && grand > 0) ? Math.min((direct / grand) * 100, 100) : 0;

  return (
    <div className="shrink-0 bg-white border-t-2 border-emerald-200 px-4 py-2 flex items-center gap-4 text-xs print:hidden">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        <div>
          <div className="text-[10px] text-slate-400">Прямые затраты</div>
          <div className="font-mono font-semibold text-slate-700">{formatKzt(direct)}</div>
        </div>
        <div className="text-slate-300">+</div>
        <div>
          <div className="text-[10px] text-slate-400">НР + СП</div>
          <div className="font-mono font-semibold text-slate-700">{formatKzt(overhead)}</div>
        </div>
        <div className="text-slate-300">+</div>
        <div>
          <div className="text-[10px] text-slate-400">НДС 12%</div>
          <div className="font-mono font-semibold text-slate-700">{formatKzt(vat)}</div>
        </div>
        <div className="text-slate-300">=</div>
        <div>
          <div className="text-[10px] text-slate-400">ИТОГО с НДС</div>
          <div className="font-mono font-bold text-emerald-700 text-sm">{formatKzt(grand)}</div>
        </div>
      </div>

      {/* Мини-прогресс по позициям */}
      <div className="shrink-0 text-right">
        <div className="text-[10px] text-slate-400">{totalPositions} позиций</div>
        <div className="text-[10px] text-slate-400">
          {calc.sections.filter((s) => s.positions.length > 0).length}/{calc.sections.length} разд.
        </div>
      </div>
    </div>
  );
}
