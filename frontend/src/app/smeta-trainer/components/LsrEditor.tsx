"use client";

import { useMemo, useState } from "react";
import type { Lsr, LsrMeta, Rate, SmetaPosition, AppliedCoefficient } from "../lib/types";
import { calcLsr } from "../lib/calc";
import { runAiAdvisor } from "../lib/ai";
import { findObject } from "../lib/corpus";
import { useLocalSmeta } from "../lib/useLocalSmeta";
import { SectionNav } from "./SectionNav";
import { RateDrawer } from "./RateDrawer";
import { LsrFormHeader } from "./LsrFormHeader";
import { LsrFormTable } from "./LsrFormTable";
import { SsrView } from "./SsrView";
import { VorView } from "./VorView";
import { Ks2View } from "./Ks2View";
import { AiChat } from "./AiChat";
import { StickyTotals } from "./StickyTotals";
import { GeomHint } from "./GeomHint";
import { DefectActView } from "./DefectActView";
import { ExportButton } from "./ExportButton";

type Tab = "lsr" | "defect" | "vor" | "ssr" | "ks2" | "print";

const TABS: { key: Tab; label: string }[] = [
  { key: "defect", label: "📋 Дефектная вед." },
  { key: "lsr",   label: "ЛСР (Форма 4*)" },
  { key: "vor",   label: "ВОР" },
  { key: "ssr",   label: "НР + СП" },
  { key: "ks2",   label: "КС-2" },
  { key: "print", label: "🖨 Печать" },
];

interface Props {
  initialLsr: Lsr;
}

export function LsrEditor({ initialLsr }: Props) {
  const { lsr, setLsr, reset, hasSaved } = useLocalSmeta(initialLsr);
  const [activeTab, setActiveTab]           = useState<Tab>("lsr");
  const [activeSectionId, setActiveSectionId] = useState<string>(initialLsr.sections[0]?.id ?? "");
  const [drawerOpen, setDrawerOpen]         = useState(false);

  const learningObject = useMemo(() => findObject(lsr.objectId), [lsr.objectId]);
  const calc           = useMemo(() => calcLsr(lsr), [lsr]);
  const notices        = useMemo(
    () => (learningObject ? runAiAdvisor(lsr, learningObject) : []),
    [lsr, learningObject]
  );

  const activeSection = lsr.sections.find((s) => s.id === activeSectionId);

  // ── Мутации ────────────────────────────────────────────────────────────────

  function addPosition(rate: Rate) {
    const targetId = activeSectionId || lsr.sections[0]?.id;
    if (!targetId) return;
    const newPos: SmetaPosition = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rateCode: rate.code,
      volume: 1,
      coefficients: [],
    };
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === targetId ? { ...s, positions: [...s.positions, newPos] } : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function changeVolume(sectionId: string, posId: string, volume: number) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, positions: s.positions.map((p) => p.id === posId ? { ...p, volume } : p) }
          : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function removePosition(sectionId: string, posId: string) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, positions: s.positions.filter((p) => p.id !== posId) } : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateMeta(meta: LsrMeta) {
    setLsr((prev) => ({ ...prev, meta, updatedAt: new Date().toISOString() }));
  }

  function updateCoefs(sectionId: string, posId: string, coefs: AppliedCoefficient[]) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, positions: s.positions.map((p) => p.id === posId ? { ...p, coefficients: coefs } : p) }
          : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updatePosition(sectionId: string, posId: string, patch: Partial<SmetaPosition>) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, positions: s.positions.map((p) => p.id === posId ? { ...p, ...patch } : p) }
          : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function addBulkPositions(sectionId: string, positions: Omit<SmetaPosition, "id">[]) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, positions: [...s.positions, ...positions.map((p, i) => ({ ...p, id: `bulk-${Date.now()}-${i}` }))] }
          : s
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── Левая панель: разделы ─────────────────────────────── */}
      <SectionNav
        sections={calc.sections}
        activeSectionId={activeSectionId}
        onSelect={(id) => { setActiveSectionId(id); setActiveTab("lsr"); }}
        onAddRate={() => setDrawerOpen(true)}
      />

      {/* ── Центральная зона ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Табы + мета */}
        <div className="shrink-0 bg-white border-b border-slate-200 flex items-center gap-0 px-3">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-400 pr-1">
            <GeomHint object={learningObject} />
            <ExportButton lsr={lsr} calc={calc} onImport={(imported) => setLsr(imported)} />
            <span className={hasSaved ? "text-emerald-500" : "text-slate-300"} title={lsr.indexRegion + " · " + lsr.indexQuarter}>
              {hasSaved ? "💾" : "○"}
            </span>
            <button
              onClick={() => { if (confirm("Сбросить смету?")) reset(); }}
              className="hover:text-red-500 transition-colors"
              title="Сбросить"
            >✕</button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-auto">
          {activeTab === "lsr" && (
            <div className="p-4 space-y-4">
              <LsrFormHeader meta={lsr.meta ?? {}} calc={calc} onChange={updateMeta} />
              <LsrFormTable
                calc={calc}
                notices={notices}
                onChangeVolume={changeVolume}
                onRemove={removePosition}
                onUpdateCoefs={updateCoefs}
              />
            </div>
          )}
          {activeTab === "defect" && (
            <DefectActView lsr={lsr} onAddPositions={addBulkPositions} />
          )}
          {activeTab === "vor" && (
            <VorView lsr={lsr} object={learningObject} onUpdatePosition={updatePosition} />
          )}
          {activeTab === "ssr" && <SsrView calc={calc} />}
          {activeTab === "ks2" && <Ks2View calc={calc} />}
          {activeTab === "print" && (
            <div className="p-4 space-y-4">
              <div className="flex gap-2 items-center print:hidden">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
                >
                  Распечатать / Сохранить PDF
                </button>
                <span className="text-xs text-slate-400">Откроется диалог → «Сохранить как PDF»</span>
              </div>
              <LsrFormHeader meta={lsr.meta ?? {}} calc={calc} onChange={updateMeta} />
              <LsrFormTable calc={calc} notices={[]} onChangeVolume={() => {}} onRemove={() => {}} />
            </div>
          )}
        </div>

        {/* Sticky итоги */}
        <StickyTotals calc={calc} />
      </div>

      {/* ── Правая панель: AI-консультант ───────────────────── */}
      <AiChat notices={notices} lsr={lsr} calc={calc} />

      {/* ── Drawer поиска расценок ──────────────────────────── */}
      <RateDrawer
        open={drawerOpen}
        targetSection={activeSection?.title ?? ""}
        onClose={() => setDrawerOpen(false)}
        onPick={(rate) => { addPosition(rate); }}
      />
    </div>
  );
}
