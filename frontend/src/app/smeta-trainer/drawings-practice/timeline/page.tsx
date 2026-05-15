"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * Гантт-планировщик сроков строительства.
 * Студент вводит этапы, длительности, зависимости — получает визуальный график,
 * сводку, критический путь и резервы. Никаких внешних библиотек.
 */

interface Stage {
  id: number;
  name: string;
  duration: number; // дни
  dependsOn: number[]; // список id-этапов
  category?: StageCategory;
}

type StageCategory = "earth" | "concrete" | "masonry" | "roof" | "finishing" | "utilities" | "other";

interface ComputedStage extends Stage {
  startOffset: number; // дней от начала проекта
  endOffset: number;
  startDate: Date;
  endDate: Date;
  isCritical: boolean;
  slack: number; // резерв в днях
}

const CATEGORY_COLORS: Record<StageCategory, { bg: string; bar: string; label: string }> = {
  earth:      { bg: "bg-amber-700",   bar: "#b45309", label: "Земляные" },
  concrete:   { bg: "bg-slate-500",   bar: "#64748b", label: "Бетон/монолит" },
  masonry:    { bg: "bg-yellow-600",  bar: "#ca8a04", label: "Кладка" },
  roof:       { bg: "bg-blue-600",    bar: "#2563eb", label: "Кровля" },
  finishing:  { bg: "bg-emerald-600", bar: "#059669", label: "Отделка" },
  utilities:  { bg: "bg-violet-600",  bar: "#7c3aed", label: "Инж. сети" },
  other:      { bg: "bg-zinc-500",    bar: "#71717a", label: "Прочее" },
};

function categorize(name: string): StageCategory {
  const n = name.toLowerCase();
  if (/(котлован|земл|траншея|выемк|обратн|засып)/.test(n)) return "earth";
  if (/(фундамент|бетон|монолит|каркас|плита|чаш)/.test(n)) return "concrete";
  if (/(кладк|стен|перегород|кирпич|газобетон)/.test(n)) return "masonry";
  if (/(кровл|кровел)/.test(n)) return "roof";
  if (/(отделк|штукат|окраск|шпатл|плитк|облицовк|раздевалк|окна|двери)/.test(n)) return "finishing";
  if (/(сети|инж|вент|водопров|канализ|тепл|электр|кабел|фильтр|гидроизол)/.test(n)) return "utilities";
  return "other";
}

// ─────────────────────────── ШАБЛОНЫ ───────────────────────────

interface Template {
  id: string;
  label: string;
  totalHint: string;
  stages: Stage[];
}

const TEMPLATES: Template[] = [
  {
    id: "school",
    label: "Школа №47",
    totalHint: "≈270 дней",
    stages: [
      { id: 1, name: "Котлован",         duration: 14, dependsOn: [] },
      { id: 2, name: "Фундамент",        duration: 21, dependsOn: [1] },
      { id: 3, name: "Каркас",           duration: 45, dependsOn: [2] },
      { id: 4, name: "Кладка стен",      duration: 35, dependsOn: [3] },
      { id: 5, name: "Кровля",           duration: 14, dependsOn: [4] },
      { id: 6, name: "Окна и двери",     duration: 10, dependsOn: [4] },
      { id: 7, name: "Инж. сети",        duration: 40, dependsOn: [4] },
      { id: 8, name: "Отделка",          duration: 60, dependsOn: [5, 6, 7] },
      { id: 9, name: "Сдача",            duration: 7,  dependsOn: [8] },
    ],
  },
  {
    id: "house9",
    label: "Жилой 9-этажный",
    totalHint: "≈480 дней",
    stages: [
      { id: 1, name: "Котлован паркинга",        duration: 21,  dependsOn: [] },
      { id: 2, name: "Фундаментная плита",       duration: 28,  dependsOn: [1] },
      { id: 3, name: "Монолитный каркас 9 эт.",  duration: 180, dependsOn: [2] },
      { id: 4, name: "Кладка стен поэтажно",     duration: 90,  dependsOn: [3] },
      { id: 5, name: "Кровля плоская",           duration: 14,  dependsOn: [3] },
      { id: 6, name: "Окна+двери",               duration: 30,  dependsOn: [4] },
      { id: 7, name: "Инж. сети",                duration: 60,  dependsOn: [5] },
      { id: 8, name: "Отделка квартир",          duration: 120, dependsOn: [6, 7] },
      { id: 9, name: "Сдача",                    duration: 14,  dependsOn: [8] },
    ],
  },
  {
    id: "pool",
    label: "Бассейн",
    totalHint: "≈360 дней",
    stages: [
      { id: 1,  name: "Котлован",                       duration: 14, dependsOn: [] },
      { id: 2,  name: "Чаша монолит B25 W8",            duration: 28, dependsOn: [1] },
      { id: 3,  name: "Гидроизоляция чаши 5 слоёв",     duration: 21, dependsOn: [2] },
      { id: 4,  name: "Облицовка чаши керамогранит",    duration: 28, dependsOn: [3] },
      { id: 5,  name: "Каркас здания",                  duration: 60, dependsOn: [1] },
      { id: 6,  name: "Кровля + ограждение",            duration: 21, dependsOn: [5] },
      { id: 7,  name: "Вентиляция влажная",             duration: 45, dependsOn: [5, 6] },
      { id: 8,  name: "Фильтровальная",                 duration: 60, dependsOn: [5] },
      { id: 9,  name: "Раздевалки + отделка",           duration: 90, dependsOn: [5, 7] },
      { id: 10, name: "Сдача",                          duration: 14, dependsOn: [4, 7, 8, 9] },
    ],
  },
];

