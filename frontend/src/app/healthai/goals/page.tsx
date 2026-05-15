"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LS_KEY = "aevion:healthai:goals";
const today = new Date().toISOString().slice(0, 10);

interface Goal {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: string;
  custom?: boolean;
}

const DEFAULT_GOALS: Goal[] = [
  { id: "sleep", title: "Сон 7-9 часов", description: "Достаточный сон — основа здоровья", icon: "😴", target: "7–9 ч/ночь" },
  { id: "exercise", title: "150 мин активности", description: "Кардио или силовая нагрузка в неделю (WHO)", icon: "🏃", target: "150 мин/неделю" },
  { id: "water", title: "2 литра воды", description: "Достаточная гидратация ежедневно", icon: "💧", target: "2 л/день" },
  { id: "mood", title: "Настроение 7+/10", description: "Ежедневная оценка эмоционального состояния", icon: "😊", target: "≥ 7/10" },
  { id: "veggies", title: "Овощи 400г", description: "Норма ВОЗ по употреблению овощей и фруктов", icon: "🥗", target: "400 г/день" },
];

function loadState(): Record<string, Record<string, boolean>> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}

function saveState(s: Record<string, Record<string, boolean>>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /**/ }
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [state, setState] = useState<Record<string, Record<string, boolean>>>({});
  const [addMode, setAddMode] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");

  useEffect(() => { setState(loadState()); }, []);

  function toggle(goalId: string) {
    setState((prev) => {
      const next = { ...prev, [today]: { ...(prev[today] ?? {}), [goalId]: !prev[today]?.[goalId] } };
      saveState(next);
      return next;
    });
  }

  function addGoal() {
    if (!newTitle.trim()) return;
    const g: Goal = { id: `custom-${Date.now()}`, title: newTitle.trim(), description: "", icon: "⭐", target: newTarget.trim() || "ежедневно", custom: true };
    setGoals((prev) => [...prev, g]);
    setNewTitle(""); setNewTarget(""); setAddMode(false);
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((d) => { delete next[d][id]; });
      saveState(next);
      return next;
    });
  }

  // Weekly completion
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const totalChecks = weekDays.reduce((sum, d) => sum + Object.values(state[d] ?? {}).filter(Boolean).length, 0);
  const maxChecks = weekDays.length * goals.length;
  const weekPct = maxChecks > 0 ? Math.round((totalChecks / maxChecks) * 100) : 0;

  const todayDone = goals.filter((g) => state[today]?.[g.id]).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/healthai" className="text-slate-400 hover:text-white text-sm">← HealthAI</Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">Цели здоровья</span>
        </div>
        <button onClick={() => setAddMode(true)} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-semibold transition-colors">
          + Добавить цель
        </button>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Weekly progress */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Прогресс за неделю</h2>
            <span className="text-2xl font-black" style={{ color: weekPct >= 70 ? "#10b981" : weekPct >= 40 ? "#f59e0b" : "#ef4444" }}>
              {weekPct}%
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
            <div className="h-full transition-all duration-700 rounded-full"
              style={{ width: `${weekPct}%`, background: weekPct >= 70 ? "#10b981" : weekPct >= 40 ? "#f59e0b" : "#ef4444" }} />
          </div>
          <div className="flex gap-1">
            {weekDays.map((d) => {
              const done = goals.filter((g) => state[d]?.[g.id]).length;
              const all = done === goals.length;
              const some = done > 0;
              return (
                <div key={d} className="flex-1 text-center">
                  <div className={`h-6 rounded-md ${all ? "bg-emerald-600" : some ? "bg-amber-600/60" : "bg-slate-800"}`} />
                  <p className="text-[9px] text-slate-600 mt-0.5">
                    {new Date(d + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "short" })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Сегодня</h2>
            <span className="text-xs text-slate-500">{todayDone}/{goals.length} выполнено</span>
          </div>
          <div className="space-y-2">
            {goals.map((g) => {
              const done = !!state[today]?.[g.id];
              return (
                <div key={g.id} className={`flex items-center gap-3 bg-slate-900 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${done ? "border-emerald-700/50" : "border-slate-800 hover:border-slate-700"}`}
                  onClick={() => toggle(g.id)}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}>
                    {done && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-lg">{g.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${done ? "line-through text-slate-500" : "text-white"}`}>{g.title}</p>
                    <p className="text-xs text-slate-500">{g.target}</p>
                  </div>
                  {g.custom && (
                    <button onClick={(e) => { e.stopPropagation(); removeGoal(g.id); }}
                      className="text-slate-600 hover:text-red-400 text-xs transition-colors">✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add goal form */}
        {addMode && (
          <div className="bg-slate-900 border border-violet-700/40 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold">Новая цель</h3>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Название цели"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <input type="text" value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Норма (например: 30 мин/день)"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <div className="flex gap-2">
              <button onClick={addGoal} disabled={!newTitle.trim()}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl text-sm font-bold transition-colors">
                Добавить
              </button>
              <button onClick={() => setAddMode(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-600 text-center">
          Прогресс хранится локально в браузере
        </p>
      </div>
    </div>
  );
}
