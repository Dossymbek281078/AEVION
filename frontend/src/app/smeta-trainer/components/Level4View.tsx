"use client";

import { useMemo, useState } from "react";
import { calcLsr, formatKzt } from "../lib/calc";
import { useProgress } from "../lib/useProgress";
import { getLessonsForLevel, levelLessonsCompletion } from "../lib/lessons";
import { LsrFormHeader } from "./LsrFormHeader";
import { LsrFormTable } from "./LsrFormTable";
import { SsrView } from "./SsrView";
import { LessonViewer } from "./LessonViewer";
import type { Lsr } from "../lib/types";

// 4 ЛСР для полного комплекта
const LSRS: Lsr[] = [
  {
    id: "l4-otdelka",
    title: "ЛСР 2-01 — Отделочные работы (крыло Б)",
    objectId: "school-47-wing-b",
    method: "базисно-индексный",
    indexQuarter: "2026-Q2",
    indexRegion: "Алматы",
    meta: { lsrNumber: "2-01", objectTitle: "Крыло Б — отделка", strojkaCode: "02-2026-ПВП 20", priceDate: "декабрь 2025 г.", author: "" },
    sections: [
      { id: "l4-s1", title: "Раздел 1. Демонтажные работы", category: "демонтажные", positions: [
        { id: "l4p1", rateCode: "ДЕМ-15-01-001", volume: 28.80, coefficients: [] },
        { id: "l4p2", rateCode: "ДЕМ-11-02-001", volume: 18.00, coefficients: [] },
      ]},
      { id: "l4-s2", title: "Раздел 2. Отделка стен", category: "отделочные", positions: [
        { id: "l4p3", rateCode: "ОТД-13-01-001", volume: 26.99, coefficients: [] },
        { id: "l4p4", rateCode: "ОТД-15-02-003", volume: 26.99, coefficients: [] },
        { id: "l4p5", rateCode: "ОТД-15-04-001", volume: 26.99, coefficients: [] },
      ]},
      { id: "l4-s3", title: "Раздел 3. Полы", category: "отделочные", positions: [
        { id: "l4p6", rateCode: "ОТД-11-02-001", volume: 18.00, coefficients: [] },
        { id: "l4p7", rateCode: "ОТД-11-04-002", volume: 15.60, coefficients: [] },
      ]},
    ],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "l4-krovlya",
    title: "ЛСР 4-01 — Кровельные работы",
    objectId: "school-47-wing-b",
    method: "базисно-индексный",
    indexQuarter: "2026-Q2",
    indexRegion: "Алматы",
    meta: { lsrNumber: "4-01", objectTitle: "Кровля — ремонт", strojkaCode: "02-2026-ПВП 20", priceDate: "декабрь 2025 г.", author: "" },
    sections: [
      { id: "l4k-s1", title: "Раздел 1. Кровельные работы", category: "кровельные", positions: [
        { id: "l4k1", rateCode: "КРВ-12-01-001", volume: 5.40, coefficients: [], formula: "5400 м² / 1000 (площадь здания)" },
        { id: "l4k2", rateCode: "КРВ-12-02-001", volume: 5.40, coefficients: [] },
        { id: "l4k3", rateCode: "КРВ-12-03-001", volume: 5.40, coefficients: [] },
      ]},
    ],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "l4-santeh",
    title: "ЛСР 5-01 — Сантехнические работы",
    objectId: "school-47-wing-b",
    method: "базисно-индексный",
    indexQuarter: "2026-Q2",
    indexRegion: "Алматы",
    meta: { lsrNumber: "5-01", objectTitle: "Сантехника — замена", strojkaCode: "02-2026-ПВП 20", priceDate: "декабрь 2025 г.", author: "" },
    sections: [
      { id: "l4sn-s1", title: "Раздел 1. Отопление", category: "сантехнические", positions: [
        { id: "l4sn1", rateCode: "СНТ-16-01-001", volume: 3.20, coefficients: [], formula: "320 м трубы отопления / 100" },
        { id: "l4sn2", rateCode: "СНТ-16-02-001", volume: 64, coefficients: [], formula: "32 кл × 2 радиатора" },
      ]},
      { id: "l4sn-s2", title: "Раздел 2. ХВС и санприборы", category: "сантехнические", positions: [
        { id: "l4sn3", rateCode: "СНТ-16-03-001", volume: 1.80, coefficients: [] },
        { id: "l4sn4", rateCode: "СНТ-16-04-001", volume: 12, coefficients: [], formula: "3 санузла × 4 унитаза" },
        { id: "l4sn5", rateCode: "СНТ-16-05-001", volume: 12, coefficients: [] },
      ]},
    ],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "l4-electro",
    title: "ЛСР 6-01 — Электромонтажные работы",
    objectId: "school-47-wing-b",
    method: "базисно-индексный",
    indexQuarter: "2026-Q2",
    indexRegion: "Алматы",
    meta: { lsrNumber: "6-01", objectTitle: "Электромонтаж", strojkaCode: "02-2026-ПВП 20", priceDate: "декабрь 2025 г.", author: "" },
    sections: [
      { id: "l4el-s1", title: "Раздел 1. Кабельные трассы", category: "электромонтажные", positions: [
        { id: "l4el1", rateCode: "ЭЛ-21-04-007", volume: 960, coefficients: [], formula: "32 кл × 30 м = 960 м" },
      ]},
      { id: "l4el-s2", title: "Раздел 2. Розетки, выключатели, светильники", category: "электромонтажные", positions: [
        { id: "l4el2", rateCode: "ЭЛ-21-02-001", volume: 96, coefficients: [] },
        { id: "l4el3", rateCode: "ЭЛ-21-06-001", volume: 64, coefficients: [] },
        { id: "l4el4", rateCode: "ЭЛ-21-03-001", volume: 64, coefficients: [] },
        { id: "l4el5", rateCode: "ЭЛ-21-05-001", volume: 4, coefficients: [], formula: "4 этажа × 1 щит" },
      ]},
    ],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
  },
];