const DEFAULT_STAGES: Stage[] = TEMPLATES[0].stages;

// ─────────────────────────── localStorage ───────────────────────────

const LS_KEY = "aevion-smeta-timeline-v1";

interface SavedState {
  startDate: string;
  stages: Stage[];
}

function loadSaved(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.startDate !== "string" || !Array.isArray(parsed.stages)) return null;
    return parsed as SavedState;
  } catch {
    return null;
  }
}

function saveState(state: SavedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// ─────────────────────────── Алгоритм ───────────────────────────

function topologicalCompute(
  stages: Stage[],
  projectStart: Date,
): { computed: ComputedStage[]; totalDays: number; criticalIds: Set<number>; cycle: boolean } {
  const byId = new Map<number, Stage>();
  stages.forEach(s => byId.set(s.id, s));

  // Topological order via Kahn
  const indeg = new Map<number, number>();
  const children = new Map<number, number[]>();
  stages.forEach(s => {
    indeg.set(s.id, 0);
    children.set(s.id, []);
  });
  stages.forEach(s => {
    s.dependsOn.forEach(d => {
      if (!byId.has(d)) return;
      indeg.set(s.id, (indeg.get(s.id) || 0) + 1);
      children.get(d)!.push(s.id);
    });
  });

  const queue: number[] = [];
  indeg.forEach((v, k) => { if (v === 0) queue.push(k); });
  const order: number[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    children.get(id)!.forEach(c => {
      indeg.set(c, (indeg.get(c) || 0) - 1);
      if ((indeg.get(c) || 0) === 0) queue.push(c);
    });
  }

  const cycle = order.length !== stages.length;

  const earlyStart = new Map<number, number>();
  const earlyEnd = new Map<number, number>();
  order.forEach(id => {
    const s = byId.get(id)!;
    let es = 0;
    s.dependsOn.forEach(d => {
      if (!byId.has(d)) return;
      const ee = earlyEnd.get(d) || 0;
      if (ee > es) es = ee;
    });
    earlyStart.set(id, es);
    earlyEnd.set(id, es + s.duration);
  });

  const totalDays = Math.max(0, ...Array.from(earlyEnd.values()));

  // Late start/end (forward CPM lite — обратный проход)
  const lateEnd = new Map<number, number>();
  const lateStart = new Map<number, number>();
  // init all to project total
  stages.forEach(s => {
    lateEnd.set(s.id, totalDays);
  });
  // process in reverse topo
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const s = byId.get(id)!;
    const ch = children.get(id)!;
    if (ch.length > 0) {
      let le = Infinity;
      ch.forEach(c => {
        const ls = lateStart.get(c);
        if (ls !== undefined && ls < le) le = ls;
      });
      if (le !== Infinity) lateEnd.set(id, le);
    }
    lateStart.set(id, (lateEnd.get(id) || totalDays) - s.duration);
  }

  const criticalIds = new Set<number>();
  const computed: ComputedStage[] = stages.map(s => {
    const es = earlyStart.get(s.id) || 0;
    const ee = earlyEnd.get(s.id) || s.duration;
    const slack = (lateStart.get(s.id) || 0) - es;
    const isCritical = !cycle && Math.abs(slack) < 0.0001 && s.duration > 0;
    if (isCritical) criticalIds.add(s.id);
    const startDate = addDays(projectStart, es);
    const endDate = addDays(projectStart, ee);
    return {
      ...s,
      category: s.category ?? categorize(s.name),
      startOffset: es,
      endOffset: ee,
      startDate,
      endDate,
      isCritical,
      slack,
    };
  });

  return { computed, totalDays, criticalIds, cycle };
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatMonthsDays(days: number): string {
  if (days <= 0) return "0 дней";
  const months = Math.floor(days / 30);
  const rest = days - months * 30;
  if (months === 0) return `${days} дней`;
  if (rest === 0) return `${months} мес`;
  return `${months} мес ${rest} дн`;
}

const MONTHS_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

// ─────────────────────────── UI ───────────────────────────

export default function TimelinePage() {
  const [startDate, setStartDate] = useState<string>("2026-01-15");
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage once
  useEffect(() => {
    const s = loadSaved();
    if (s) {
      setStartDate(s.startDate);
      setStages(s.stages);
    }
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    saveState({ startDate, stages });
  }, [startDate, stages, hydrated]);

  const projectStart = useMemo(() => {
    const d = new Date(startDate + "T00:00:00");
    return isNaN(d.getTime()) ? new Date() : d;
  }, [startDate]);

  const { computed, totalDays, criticalIds, cycle } = useMemo(
    () => topologicalCompute(stages, projectStart),
    [stages, projectStart],
  );

  const projectEnd = useMemo(() => addDays(projectStart, totalDays), [projectStart, totalDays]);

  // ─── Stage operations ───
  const updateStage = (id: number, patch: Partial<Stage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };
  const addStage = () => {
    const nextId = stages.length === 0 ? 1 : Math.max(...stages.map(s => s.id)) + 1;
    setStages(prev => [...prev, { id: nextId, name: "Новый этап", duration: 7, dependsOn: [] }]);
  };
  const removeStage = (id: number) => {
    setStages(prev => prev
      .filter(s => s.id !== id)
      .map(s => ({ ...s, dependsOn: s.dependsOn.filter(d => d !== id) })),
    );
  };
  const loadTemplate = (tpl: Template) => {
    setStages(tpl.stages.map(s => ({ ...s, dependsOn: [...s.dependsOn] })));
  };

  // ─── Months scale ───
  const monthsScale = useMemo(() => {
    if (totalDays <= 0) return [] as { label: string; offset: number; widthPct: number }[];
    const out: { label: string; offset: number; widthPct: number }[] = [];
    let cursor = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    while (true) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const offsetStart = Math.floor((cursor.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
      const offsetEnd = Math.floor((next.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
      const visStart = Math.max(offsetStart, 0);
      const visEnd = Math.min(offsetEnd, totalDays);
      if (visStart >= totalDays) break;
      const widthPct = ((visEnd - visStart) / totalDays) * 100;
      out.push({
        label: `${MONTHS_RU[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        offset: visStart,
        widthPct,
      });
      cursor = next;
      if (out.length > 60) break;
    }
    return out;
  }, [projectStart, totalDays]);

  // ─── Critical path summary text ───
  const criticalChain = useMemo(() => {
    if (cycle || criticalIds.size === 0) return [] as ComputedStage[];
    return computed
      .filter(s => s.isCritical)
      .sort((a, b) => a.startOffset - b.startOffset);
  }, [computed, criticalIds, cycle]);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleReset = () => {
    setStages(DEFAULT_STAGES.map(s => ({ ...s, dependsOn: [...s.dependsOn] })));
    setStartDate("2026-01-15");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6 sm:px-8">
      {/* ── Print styles ── */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .gantt-wrap { background: white !important; color: black !important; }
          .gantt-wrap * { color: black !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ── Header ── */}
      <div className="no-print max-w-7xl mx-auto mb-6 flex items-center justify-between">
        <Link
          href="/smeta-trainer/drawings-practice/hub"
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          ← К разделам
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Сбросить
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-sm rounded border border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
          >
            🖨 Сохранить как PDF
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">
          📅 Планировщик сроков (Гантт) — график строительных работ
        </h1>

        {/* ── Описание ── */}
        <div className="no-print mb-6 rounded-lg border border-blue-500 bg-blue-950/40 p-4 text-blue-100">
          <p className="font-semibold text-blue-200 mb-2">
            📅 Простой Гантт-планировщик
          </p>
          <p className="text-sm leading-relaxed mb-3">
            Введи этапы строительства, их длительность и зависимости — получишь визуальный график.
          </p>
          <p className="text-sm font-semibold text-blue-200">Используется для:</p>
          <ul className="text-sm list-disc list-inside text-blue-100/90 space-y-0.5">
            <li>Расчёта общего срока строительства</li>
            <li>Планирования закупки материалов</li>
            <li>Оценки рисков задержек</li>
            <li>Согласования с заказчиком</li>
          </ul>
        </div>

        {cycle && (
          <div className="no-print mb-4 rounded-lg border border-red-500 bg-red-950/50 p-3 text-red-200 text-sm">
            ⚠ Обнаружен цикл в зависимостях этапов — расчёт некорректен. Проверь поле «Зависит от».
          </div>
        )}

        {/* ── Форма ввода ── */}
        <div className="no-print mb-6 rounded-lg border border-blue-500/60 bg-zinc-900 p-4">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <label className="text-sm text-zinc-300">
              Дата начала проекта:&nbsp;
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="ml-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
              />
            </label>
          </div>

          <div className="font-semibold text-blue-200 mb-2">ЭТАПЫ:</div>
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/70 text-zinc-300">
                <tr>
                  <th className="px-2 py-1.5 text-left w-12">№</th>
                  <th className="px-2 py-1.5 text-left">Название</th>
                  <th className="px-2 py-1.5 text-center w-24">Дли-ть, д</th>
                  <th className="px-2 py-1.5 text-left w-40">Зависит от</th>
                  <th className="px-2 py-1.5 text-center w-20"></th>
                </tr>
              </thead>
              <tbody>
                {stages.map(s => (
                  <tr key={s.id} className="border-t border-zinc-800">
                    <td className="px-2 py-1 text-zinc-400">{s.id}</td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={s.name}
                        onChange={e => updateStage(s.id, { name: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="number"
                        min={1}
                        value={s.duration}
                        onChange={e => updateStage(s.id, { duration: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-center"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={s.dependsOn.join(",")}
                        onChange={e => {
                          const ids = e.target.value
                            .split(/[,\s]+/)
                            .map(x => parseInt(x.trim(), 10))
                            .filter(x => !isNaN(x) && x !== s.id);
                          updateStage(s.id, { dependsOn: ids });
                        }}
                        placeholder="—"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => removeStage(s.id)}
                        className="px-2 py-0.5 text-xs rounded border border-red-700 text-red-300 hover:bg-red-900/40"
                        title="Удалить этап"
                      >
                        −
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={addStage}
              className="px-3 py-1.5 text-sm rounded border border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
            >
              + Добавить этап
            </button>
            <span className="text-xs text-zinc-500">
              Зависит от: укажи номера через запятую (напр. <code>4,5</code>)
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
            <span className="text-sm text-zinc-400 mr-2">Шаблоны:</span>
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => loadTemplate(tpl)}
                className="px-3 py-1.5 text-sm rounded border border-blue-500/60 bg-blue-900/30 text-blue-100 hover:bg-blue-800/50"
                title={tpl.totalHint}
              >
                {tpl.label} <span className="text-blue-300/70 text-xs">({tpl.totalHint})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Print header ── */}
        <div className="print-only mb-4">
          <h2 className="text-xl font-bold">Гантт-график строительства</h2>
          <p className="text-sm">
            Начало: {formatDate(projectStart)} · Сдача: {formatDate(projectEnd)} ·
            Длительность: {totalDays} дней ({formatMonthsDays(totalDays)})
          </p>
        </div>

        {/* ── Гантт ── */}
        <div className="gantt-wrap mb-6 rounded-lg border border-blue-500/60 bg-zinc-900 p-4 overflow-x-auto">
          <div className="font-semibold text-blue-200 mb-3">Визуальный график</div>
          {totalDays === 0 ? (
            <p className="text-zinc-400 text-sm">Добавь этапы с длительностью &gt; 0 чтобы увидеть график.</p>
          ) : (
            <div className="min-w-[760px]">
              {/* months scale */}
              <div className="flex border-b border-zinc-700 text-xs text-zinc-400 ml-48">
                <div className="relative h-6 w-full">
                  {monthsScale.map((m, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-6 border-l border-zinc-700 px-1"
                      style={{
                        left: `${(m.offset / totalDays) * 100}%`,
                        width: `${m.widthPct}%`,
                      }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
              {/* rows */}
              <div className="mt-1">
                {computed.map(s => {
                  const cat = s.category || "other";
                  const color = CATEGORY_COLORS[cat];
                  const leftPct = totalDays > 0 ? (s.startOffset / totalDays) * 100 : 0;
                  const widthPct = totalDays > 0 ? Math.max(0.5, (s.duration / totalDays) * 100) : 0;
                  return (
                    <div key={s.id} className="flex items-center h-7 border-b border-zinc-800/60 text-xs">
                      <div className="w-48 pr-2 truncate text-zinc-200" title={s.name}>
                        <span className="text-zinc-500 mr-1">{s.id}.</span>
                        {s.name}
                      </div>
                      <div className="relative flex-1 h-7">
                        <div
                          className={`absolute top-1 h-5 rounded ${color.bg} ${s.isCritical ? "ring-2 ring-red-400" : ""}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: color.bar,
                          }}
                          title={`${s.name}: ${formatDate(s.startDate)} – ${formatDate(s.endDate)} (${s.duration} дн)`}
                        >
                          <span className="absolute inset-0 px-1 text-[10px] text-white/95 leading-5 truncate">
                            {s.duration} дн
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-300 ml-48">
                {Object.entries(CATEGORY_COLORS).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: v.bar }} />
                    {v.label}
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded ring-2 ring-red-400 bg-zinc-700" />
                  Критический путь
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Сводка ── */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-blue-500 bg-blue-950/40 p-4 text-blue-100">
            <div className="font-semibold text-blue-200 mb-2">ИТОГО:</div>
            <div className="text-sm space-y-1">
              <div>
                Общий срок: <span className="font-semibold">{totalDays} дней</span>
                <span className="text-blue-300/80"> ({formatMonthsDays(totalDays)})</span>
              </div>
              <div>Дата начала: <span className="font-mono">{formatDate(projectStart)}</span></div>
              <div>Дата сдачи: <span className="font-mono">{formatDate(projectEnd)}</span></div>
              <div className="pt-2 mt-2 border-t border-blue-900/60">
                Этапов: {stages.length}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-500 bg-blue-950/40 p-4 text-blue-100">
            <div className="font-semibold text-blue-200 mb-2">Критический путь:</div>
            {criticalChain.length === 0 ? (
              <div className="text-sm text-blue-300/80">— (нет данных или цикл)</div>
            ) : (
              <>
                <div className="text-sm leading-relaxed">
                  {criticalChain.map((s, i) => (
                    <span key={s.id}>
                      <span className="font-semibold">{s.name}</span>
                      {i < criticalChain.length - 1 && <span className="text-blue-400"> → </span>}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-sm">
                  Длина крит. пути: <span className="font-semibold">{totalDays} дней</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Резервы (slack) ── */}
        <div className="mb-6 rounded-lg border border-blue-500/60 bg-zinc-900 p-4">
          <div className="font-semibold text-blue-200 mb-2">Резервы по этапам:</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {computed.map(s => {
              const critical = s.isCritical;
              const tone = critical
                ? "text-red-300"
                : s.slack < 3
                  ? "text-amber-300"
                  : "text-emerald-300";
              return (
                <div
                  key={s.id}
                  className="flex justify-between items-baseline gap-2 border border-zinc-800 rounded px-2 py-1 bg-zinc-950/40"
                >
                  <span className="truncate text-zinc-200">{s.id}. {s.name}</span>
                  <span className={`font-mono text-xs ${tone}`}>
                    {critical ? "крит." : `+${s.slack} дн`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Резерв (slack) — насколько можно сдвинуть этап без задержки общего срока.
            Этапы с резервом 0 — критические (красная обводка на графике).
          </p>
        </div>

        {/* ── Фактоид ── */}
        <div className="no-print mb-10 rounded-lg border border-blue-500 bg-blue-950/40 p-4 text-blue-100">
          <div className="font-semibold text-blue-200 mb-2">💡 Фактоид</div>
          <p className="text-sm leading-relaxed">
            Реальные сроки на <span className="font-semibold text-blue-200">20–30%</span> длиннее
            расчётных из-за:
          </p>
          <ul className="text-sm list-disc list-inside text-blue-100/90 mt-1 space-y-0.5">
            <li>Простоев по погоде</li>
            <li>Задержек поставок материалов</li>
            <li>Несогласованности субподрядчиков</li>
            <li>Изменений проекта в процессе</li>
          </ul>
          <p className="text-sm mt-2">
            Закладывай резерв <span className="font-semibold text-blue-200">×1.20–1.30</span>
            &nbsp;от рассчитанных сроков. Для проекта {totalDays} дн — это
            &nbsp;<span className="font-mono">{Math.round(totalDays * 1.2)}</span>…
            <span className="font-mono">{Math.round(totalDays * 1.3)}</span> дн с запасом.
          </p>
        </div>
      </div>
    </div>
  );
}
