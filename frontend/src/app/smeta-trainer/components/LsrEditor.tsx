"use client";

import { useMemo, useState } from "react";
import type { Lsr, LsrMeta, Rate, SmetaPosition } from "../lib/types";
import { calcLsr } from "../lib/calc";
import { runAiAdvisor } from "../lib/ai";
import { findObject } from "../lib/corpus";
import { RateSearch } from "./RateSearch";
import { AiPanel } from "./AiPanel";
import { LsrFormHeader } from "./LsrFormHeader";
import { LsrFormTable } from "./LsrFormTable";
import { SsrView } from "./SsrView";

type Tab = "lsr" | "ssr" | "print";

interface Props {
  initialLsr: Lsr;
}

export function LsrEditor({ initialLsr }: Props) {
  const [lsr, setLsr] = useState<Lsr>(initialLsr);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    initialLsr.sections[0]?.id ?? ""
  );
  const [activeTab, setActiveTab] = useState<Tab>("lsr");

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

  function changeVolume(sectionId: string, positionId: string, volume: number) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              positions: s.positions.map((p) =>
                p.id === positionId ? { ...p, volume } : p
              ),
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
        s.id === sectionId
          ? { ...s, positions: s.positions.filter((p) => p.id !== positionId) }
          : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateMeta(meta: LsrMeta) {
    setLsr((prev) => ({ ...prev, meta, updatedAt: new Date().toISOString() }));
  }

  const errorCount = notices.filter((n) => n.severity === "error").length;
  const warnCount = notices.filter((n) => n.severity === "warning").length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══ ЛЕВАЯ ПАНЕЛЬ ═══ */}
      <aside className="w-60 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
        {/* Объект */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Объект</div>
          <div className="text-xs font-semibold text-slate-800 leading-tight">
            {learningObject?.title ?? lsr.objectId}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {learningObject?.type} · {learningObject?.region}
          </div>
        </div>

        {/* Разделы */}
        <div className="px-3 pt-2 pb-1 border-b border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Разделы</div>
          <div className="flex flex-col gap-0.5">
            {lsr.sections.map((s) => {
              const sCalc = calc.sections.find((sc) => sc.section.id === s.id);
              const sNotices = notices.filter((n) => n.context.sectionId === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSectionId(s.id)}
                  className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    activeSectionId === s.id
                      ? "bg-emerald-100 text-emerald-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{s.title}</span>
                    {sNotices.length > 0 && (
                      <span className="text-red-500 text-[9px] ml-1">●</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {s.positions.length} поз.
                    {sCalc && sCalc.direct > 0 && (
                      <span className="ml-1 font-mono">
                        {(sCalc.direct / 1000).toFixed(0)}к ₸
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Поиск расценок */}
        <div className="flex-1 px-3 pt-2 overflow-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">
            Поиск расценок
          </div>
          <div className="text-[10px] text-slate-400 mb-1">
            → раздел: <span className="text-slate-600 font-medium">
              {lsr.sections.find((s) => s.id === activeSectionId)?.title ?? "—"}
            </span>
          </div>
          <RateSearch onPick={addPosition} />
        </div>

        {/* AI-счётчик */}
        {(errorCount > 0 || warnCount > 0) && (
          <div className="px-3 pb-3 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">AI советник</div>
            <div className="flex gap-2 text-xs">
              {errorCount > 0 && (
                <span className="text-red-600 font-semibold">{errorCount} ошиб.</span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-600 font-semibold">{warnCount} предупр.</span>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ═══ ЦЕНТРАЛЬНАЯ ОБЛАСТЬ ═══ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Табы */}
        <div className="shrink-0 border-b border-slate-200 bg-white flex items-center gap-0 px-4">
          {(
            [
              { key: "lsr" as Tab, label: "ЛСР (Форма 4*)" },
              { key: "ssr" as Tab, label: "НР + СП + НДС" },
              { key: "print" as Tab, label: "Печать" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto text-[10px] text-slate-400 pr-1">
            НДЦС РК 8.01-08-2022 · {lsr.indexRegion} · {lsr.indexQuarter}
          </div>
        </div>

        {/* Контент таба */}
        <div className="flex-1 overflow-auto">
          {activeTab === "lsr" && (
            <div className="p-4 space-y-4">
              <LsrFormHeader
                meta={lsr.meta ?? {}}
                calc={calc}
                onChange={updateMeta}
              />
              <LsrFormTable
                calc={calc}
                notices={notices}
                onChangeVolume={changeVolume}
                onRemove={removePosition}
              />
            </div>
          )}

          {activeTab === "ssr" && <SsrView calc={calc} />}

          {activeTab === "print" && (
            <div className="p-4 space-y-4">
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
                >
                  Распечатать / Сохранить PDF
                </button>
                <span className="text-xs text-slate-400">
                  Браузер откроет диалог печати. Выберите «Сохранить как PDF».
                </span>
              </div>
              {/* Версия для печати */}
              <div className="print:block">
                <LsrFormHeader
                  meta={lsr.meta ?? {}}
                  calc={calc}
                  onChange={updateMeta}
                />
                <div className="mt-4">
                  <LsrFormTable
                    calc={calc}
                    notices={[]}
                    onChangeVolume={() => {}}
                    onRemove={() => {}}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══ ПРАВАЯ ПАНЕЛЬ — AI ═══ */}
      <AiPanel notices={notices} />
    </div>
  );
}