// 12 глав ССР (упрощённые)
const SSR_CHAPTERS = [
  { num: 1, title: "Подготовка территории строительства", lsrId: null },
  { num: 2, title: "Основные объекты строительства", lsrIds: ["l4-otdelka", "l4-krovlya"] },
  { num: 5, title: "Объекты энергетического хозяйства", lsrIds: ["l4-electro"] },
  { num: 6, title: "Объекты транспортного хозяйства и связи", lsrId: null },
  { num: 7, title: "Наружные сети и сооружения ВК и теплоснабжения", lsrIds: ["l4-santeh"] },
  { num: 8, title: "Временные здания и сооружения (норматив 1.5%)", lsrId: null },
  { num: 9, title: "Прочие работы и затраты (зимние, вахта, 3%)", lsrId: null },
  { num: 12, title: "Проектно-изыскательские и авторский надзор", lsrId: null },
];

// Объект для группировки в Объектной смете (Форма 3)
const OBJECT_META = {
  code: "2-02",
  title: "Учебный корпус — крыло Б, СОШ №47",
  area: 1280, // м² общая площадь объекта (для показателя ед. стоимости)
};

export function Level4View() {
  const { setLevel } = useProgress();
  const [activeView, setActiveView] = useState<"ssr" | "theory" | "form3" | string>("ssr");
  const [lessonsTick, setLessonsTick] = useState(0);
  const lessonsCount = getLessonsForLevel(4).length;
  const lessonsCompletion = lessonsCount > 0 ? levelLessonsCompletion(4) : 0;
  void lessonsTick;

  const calcs = useMemo(
    () => Object.fromEntries(LSRS.map((l) => [l.id, calcLsr(l)])),
    []
  );

  const totalSmr = LSRS.reduce((s, l) => s + calcs[l.id].totalBeforeVat, 0);

  function handleZachet() {
    setLevel(4, { status: "done", completedAt: new Date().toISOString() });
    alert("Уровень 4 зачтён! Полный комплект ПСД.");
  }

  const activeLsr = LSRS.find((l) => l.id === activeView);
  const activeCalc = activeLsr ? calcs[activeLsr.id] : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Навигация по документам */}
      <aside className="w-64 shrink-0 bg-slate-800 text-white flex flex-col overflow-auto">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Уровень 4</div>
          <div className="text-sm font-bold mt-0.5">Проектировщик</div>
          <div className="text-xs text-slate-400 mt-1">Полный комплект сметной документации</div>
        </div>

        <div className="px-3 py-2 border-b border-slate-700">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Состав комплекта</div>
          <button
            onClick={() => setActiveView("ssr")}
            className={`w-full text-left text-xs px-2 py-1.5 rounded mb-1 ${activeView === "ssr" ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-700"}`}
          >
            📊 Сводный сметный расчёт (ССР)
          </button>
          <button
            onClick={() => setActiveView("form3")}
            className={`w-full text-left text-xs px-2 py-1.5 rounded mb-1 ${activeView === "form3" ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-700"}`}
          >
            📋 Объектная смета (Форма 3)
          </button>
          {lessonsCount > 0 && (
            <button
              onClick={() => setActiveView("theory")}
              className={`w-full text-left text-xs px-2 py-1.5 rounded mb-1 ${activeView === "theory" ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-700"}`}
            >
              📚 Теория уровня
              <span className="ml-1 text-[9px] opacity-70">({Math.round(lessonsCompletion * 100)}%)</span>
            </button>
          )}
          {LSRS.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveView(l.id)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded mb-0.5 ${activeView === l.id ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-700"}`}
            >
              📄 {l.meta?.lsrNumber} — {l.meta?.objectTitle}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 mt-auto border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-2">Общая стоимость СМР:</div>
          <div className="text-base font-bold text-emerald-400">{formatKzt(totalSmr)}</div>
          <button
            onClick={handleZachet}
            className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 mt-3"
          >
            Сдать на зачёт
          </button>
        </div>
      </aside>

      {/* Основная область */}
      <div className={`flex-1 ${activeView === "theory" ? "overflow-hidden" : "overflow-auto"}`}>
        {activeView === "theory" && (
          <div className="h-full" onClick={() => setLessonsTick((n) => n + 1)}>
            <LessonViewer level={4} />
          </div>
        )}
        {activeView === "ssr" && (
          <div className="p-4 max-w-4xl mx-auto space-y-4">
            <div className="border border-slate-300 bg-white">
              <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50 text-xs">
                <span className="text-slate-400">НДЦС РК 8.01-08-2022. Приложение Г.</span>
                <span className="font-semibold text-slate-600">Форма 1</span>
              </div>
              <div className="px-4 py-3">
                <div className="font-bold text-slate-800 text-sm">СВОДНЫЙ СМЕТНЫЙ РАСЧЁТ СТОИМОСТИ СТРОИТЕЛЬСТВА</div>
                <div className="text-xs text-slate-500">Капитальный ремонт СОШ №47, г. Алматы</div>
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 text-center w-8">Гл.</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 w-28">Номера смет</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600">Наименование</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-32">СМР, тыс.тнг.</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-32">Прочие, тыс.тнг.</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-32">Всего, тыс.тнг.</th>
                </tr>
              </thead>
              <tbody>
                {SSR_CHAPTERS.map((ch) => {
                  const chLsrIds = (ch as { lsrIds?: string[] }).lsrIds ?? [];
                  const chSmr = chLsrIds.reduce((s, id) => s + (calcs[id]?.totalBeforeVat ?? 0), 0);
                  const isNormative = ch.num === 8 || ch.num === 9 || ch.num === 12;
                  const normValue = isNormative ? totalSmr * (ch.num === 8 ? 0.015 : ch.num === 9 ? 0.03 : 0.025) : 0;

                  return (
                    <tr key={ch.num} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">{ch.num}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-mono text-[10px] text-slate-500">
                        {chLsrIds.join(", ")}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-800">
                        {ch.title}
                        {isNormative && <span className="text-slate-400 ml-1">(норматив)</span>}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-700">
                        {chSmr > 0 ? (chSmr / 1000).toFixed(3) : isNormative ? (normValue / 1000).toFixed(3) : "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-400">—</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono font-semibold text-slate-900">
                        {chSmr > 0 ? (chSmr / 1000).toFixed(3) : isNormative ? (normValue / 1000).toFixed(3) : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-emerald-50 font-bold">
                  <td className="border border-slate-300 px-2 py-2" />
                  <td className="border border-slate-300 px-2 py-2" />
                  <td className="border border-slate-300 px-2 py-2 text-slate-800">ИТОГО ПО ССР</td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-800">{(totalSmr / 1000).toFixed(3)}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right">—</td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-800">{(totalSmr * 1.067 / 1000).toFixed(3)}</td>
                </tr>
              </tbody>
            </table>

            <div className="text-xs text-slate-400 italic">
              * Главы 3, 4, 10, 11 не применимы для данного объекта (капремонт без внешних сетей и благоустройства). Главы 8, 9, 12 рассчитаны по нормативному проценту от суммы СМР.
            </div>
          </div>
        )}

        {activeView === "form3" && (
          <div className="p-4 max-w-5xl mx-auto space-y-4">
            <div className="border border-slate-300 bg-white">
              <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50 text-xs">
                <span className="text-slate-400">НДЦС РК 8.01-08-2022. Приложение Г.</span>
                <span className="font-semibold text-slate-600">Форма 3 — Объектная смета</span>
              </div>
              <div className="px-4 py-3">
                <div className="font-bold text-slate-800 text-sm uppercase">Объектная смета на строительство</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Объект <span className="font-mono text-slate-800">{OBJECT_META.code}</span> — {OBJECT_META.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Сметная стоимость объекта (по ЛСР, входящим в его состав)
                </div>
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 text-center w-10">№ п/п</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 w-24">Шифр<br />сметы</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600">Наименование работ и затрат</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">СМР, тыс.тнг</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">Оборуд., тыс.тнг</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">Прочие, тыс.тнг</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-28">Всего, тыс.тнг</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600 w-24">тенге/м²</th>
                </tr>
              </thead>
              <tbody>
                {LSRS.map((l, idx) => {
                  const c = calcs[l.id];
                  const smrTys = c.totalBeforeVat / 1000;
                  const equipTys = 0; // в учебном кейсе — без оборудования
                  const otherTys = 0;
                  const totalTys = smrTys + equipTys + otherTys;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-mono text-[10px] text-slate-700 text-center">
                        {l.meta?.lsrNumber}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-800">
                        {l.title.replace(/^ЛСР [\d-]+ — /, "")}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-700">{smrTys.toFixed(3)}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-400">—</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-400">—</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono font-semibold text-slate-900">{totalTys.toFixed(3)}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-[11px] text-slate-600">
                        {Math.round((c.totalBeforeVat / OBJECT_META.area))}
                      </td>
                    </tr>
                  );
                })}
                {(() => {
                  const totalSmrTys = totalSmr / 1000;
                  const totalAllTys = totalSmrTys;
                  return (
                    <>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2 text-slate-700">Итого по объекту (без НДС)</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono">{totalSmrTys.toFixed(3)}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-slate-400">—</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-slate-400">—</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono">{totalAllTys.toFixed(3)}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-[11px]">
                          {Math.round(totalSmr / OBJECT_META.area)}
                        </td>
                      </tr>
                      <tr className="bg-amber-50 text-slate-700">
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2 italic">в т.ч. НДС 12%</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-slate-500">{(totalSmrTys * 0.12).toFixed(3)}</td>
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-slate-500">{(totalAllTys * 0.12).toFixed(3)}</td>
                        <td className="border border-slate-300 px-2 py-2" />
                      </tr>
                      <tr className="bg-emerald-50 font-bold">
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2" />
                        <td className="border border-slate-300 px-2 py-2 text-slate-900">ВСЕГО ПО ОБЪЕКТУ (с НДС)</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-800">{(totalSmrTys * 1.12).toFixed(3)}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right text-slate-400">—</td>
                        <td className="border border-slate-300 px-2 py-2 text-right text-slate-400">—</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-800">{(totalAllTys * 1.12).toFixed(3)}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-700 text-[11px]">
                          {Math.round(totalSmr * 1.12 / OBJECT_META.area)}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-white border border-slate-200 rounded p-3">
                <div className="text-[10px] text-slate-500 uppercase">Площадь объекта</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{OBJECT_META.area} м²</div>
                <div className="text-[10px] text-slate-400">учебный показатель</div>
              </div>
              <div className="bg-white border border-slate-200 rounded p-3">
                <div className="text-[10px] text-slate-500 uppercase">Удельная стоимость СМР</div>
                <div className="text-sm font-bold text-emerald-700 mt-0.5">
                  {formatKzt(totalSmr / OBJECT_META.area)}/м²
                </div>
                <div className="text-[10px] text-slate-400">без НДС</div>
              </div>
              <div className="bg-white border border-slate-200 rounded p-3">
                <div className="text-[10px] text-slate-500 uppercase">Удельная стоимость всего</div>
                <div className="text-sm font-bold text-emerald-700 mt-0.5">
                  {formatKzt((totalSmr * 1.12) / OBJECT_META.area)}/м²
                </div>
                <div className="text-[10px] text-slate-400">с НДС</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 italic bg-slate-50 border border-slate-200 rounded p-3">
              <strong>Что показывает Форма 3.</strong> Объектная смета агрегирует все ЛСР, относящиеся
              к одному «объекту» (часть стройки — корпус, секция, этап). В Форме 3 видна стоимость
              объекта целиком в разрезе СМР / Оборудования / Прочих затрат, и ключевой показатель
              для согласования — удельная стоимость на единицу мощности (м², место, погонный метр).
              В реальном проекте — это страница 2 ПСД, после ССР.
            </div>
          </div>
        )}

        {activeLsr && activeCalc && (
          <div className="p-4 space-y-4">
            <LsrFormHeader meta={activeLsr.meta ?? {}} calc={activeCalc} onChange={() => {}} />
            <LsrFormTable calc={activeCalc} notices={[]} onChangeVolume={() => {}} onRemove={() => {}} />
            <SsrView calc={activeCalc} />
          </div>
        )}
      </div>
    </div>
  );
}
