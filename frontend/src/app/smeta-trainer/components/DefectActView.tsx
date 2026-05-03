"use client";

import { useState } from "react";
import type { Lsr, SmetaPosition } from "../lib/types";
import { rates } from "../lib/corpus";

interface DefectItem {
  id: string;
  room: string;
  defect: string;
  rateCode: string;
  unit: string;
  suggestedVolume: number;
  checked: boolean;
}

const TEMPLATE_DEFECTS: Omit<DefectItem, "id" | "room" | "checked">[] = [
  { defect: "Старая штукатурка требует замены (трещины, отслоения)", rateCode: "ДЕМ-15-01-001", unit: "100 м²", suggestedVolume: 0.84 },
  { defect: "Напольное покрытие (линолеум/ламинат) изношено", rateCode: "ДЕМ-11-01-002", unit: "100 м²", suggestedVolume: 0.49 },
  { defect: "Стяжка пола повреждена (трещины, сколы)", rateCode: "ДЕМ-11-02-001", unit: "100 м²", suggestedVolume: 0.49 },
  { defect: "Деревянные окна — замена на ПВХ", rateCode: "ДЕМ-06-01-001", unit: "шт", suggestedVolume: 2 },
  { defect: "Дверной блок — замена", rateCode: "ДЕМ-06-02-001", unit: "шт", suggestedVolume: 1 },
  { defect: "Штукатурка стен под чистовую отделку", rateCode: "ОТД-13-01-001", unit: "100 м²", suggestedVolume: 0.84 },
  { defect: "Шпатлёвка стен под окраску", rateCode: "ОТД-15-02-003", unit: "100 м²", suggestedVolume: 0.84 },
  { defect: "Стены требуют окраски водоэмульсионной краской", rateCode: "ОТД-15-04-001", unit: "100 м²", suggestedVolume: 0.84 },
  { defect: "Устройство новой стяжки пола (40 мм)", rateCode: "ОТД-11-02-001", unit: "100 м²", suggestedVolume: 0.49 },
  { defect: "Укладка нового напольного покрытия (ламинат)", rateCode: "ОТД-11-04-002", unit: "100 м²", suggestedVolume: 0.49 },
  { defect: "Система отопления — замена радиаторов", rateCode: "СНТ-16-02-001", unit: "шт", suggestedVolume: 2 },
  { defect: "Электроосвещение — замена светильников", rateCode: "ЭЛ-21-03-001", unit: "шт", suggestedVolume: 2 },
];

interface Props {
  lsr: Lsr;
  onAddPositions: (sectionId: string, positions: Omit<SmetaPosition, "id">[]) => void;
}

export function DefectActView({ lsr, onAddPositions }: Props) {
  const [items, setItems] = useState<DefectItem[]>(
    TEMPLATE_DEFECTS.map((t, i) => ({ ...t, id: `d${i}`, room: "Классная комната №__", checked: false }))
  );
  const [customRoom, setCustomRoom] = useState("Классная комната №12");
  const [applied, setApplied] = useState(false);

  function toggle(id: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
  }

  function setVolume(id: string, vol: number) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, suggestedVolume: vol } : item));
  }

  function applyToLsr() {
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) return;

    // Распределяем по разделам
    const demoSection = lsr.sections.find((s) => s.category === "демонтажные");
    const otdelSection = lsr.sections.find((s) => s.category === "отделочные");

    const demoPositions: Omit<SmetaPosition, "id">[] = [];
    const otdelPositions: Omit<SmetaPosition, "id">[] = [];

    for (const item of checked) {
      const pos = { rateCode: item.rateCode, volume: item.suggestedVolume, coefficients: [], note: `Дефект: ${item.defect}. Помещение: ${customRoom}` };
      if (item.rateCode.startsWith("ДЕМ")) demoPositions.push(pos);
      else otdelPositions.push(pos);
    }

    if (demoSection && demoPositions.length) onAddPositions(demoSection.id, demoPositions);
    if (otdelSection && otdelPositions.length) onAddPositions(otdelSection.id, otdelPositions);

    setApplied(true);
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      {/* Шапка */}
      <div className="border border-slate-300 bg-white">
        <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50 text-xs">
          <span className="text-slate-400">Учебный документ</span>
          <span className="font-semibold text-slate-600">Дефектная ведомость</span>
        </div>
        <div className="px-4 py-3">
          <div className="font-semibold text-sm text-slate-800">ДЕФЕКТНАЯ ВЕДОМОСТЬ</div>
          <div className="text-xs text-slate-500 mt-0.5">Школа №47, г. Алматы — {lsr.meta?.objectTitle ?? "крыло Б"}</div>
        </div>
      </div>

      {/* Помещение */}
      <div className="flex gap-2 items-center text-sm">
        <span className="text-slate-600 text-xs font-medium shrink-0">Помещение:</span>
        <input
          className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          value={customRoom}
          onChange={(e) => setCustomRoom(e.target.value)}
          placeholder="Например: Классная комната №12"
        />
      </div>

      {/* Пояснение */}
      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
        <strong>Как работать:</strong> Отметьте дефекты, которые есть в помещении. Укажите реальные объёмы. Нажмите «Добавить в смету» — позиции автоматически попадут в нужные разделы ЛСР.
      </div>

      {/* Таблица дефектов */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 w-8 text-center">✓</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600">Дефект / Вид работ</th>
            <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-28">Расценка</th>
            <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-16 text-center">Ед.</th>
            <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-20 text-center">Объём</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={item.checked ? "bg-emerald-50" : "hover:bg-slate-50"}>
              <td className="border border-slate-200 px-2 py-1.5 text-center">
                <input type="checkbox" checked={item.checked} onChange={() => toggle(item.id)} className="accent-emerald-600" />
              </td>
              <td className="border border-slate-200 px-2 py-1.5 text-slate-800">{item.defect}</td>
              <td className="border border-slate-200 px-2 py-1.5 font-mono text-[10px] text-slate-500">{item.rateCode}</td>
              <td className="border border-slate-200 px-2 py-1.5 text-center font-mono text-slate-500">{item.unit}</td>
              <td className="border border-slate-200 px-1 py-1 text-center">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.suggestedVolume}
                  onChange={(e) => setVolume(item.id, parseFloat(e.target.value) || 0)}
                  className={`w-16 text-right text-xs font-mono border rounded px-1 py-0.5 focus:outline-none focus:ring-1 ${item.checked ? "border-emerald-400 focus:ring-emerald-500 bg-white" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Кнопка применить */}
      <div className="flex items-center gap-3">
        <button
          onClick={applyToLsr}
          disabled={checkedCount === 0 || applied}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
        >
          {applied ? "✓ Добавлено в смету" : `Добавить в смету (${checkedCount} позиций)`}
        </button>
        {applied && (
          <button onClick={() => setApplied(false)} className="text-xs text-slate-400 underline">
            Сбросить
          </button>
        )}
        <span className="text-xs text-slate-400">→ Перейдите на вкладку «ЛСР» чтобы увидеть добавленные позиции</span>
      </div>

      {/* Подписи */}
      <div className="grid grid-cols-2 gap-6 text-xs text-slate-600 pt-2 border-t border-slate-200">
        <div className="space-y-2">
          <div className="flex gap-2 items-baseline"><span className="shrink-0">Составил (прораб):</span><div className="flex-1 border-b border-slate-300" /></div>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2 items-baseline"><span className="shrink-0">Согласовал (тех.надзор):</span><div className="flex-1 border-b border-slate-300" /></div>
        </div>
      </div>
    </div>
  );
}
