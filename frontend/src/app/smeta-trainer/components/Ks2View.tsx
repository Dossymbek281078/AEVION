"use client";

import { useState } from "react";
import type { LsrCalc, Ks2Period } from "../lib/types";
import { formatKzt } from "../lib/calc";
import { findRate } from "../lib/corpus";

interface Props {
  calc: LsrCalc;
}

const MONTH_PRESETS = [
  "Июнь 2026", "Июль 2026", "Август 2026",
  "Сентябрь 2026", "Октябрь 2026", "Ноябрь 2026",
];

export function Ks2View({ calc }: Props) {
  const [periods, setPeriods] = useState<Ks2Period[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [newPeriodName, setNewPeriodName] = useState("");

  function addPeriod(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `ks2-${Date.now()}`;
    setPeriods((prev) => [...prev, { id, name: trimmed, volumes: {} }]);
    setActivePeriodId(id);
    setNewPeriodName("");
  }

  function setVolume(periodId: string, posId: string, vol: number) {
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId
          ? { ...p, volumes: { ...p.volumes, [posId]: Math.max(0, vol) } }
          : p
      )
    );
  }

  function removePeriod(id: string) {
    setPeriods((prev) => prev.filter((p) => p.id !== id));
    if (activePeriodId === id) {
      setActivePeriodId(null);
    }
  }

  // Собираем все позиции из всех разделов
  const allPositions = calc.sections.flatMap((sc) =>
    sc.positions.map((p) => ({
      section: sc.section,
      posCalc: p,
    }))
  );

  if (allPositions.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        Смета пуста. Добавьте позиции в ЛСР, затем вернитесь для работы с КС-2.
      </div>
    );
  }

  const activePeriod = periods.find((p) => p.id === activePeriodId);

  // Накопленные объёмы по всем периодам до активного (не включая)
  function cumBefore(posId: string): number {
    if (!activePeriodId) return 0;
    let total = 0;
    for (const p of periods) {
      if (p.id === activePeriodId) break;
      total += p.volumes[posId] ?? 0;
    }
    return total;
  }

  // Накопленные объёмы по всем периодам включая активный
  function cumIncl(posId: string): number {
    let total = 0;
    for (const p of periods) {
      total += p.volumes[posId] ?? 0;
      if (p.id === activePeriodId) break;
    }
    return total;
  }

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Заголовок */}
      <div className="border border-slate-300 bg-white">
        <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50 text-xs">
          <span className="text-slate-400">Унифицированная форма № КС-2</span>
          <span className="font-semibold text-slate-600">Акт выполненных работ</span>
        </div>
        <div className="px-4 py-2 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm text-slate-800">АКТ О ПРИЁМКЕ ВЫПОЛНЕННЫХ РАБОТ</div>
            <div className="text-xs text-slate-500 mt-0.5">{calc.lsr.title}</div>
          </div>
          <div className="text-xs text-slate-400">КС-2 (учебный)</div>
        </div>
      </div>

      {/* Управление периодами */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500">Периоды:</span>
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePeriodId(p.id)}
            className={`text-xs px-3 py-1 rounded border flex items-center gap-1.5 transition-colors ${
              activePeriodId === p.id
                ? "bg-emerald-100 border-emerald-400 text-emerald-800 font-semibold"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.name}
            <span
              onClick={(e) => { e.stopPropagation(); removePeriod(p.id); }}
              className="text-slate-300 hover:text-red-500 text-[10px] ml-0.5"
            >
              ✕
            </span>
          </button>
        ))}

        {/* Добавить период */}
        <div className="flex gap-1">
          <select
            className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={newPeriodName}
            onChange={(e) => setNewPeriodName(e.target.value)}
          >
            <option value="">Выбрать месяц...</option>
            {MONTH_PRESETS.filter((m) => !periods.find((p) => p.name === m)).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => addPeriod(newPeriodName)}
            disabled={!newPeriodName.trim()}
            className="text-xs px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-40 hover:bg-emerald-700"
          >
            + Добавить период
          </button>
        </div>
      </div>

      {/* Пояснение */}
      {!activePeriod && periods.length === 0 && (
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          <strong>Учебное задание (уровень 3 — ПТО).</strong> Добавьте месячный период (например, «Июнь 2026»)
          и введите фактические объёмы работ, выполненных в этом месяце по журналу работ.
          КС-2 формируется на каждый месяц нарастающим итогом.
        </div>
      )}

      {!activePeriod && periods.length > 0 && (
        <div className="text-sm text-slate-500 text-center py-4">
          Выберите период для просмотра/редактирования КС-2
        </div>
      )}

      {/* Таблица КС-2 */}
      {activePeriod && (
        <>
          <div className="text-xs font-semibold text-slate-700">
            КС-2 за период: {activePeriod.name}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: 900 }}>
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-1.5 py-1.5 text-[10px] font-semibold text-slate-600 w-8 text-center">№</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-28">Шифр</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600">Наименование работ</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-14 text-center">Ед.<br/>изм.</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-20 text-right">Цена<br/>ед., ₸</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-20 text-center bg-slate-200">По<br/>договору</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-20 text-center">С нач.<br/>(пред.)</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-20 text-center bg-emerald-50">В этом<br/>периоде</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-24 text-right bg-emerald-50">Стоим.<br/>периода, ₸</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-24 text-right">Нараст.<br/>итог, ₸</th>
                </tr>
                <tr>
                  {["1","2","3","4","5","6","7","8","9","10"].map((n, i) => (
                    <td key={i} className="border border-slate-200 text-center text-[9px] text-slate-400 py-0.5">{n}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calc.sections.map((sc) => {
                  if (sc.positions.length === 0) return null;

                  let sectionPeriodValue = 0;
                  let sectionCumValue = 0;

                  const rows = sc.positions.map((p, idx) => {
                    const posId = p.position.id;
                    const contractQty = p.position.volume;
                    const prevCum = cumBefore(posId);
                    const thisPeriodQty = activePeriod.volumes[posId] ?? 0;
                    const cumQty = cumIncl(posId);

                    const unitPrice = p.unitPrice;
                    const thisPeriodValue = thisPeriodQty * unitPrice;
                    const cumValue = cumQty * unitPrice;

                    sectionPeriodValue += thisPeriodValue;
                    sectionCumValue += cumValue;

                    const overPercent = cumQty > contractQty + 0.001 ? true : false;

                    return (
                      <tr key={posId} className={overPercent ? "bg-red-50" : "hover:bg-slate-50"}>
                        <td className="border border-slate-200 px-1.5 py-1 text-center text-slate-500">{idx + 1}</td>
                        <td className="border border-slate-200 px-1.5 py-1 font-mono text-[10px] text-slate-600">{p.rate.code}</td>
                        <td className="border border-slate-200 px-2 py-1 text-slate-800">
                          {p.rate.title}
                          {overPercent && (
                            <span className="text-[10px] text-red-600 ml-1">⚠ перевыполнение</span>
                          )}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-600">{p.rate.unit}</td>
                        <td className="border border-slate-200 px-2 py-1 text-right font-mono">{unitPrice.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center font-mono bg-slate-50">{contractQty}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center font-mono text-slate-500">{prevCum > 0 ? prevCum : "—"}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center bg-emerald-50">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={activePeriod.volumes[posId] ?? ""}
                            placeholder="0"
                            onChange={(e) =>
                              setVolume(activePeriod.id, posId, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 text-right text-xs font-mono border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                          />
                        </td>
                        <td className="border border-slate-200 px-2 py-1 text-right font-mono font-semibold text-emerald-700 bg-emerald-50">
                          {thisPeriodValue > 0 ? formatKzt(thisPeriodValue) : "—"}
                        </td>
                        <td className="border border-slate-200 px-2 py-1 text-right font-mono text-slate-700">
                          {cumValue > 0 ? formatKzt(cumValue) : "—"}
                        </td>
                      </tr>
                    );
                  });

                  return (
                    <>
                      <tr key={`sec-${sc.section.id}`} className="bg-slate-50">
                        <td className="border border-slate-200 px-2 py-1" />
                        <td colSpan={9} className="border border-slate-200 px-2 py-1 font-semibold text-slate-700">
                          {sc.section.title}
                        </td>
                      </tr>
                      {rows}
                      <tr key={`sec-total-${sc.section.id}`} className="bg-slate-100">
                        <td className="border border-slate-200 px-2 py-1" />
                        <td colSpan={7} className="border border-slate-200 px-2 py-1 text-right text-slate-600 font-semibold">
                          Итого по разделу:
                        </td>
                        <td className="border border-slate-200 px-2 py-1 text-right font-bold font-mono text-emerald-700 bg-emerald-50">
                          {sectionPeriodValue > 0 ? formatKzt(sectionPeriodValue) : "—"}
                        </td>
                        <td className="border border-slate-200 px-2 py-1 text-right font-bold font-mono">
                          {sectionCumValue > 0 ? formatKzt(sectionCumValue) : "—"}
                        </td>
                      </tr>
                    </>
                  );
                })}

                {/* Итого по акту */}
                <tr className="bg-emerald-50">
                  <td className="border border-slate-300 px-2 py-2" />
                  <td colSpan={7} className="border border-slate-300 px-2 py-2 font-bold text-slate-800 text-right uppercase">
                    ИТОГО ПО АКТУ КС-2:
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-bold font-mono text-xl text-emerald-800">
                    {formatKzt(
                      calc.sections.reduce((total, sc) =>
                        total + sc.positions.reduce((s, p) => {
                          const qty = activePeriod.volumes[p.position.id] ?? 0;
                          return s + qty * p.unitPrice;
                        }, 0), 0
                      )
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-bold font-mono text-slate-800">
                    {formatKzt(
                      calc.sections.reduce((total, sc) =>
                        total + sc.positions.reduce((s, p) => {
                          const qty = cumIncl(p.position.id);
                          return s + qty * p.unitPrice;
                        }, 0), 0
                      )
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Подписи */}
          <div className="grid grid-cols-2 gap-6 text-xs text-slate-600 pt-2">
            <div className="space-y-2">
              <div className="flex gap-2 items-baseline">
                <span className="shrink-0">Сдал (подрядчик):</span>
                <div className="flex-1 border-b border-slate-300" />
              </div>
              <div className="flex gap-2 items-baseline">
                <span className="shrink-0">Должность, ФИО:</span>
                <div className="flex-1 border-b border-slate-300" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 items-baseline">
                <span className="shrink-0">Принял (заказчик/тех.надзор):</span>
                <div className="flex-1 border-b border-slate-300" />
              </div>
              <div className="flex gap-2 items-baseline">
                <span className="shrink-0">Должность, ФИО:</span>
                <div className="flex-1 border-b border-slate-300" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* КС-3 нарастающий итог */}
      {periods.length > 0 && (
        <div className="border border-slate-200 rounded bg-white">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold text-slate-700">КС-3 — нарастающий итог</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-slate-200 px-3 py-1.5 text-left text-[10px] text-slate-500">Период</th>
                <th className="border-b border-slate-200 px-3 py-1.5 text-right text-[10px] text-slate-500">Стоимость за период</th>
                <th className="border-b border-slate-200 px-3 py-1.5 text-right text-[10px] text-slate-500">Нарастающий итог</th>
                <th className="border-b border-slate-200 px-3 py-1.5 text-right text-[10px] text-slate-500">% от договора</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let cumTotal = 0;
                const contractTotal = calc.sections.reduce((s, sc) => s + sc.direct, 0);
                return periods.map((period) => {
                  const periodValue = calc.sections.reduce(
                    (total, sc) =>
                      total +
                      sc.positions.reduce((s, p) => {
                        const qty = period.volumes[p.position.id] ?? 0;
                        return s + qty * p.unitPrice;
                      }, 0),
                    0
                  );
                  cumTotal += periodValue;
                  const pct = contractTotal > 0 ? (cumTotal / contractTotal) * 100 : 0;
                  return (
                    <tr key={period.id} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-1.5">{period.name}</td>
                      <td className="border-b border-slate-100 px-3 py-1.5 text-right font-mono">{formatKzt(periodValue)}</td>
                      <td className="border-b border-slate-100 px-3 py-1.5 text-right font-mono font-semibold">{formatKzt(cumTotal)}</td>
                      <td className="border-b border-slate-100 px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-600">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
