"use client";

import type { PositionCalc, AiNotice } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  calc: PositionCalc;
  notices: AiNotice[];
  onChangeVolume: (value: number) => void;
  onRemove: () => void;
}

export function PositionRow({ calc, notices, onChangeVolume, onRemove }: Props) {
  const errorNotice = notices.find((n) => n.severity === "error");
  const hasError = !!errorNotice;

  return (
    <tr className={hasError ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
      <td className="px-2 py-1.5 font-mono text-xs text-slate-600 border-b border-slate-200">
        {calc.rate.code}
      </td>
      <td className="px-2 py-1.5 text-xs text-slate-900 border-b border-slate-200">
        <div className="font-medium">{calc.rate.title}</div>
        {hasError && errorNotice && (
          <div className="text-[10px] text-red-700 mt-0.5">⚠ {errorNotice.title}</div>
        )}
      </td>
      <td className="px-2 py-1.5 text-xs text-slate-600 border-b border-slate-200 font-mono whitespace-nowrap">
        {calc.rate.unit}
      </td>
      <td className="px-2 py-1.5 border-b border-slate-200">
        <input
          type="number"
          step="0.001"
          value={calc.position.volume}
          onChange={(e) => onChangeVolume(parseFloat(e.target.value) || 0)}
          className={`w-24 px-2 py-1 text-right text-xs font-mono rounded border focus:outline-none focus:ring-1 ${
            hasError
              ? "border-red-400 bg-red-50 focus:ring-red-500"
              : "border-slate-300 focus:ring-emerald-500"
          }`}
        />
      </td>
      <td className="px-2 py-1.5 text-xs text-right text-slate-700 border-b border-slate-200 font-mono whitespace-nowrap">
        {formatKzt(calc.current.fot)}
      </td>
      <td className="px-2 py-1.5 text-xs text-right text-slate-700 border-b border-slate-200 font-mono whitespace-nowrap">
        {formatKzt(calc.current.em)}
      </td>
      <td className="px-2 py-1.5 text-xs text-right text-slate-700 border-b border-slate-200 font-mono whitespace-nowrap">
        {formatKzt(calc.current.materials)}
      </td>
      <td className="px-2 py-1.5 text-xs text-right font-bold text-slate-900 border-b border-slate-200 font-mono whitespace-nowrap">
        {formatKzt(calc.current.direct)}
      </td>
      <td className="px-2 py-1.5 border-b border-slate-200 text-center">
        <button
          onClick={onRemove}
          className="text-xs text-slate-400 hover:text-red-600 px-1"
          title="Удалить позицию"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
