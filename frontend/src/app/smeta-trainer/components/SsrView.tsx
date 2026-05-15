"use client";

import type { LsrCalc } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  calc: LsrCalc;
}

export function SsrView({ calc }: Props) {
  const totalDirect = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const totalFot = calc.sections.reduce((s, sc) => s + sc.fot, 0);
  const totalOverhead = calc.sections.reduce((s, sc) => s + sc.overhead, 0);
  const totalProfit = calc.sections.reduce((s, sc) => s + sc.profit, 0);
  const totalBeforeVat = calc.totalBeforeVat;
  const vat = calc.vat;
  const totalWithVat = calc.totalWithVat;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      {/* Заголовок */}
      <div className="border border-slate-300 bg-white">
        <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50 text-xs">
          <span className="text-slate-400">Учебный расчёт. НДЦС РК 8.01-08-2022.</span>
          <span className="font-semibold text-slate-600">НР, СП, НДС</span>
        </div>
        <div className="px-4 py-3">
          <div className="font-semibold text-slate-800 text-sm mb-1">
            СВОД НАКЛАДНЫХ РАСХОДОВ И СМЕТНОЙ ПРИБЫЛИ
          </div>
          <div className="text-xs text-slate-500">{calc.lsr.title}</div>
        </div>
      </div>

      {/* Пояснение метода */}
      <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
        <strong>Метод:</strong> базисно-индексный. НР и СП начисляются от ФОТ (средства на оплату труда) по нормативам СН РК 8.02-07.
        В учебном корпусе нормативы упрощены. В реальной ЛСР НР и СП в тело таблицы не включаются — они идут в ССР (Форма 1).
      </div>

      {/* Таблица по разделам */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600">Раздел / вид работ</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">Прямые затраты</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-24">ФОТ</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">НР (% от ФОТ)</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">СП (% от ФОТ)</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">Итого по разделу</th>
          </tr>
        </thead>
        <tbody>
          {calc.sections.map((sc) => {
            if (sc.positions.length === 0) return null;
            const overheadRule = { overheadPct: sc.fot > 0 ? (sc.overhead / sc.fot) * 100 : 0, profitPct: sc.fot > 0 ? (sc.profit / sc.fot) * 100 : 0 };
            return (
              <tr key={sc.section.id} className="hover:bg-slate-50">
                <td className="border border-slate-200 px-2 py-1.5 text-slate-800">{sc.section.title}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-right font-mono">{formatKzt(sc.direct)}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-600">{formatKzt(sc.fot)}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-right font-mono">
                  <span className="text-slate-400 text-[10px] mr-1">{overheadRule.overheadPct.toFixed(0)}%</span>
                  {formatKzt(sc.overhead)}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 text-right font-mono">
                  <span className="text-slate-400 text-[10px] mr-1">{overheadRule.profitPct.toFixed(0)}%</span>
                  {formatKzt(sc.profit)}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 text-right font-mono font-semibold text-slate-900">{formatKzt(sc.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-300 px-2 py-1.5 text-slate-700">ИТОГО</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatKzt(totalDirect)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono text-slate-600">{formatKzt(totalFot)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatKzt(totalOverhead)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatKzt(totalProfit)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono text-slate-900">{formatKzt(totalBeforeVat)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Итоговый блок */}
      <div className="border border-slate-300 bg-white divide-y divide-slate-100">
        {[
          { label: "Прямые затраты (ПЗ)", value: totalDirect, note: "Из ЛСР: ФОТ + ЭМ + Материалы" },
          { label: "Накладные расходы (НР)", value: totalOverhead, note: "ФОТ × нормативный % по виду работ" },
          { label: "Сметная прибыль (СП)", value: totalProfit, note: "ФОТ × нормативный % по виду работ" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-2">
            <div>
              <div className="text-sm text-slate-800">{row.label}</div>
              <div className="text-[10px] text-slate-400">{row.note}</div>
            </div>
            <div className="font-mono font-semibold text-slate-800">{formatKzt(row.value)}</div>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
          <div className="text-sm font-semibold text-slate-800">ПЗ + НР + СП (без НДС)</div>
          <div className="font-mono font-bold text-slate-900">{formatKzt(totalBeforeVat)}</div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <div>
            <div className="text-sm text-slate-800">НДС 12%</div>
            <div className="text-[10px] text-slate-400">Ставка 2026 г. по НК РК</div>
          </div>
          <div className="font-mono font-semibold text-slate-800">{formatKzt(vat)}</div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50">
          <div className="text-base font-bold text-emerald-900">ИТОГО С НДС</div>
          <div className="font-mono font-bold text-xl text-emerald-800">{formatKzt(totalWithVat)}</div>
        </div>
      </div>
    </div>
  );
}
