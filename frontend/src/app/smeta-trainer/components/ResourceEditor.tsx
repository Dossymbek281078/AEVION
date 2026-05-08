"use client";

import { useEffect, useMemo, useState } from "react";
import type { Resource, Rate, SmetaPosition } from "../lib/types";
import { findSscMatch } from "../lib/materialPrices";
import { formatKzt } from "../lib/calc";

interface Props {
  position: SmetaPosition;
  rate: Rate;
  /** Сохранить новые ресурсы в позицию (полная замена). */
  onSave: (resources: Resource[]) => void;
  /** Сбросить override → вернуться к нормативным. */
  onReset: () => void;
  onClose: () => void;
}

/**
 * Редактор состава ресурсов одной позиции сметы. Студент может:
 *  - изменить расход материала на единицу (qtyPerUnit)
 *  - заменить материал/машину/рабочего другим (name)
 *  - изменить базовую цену (basePrice)
 *  - удалить ресурс или добавить новый
 *  - сбросить всё к нормативным (rate.resources)
 *
 * Изменения сохраняются в SmetaPosition.resourceOverrides и видны в любом
 * расчёте/печати. На каждый ресурс-материал показываем подсказку из ССЦ
 * (если есть match) — чтобы студент видел реальную сметную цену.
 */
export function ResourceEditor({ position, rate, onSave, onReset, onClose }: Props) {
  const initial = position.resourceOverrides ?? rate.resources;
  // Копия для локального редактирования
  const [resources, setResources] = useState<Resource[]>(() => initial.map((r) => ({ ...r })));
  const isOverridden = !!position.resourceOverrides;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update(idx: number, patch: Partial<Resource>) {
    setResources((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function remove(idx: number) {
    setResources((prev) => prev.filter((_, i) => i !== idx));
  }
  function add(kind: Resource["kind"]) {
    const defaults: Record<Resource["kind"], Partial<Resource>> = {
      труд: { name: "Подсобный рабочий 2 разряда", qtyPerUnit: 1, unit: "чел.-ч", basePrice: 200 },
      машины: { name: "Новый ресурс", qtyPerUnit: 1, unit: "маш.-ч", basePrice: 1000 },
      материал: { name: "Новый материал", qtyPerUnit: 1, unit: "шт", basePrice: 100 },
    };
    setResources((prev) => [...prev, { kind, ...defaults[kind] } as Resource]);
  }

  // Подсчёт промежуточных итогов по компонентам
  const totals = useMemo(() => {
    let fot = 0, em = 0, mat = 0;
    for (const r of resources) {
      const cost = r.qtyPerUnit * r.basePrice;
      if (r.kind === "труд") fot += cost;
      else if (r.kind === "машины") em += cost;
      else if (r.kind === "материал") mat += cost;
    }
    return { fot, em, mat, total: fot + em + mat };
  }, [resources]);

  // Промежуточные итоги по нормативным (для сравнения)
  const baseTotals = useMemo(() => {
    let fot = 0, em = 0, mat = 0;
    for (const r of rate.resources) {
      const cost = r.qtyPerUnit * r.basePrice;
      if (r.kind === "труд") fot += cost;
      else if (r.kind === "машины") em += cost;
      else if (r.kind === "материал") mat += cost;
    }
    return { fot, em, mat, total: fot + em + mat };
  }, [rate]);

  const KIND_COLOR: Record<Resource["kind"], string> = {
    труд: "bg-blue-50 text-blue-700",
    машины: "bg-amber-50 text-amber-700",
    материал: "bg-emerald-50 text-emerald-700",
  };
  const KIND_ICON: Record<Resource["kind"], string> = {
    труд: "👷",
    машины: "🚜",
    материал: "📦",
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-slate-900 text-white rounded-t-lg flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 flex items-center gap-2">
              Редактор ресурсов расценки
              {isOverridden && (
                <span className="px-1.5 py-0.5 bg-amber-500/30 text-amber-200 rounded text-[10px]">
                  ✎ изменено
                </span>
              )}
            </div>
            <div className="text-sm font-mono text-emerald-300">{rate.code}</div>
            <div className="text-sm text-white truncate" title={rate.title}>{rate.title}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              на {rate.unit} · объём в смете: {position.volume}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => add("труд")}
            className="text-[11px] px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
          >
            + 👷 Труд
          </button>
          <button
            onClick={() => add("машины")}
            className="text-[11px] px-2 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded"
          >
            + 🚜 Машина
          </button>
          <button
            onClick={() => add("материал")}
            className="text-[11px] px-2 py-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded"
          >
            + 📦 Материал
          </button>
          <div className="ml-auto text-[10px] text-slate-500">
            Изменения применятся только к этой позиции в смете
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-slate-600 uppercase text-[10px]">
                <th className="px-2 py-2 w-12"></th>
                <th className="px-2 py-2">Наименование</th>
                <th className="px-2 py-2 w-20">Ед.</th>
                <th className="px-2 py-2 w-24 text-right">Расход на ед.</th>
                <th className="px-2 py-2 w-28 text-right">Цена за ед., ₸</th>
                <th className="px-2 py-2 w-28 text-right">Стоимость</th>
                <th className="px-2 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => {
                const sscMatch = r.kind === "материал" ? findSscMatch(r.name, r.unit) : null;
                const isPriceDifferent =
                  sscMatch && Math.abs(sscMatch.smetnaya - r.basePrice) > 1;
                return (
                  <tr key={i} className="border-t hover:bg-slate-50/50">
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${KIND_COLOR[r.kind]}`}
                        title={r.kind}
                      >
                        {KIND_ICON[r.kind]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        className="w-full border border-transparent hover:border-slate-200 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs"
                      />
                      {r.kind === "материал" && sscMatch && (
                        <div className="text-[10px] text-slate-400 mt-0.5 px-1.5">
                          ССЦ: <span className="font-mono">{sscMatch.sscCode}</span>{" "}
                          {sscMatch.sscName.slice(0, 50)}
                          {isPriceDifferent && (
                            <button
                              onClick={() => update(i, { basePrice: sscMatch.smetnaya })}
                              className="ml-2 text-emerald-600 hover:text-emerald-800 underline"
                              title="Подставить цену из ССЦ"
                            >
                              → {formatKzt(sscMatch.smetnaya)}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.unit}
                        onChange={(e) => update(i, { unit: e.target.value })}
                        className="w-full border border-transparent hover:border-slate-200 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        value={r.qtyPerUnit}
                        onChange={(e) => update(i, { qtyPerUnit: Number(e.target.value) || 0 })}
                        className="w-full text-right border border-transparent hover:border-slate-200 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="1"
                        min={0}
                        value={r.basePrice}
                        onChange={(e) => update(i, { basePrice: Number(e.target.value) || 0 })}
                        className="w-full text-right border border-transparent hover:border-slate-200 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums font-semibold">
                      {formatKzt(r.qtyPerUnit * r.basePrice)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => remove(i)}
                        className="text-red-400 hover:text-red-700 text-base leading-none"
                        title="Удалить ресурс"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {resources.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-6 text-sm">
                    Нет ресурсов. Добавьте через кнопки сверху.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 sticky bottom-0">
              <tr className="font-semibold">
                <td colSpan={5} className="px-2 py-2 text-right text-slate-600 text-[11px]">
                  Базисная стоимость единицы расценки:
                </td>
                <td className="px-2 py-2 text-right text-emerald-700 tabular-nums">
                  {formatKzt(totals.total)}
                </td>
                <td></td>
              </tr>
              <tr className="text-[10px] text-slate-500">
                <td colSpan={5} className="px-2 py-1 text-right">
                  по нормативу: {formatKzt(baseTotals.total)}
                  {Math.abs(totals.total - baseTotals.total) > 0.5 && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 rounded ${
                        totals.total > baseTotals.total
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      Δ {totals.total > baseTotals.total ? "+" : ""}
                      {formatKzt(totals.total - baseTotals.total)}
                    </span>
                  )}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr className="text-[10px] text-slate-500 border-t">
                <td colSpan={2} className="px-2 py-1">
                  ФОТ: {formatKzt(totals.fot)}{" "}
                  <span className="text-slate-400">(норм. {formatKzt(baseTotals.fot)})</span>
                </td>
                <td colSpan={2} className="px-2 py-1">
                  ЭМ: {formatKzt(totals.em)}{" "}
                  <span className="text-slate-400">(норм. {formatKzt(baseTotals.em)})</span>
                </td>
                <td colSpan={3} className="px-2 py-1">
                  Материалы: {formatKzt(totals.mat)}{" "}
                  <span className="text-slate-400">(норм. {formatKzt(baseTotals.mat)})</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t bg-slate-50 rounded-b-lg flex items-center justify-between">
          <div>
            {isOverridden && (
              <button
                onClick={() => {
                  if (confirm("Сбросить ресурсы к нормативным значениям расценки?")) {
                    onReset();
                  }
                }}
                className="text-[11px] text-amber-700 hover:text-amber-900 underline"
              >
                ↺ Вернуть к нормативу
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              Отмена (Esc)
            </button>
            <button
              onClick={() => {
                onSave(resources);
                onClose();
              }}
              className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
