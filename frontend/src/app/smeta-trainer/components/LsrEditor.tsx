"use client";

import { useMemo, useState } from "react";
import type { Lsr, Rate, SmetaPosition } from "../lib/types";
import { calcLsr, formatKzt } from "../lib/calc";
import { runAiAdvisor } from "../lib/ai";
import { findObject } from "../lib/corpus";
import { RateSearch } from "./RateSearch";
import { PositionRow } from "./PositionRow";
import { AiPanel } from "./AiPanel";

interface Props {
  initialLsr: Lsr;
}

export function LsrEditor({ initialLsr }: Props) {
  const [lsr, setLsr] = useState<Lsr>(initialLsr);
  const [activeSectionId, setActiveSectionId] = useState<string>(initialLsr.sections[0]?.id ?? "");

  const learningObject = useMemo(() => findObject(lsr.objectId), [lsr.objectId]);
  const calc = useMemo(() => calcLsr(lsr), [lsr]);
  const notices = useMemo(
    () => (learningObject ? runAiAdvisor(lsr, learningObject) : []),
    [lsr, learningObject]
  );

  function addPosition(rate: Rate) {
    if (!activeSectionId) return;
    const newPos: SmetaPosition = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rateCode: rate.code,
      volume: 1,
      coefficients: [],
    };
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === activeSectionId ? { ...s, positions: [...s.positions, newPos] } : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function changePositionVolume(sectionId: string, positionId: string, volume: number) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              positions: s.positions.map((p) => (p.id === positionId ? { ...p, volume } : p)),
            }
          : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function removePosition(sectionId: string, positionId: string) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, positions: s.positions.filter((p) => p.id !== positionId) } : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Левая колонка — дерево + поиск расценок */}
      <div className="w-72 shrink-0 bg-slate-50 border-r border-slate-200 p-3 flex flex-col gap-3 overflow-auto">
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Объект</h3>
          <div className="bg-white border border-slate-200 rounded p-2 text-sm">
            <div className="font-medium text-slate-900">{learningObject?.title}</div>
            <div className="text-xs text-slate-600 mt-1">{learningObject?.type} · {learningObject?.region}</div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Разделы</h3>
          <div className="flex flex-col gap-1">
            {lsr.sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSectionId(s.id)}
                className={`text-left px-2 py-1.5 rounded text-sm ${
                  activeSectionId === s.id
                    ? "bg-emerald-100 text-emerald-900 font-medium"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {s.title}
                <span className="text-xs text-slate-500 ml-1">({s.positions.length})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Поиск расценок</h3>
          <RateSearch onPick={addPosition} />
        </div>
      </div>

      {/* Центр — таблица позиций активного раздела */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0">
          <div className="text-xs text-slate-500">{lsr.title}</div>
          <div className="text-base font-bold text-slate-900">
            {lsr.sections.find((s) => s.id === activeSectionId)?.title ?? "Выберите раздел"}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-300">Шифр</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-300">Наименование</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-300">Ед. изм.</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-700 border-b border-slate-300">Объём</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-700 border-b border-slate-300">ФОТ</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-700 border-b border-slate-300">ЭМ</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-700 border-b border-slate-300">Материалы</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-700 border-b border-slate-300">Прямые</th>
                <th className="px-2 py-2 border-b border-slate-300 w-8" />
              </tr>
            </thead>
            <tbody>
              {calc.sections
                .find((s) => s.section.id === activeSectionId)
                ?.positions.map((pCalc) => (
                  <PositionRow
                    key={pCalc.position.id}
                    calc={pCalc}
                    notices={notices.filter((n) => n.context.positionId === pCalc.position.id)}
                    onChangeVolume={(v) => changePositionVolume(activeSectionId, pCalc.position.id, v)}
                    onRemove={() => removePosition(activeSectionId, pCalc.position.id)}
                  />
                ))}
            </tbody>
          </table>

          {(calc.sections.find((s) => s.section.id === activeSectionId)?.positions.length ?? 0) === 0 && (
            <div className="text-center text-sm text-slate-500 py-12">
              Раздел пуст. Найдите расценку слева и добавьте позицию.
            </div>
          )}
        </div>

        {/* Итоги */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 shrink-0">
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Прямые затраты</div>
              <div className="font-mono font-semibold">{formatKzt(calc.sections.reduce((s, sc) => s + sc.direct, 0))}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">НР + СП</div>
              <div className="font-mono font-semibold">
                {formatKzt(calc.sections.reduce((s, sc) => s + sc.overhead + sc.profit, 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">НДС 12%</div>
              <div className="font-mono font-semibold">{formatKzt(calc.vat)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">ИТОГО</div>
              <div className="font-mono font-bold text-base text-emerald-700">{formatKzt(calc.totalWithVat)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Правая колонка — AI-советник */}
      <AiPanel notices={notices} />
    </div>
  );
}
