"use client";

/**
 * Форма 2 РК — «Акт выполненных работ» по НДЦС РК 8.01-08.
 * Казахстанская национальная форма приёмки СМР (аналог КС-2 РФ, но с особенностями).
 * Используется параллельно с КС-2 в проектах с государственным финансированием.
 *
 * Отличия от КС-2:
 *   - Колонки в тенге (не рубли);
 *   - Поле «Объёмы выполнены согласно РП» (ссылка на проектную документацию);
 *   - Подпись Технического надзора заказчика обязательна;
 *   - Графа «Объём по проекту» + «Объём по факту» отдельно.
 */

import type { LsrCalc } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  calc: LsrCalc;
}

export function Form2RkView({ calc }: Props) {
  const today = new Date().toLocaleDateString("ru-RU");
  const allPositions = calc.sections.flatMap((sc) => sc.positions.map((p) => ({ section: sc.section, posCalc: p })));

  return (
    <div className="space-y-3 text-slate-700 print:text-black">
      <div className="border border-slate-200 rounded-lg bg-white p-6 print:border-0 print:p-0 print:shadow-none">
        {/* Header РК-style */}
        <div className="text-center space-y-1 mb-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 print:text-slate-700">Форма Ф-2 НДЦС РК 8.01-08-2022</div>
          <div className="text-lg font-bold uppercase">Акт выполненных работ</div>
          <div className="text-xs text-slate-500">Қазақстан Республикасы Қаржы министрлігі Бұйрығы № 562 (06.12.2018)</div>
        </div>

        {/* Шапка */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-4 border-y border-slate-200 py-3">
          <div>
            <div><span className="text-slate-500">Стройка:</span> {calc.lsr.meta?.strojkaTitle ?? "________________"}</div>
            <div><span className="text-slate-500">Объект:</span> {calc.lsr.meta?.objectTitle ?? "________________"}</div>
            <div><span className="text-slate-500">№ ЛСР:</span> {calc.lsr.meta?.lsrNumber ?? "____"}</div>
          </div>
          <div>
            <div><span className="text-slate-500">Дата составления:</span> {today}</div>
            <div><span className="text-slate-500">Подрядчик:</span> ________________</div>
            <div><span className="text-slate-500">Заказчик:</span> ________________</div>
          </div>
        </div>

        {/* Таблица */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2 py-1 w-10">№</th>
                <th className="border border-slate-300 px-2 py-1">Шифр расценки</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Наименование работ</th>
                <th className="border border-slate-300 px-2 py-1">Ед. изм.</th>
                <th className="border border-slate-300 px-2 py-1">Объём по проекту</th>
                <th className="border border-slate-300 px-2 py-1">Объём по факту</th>
                <th className="border border-slate-300 px-2 py-1">Цена за ед., тг</th>
                <th className="border border-slate-300 px-2 py-1">Сумма, тг</th>
              </tr>
            </thead>
            <tbody>
              {allPositions.map((entry, idx) => (
                <tr key={entry.posCalc.position.id} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-[10px]">{entry.posCalc.rate.code}</td>
                  <td className="border border-slate-300 px-2 py-1">{entry.posCalc.rate.title}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{entry.posCalc.rate.unit}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono">{entry.posCalc.position.volume.toFixed(2)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono">{entry.posCalc.position.volume.toFixed(2)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono">{formatKzt(entry.posCalc.unitPrice)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono font-semibold">
                    {formatKzt(entry.posCalc.position.volume * entry.posCalc.unitPrice)}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={7} className="border border-slate-300 px-2 py-2 text-right font-bold uppercase">ИТОГО (без НДС):</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-bold font-mono text-emerald-800">
                  {formatKzt(calc.totalBeforeVat)}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="border border-slate-300 px-2 py-2 text-right font-bold uppercase">НДС 12%:</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-bold font-mono">
                  {formatKzt(calc.vat)}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="border border-slate-300 px-2 py-2 text-right font-bold uppercase bg-emerald-50">ВСЕГО С НДС:</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-bold font-mono text-lg text-emerald-800 bg-emerald-50">
                  {formatKzt(calc.totalWithVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Подписи трёх сторон (РК-специфика) */}
        <div className="grid grid-cols-3 gap-6 text-xs pt-6 mt-4 border-t border-slate-200">
          <div className="space-y-2">
            <div className="font-semibold text-slate-700 uppercase">Подрядчик</div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">Должность:</span><div className="flex-1 border-b border-slate-300" /></div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">ФИО:</span><div className="flex-1 border-b border-slate-300" /></div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">Подпись:</span><div className="flex-1 border-b border-slate-300" /></div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-slate-700 uppercase">Заказчик</div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">Должность:</span><div className="flex-1 border-b border-slate-300" /></div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">ФИО:</span><div className="flex-1 border-b border-slate-300" /></div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">Подпись:</span><div className="flex-1 border-b border-slate-300" /></div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-slate-700 uppercase">Технадзор</div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">Должность:</span><div className="flex-1 border-b border-slate-300" /></div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">ФИО:</span><div className="flex-1 border-b border-slate-300" /></div>
            <div className="flex gap-2 items-baseline"><span className="shrink-0">Подпись:</span><div className="flex-1 border-b border-slate-300" /></div>
          </div>
        </div>

        <div className="mt-4 text-[10px] text-slate-400 italic text-center">
          Объёмы работ выполнены в соответствии с РП {calc.lsr.meta?.osnovanje ?? "________________"}.
          Качество соответствует СН РК и проектной документации.
        </div>
      </div>

      <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm print:hidden">
        🖨 Распечатать форму Ф-2
      </button>
    </div>
  );
}
