"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://api.aevion.app");

const LS_PROFILE = "aevion:healthai:profileId";

type FlowLevel = "spotting" | "light" | "medium" | "heavy";

interface CycleEntry {
  id: string;
  profileId: string;
  date: string;
  flow?: FlowLevel;
  symptoms: string[];
  notes?: string;
}

interface CycleData {
  entries: CycleEntry[];
  lastPeriodStart: string | null;
  avgCycleLength: number | null;
  predictedNextStart: string | null;
  predictedOvulation: string | null;
}

const FLOW: Record<FlowLevel, string> = {
  spotting: "Мажущие", light: "Слабые", medium: "Средние", heavy: "Обильные",
};

const SYMPTOMS = [
  "Боль в животе", "Боль в спине", "Головная боль", "Усталость",
  "Вздутие", "Перепады настроения", "Тошнота", "Болезненность груди",
];

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d + "T00:00:00Z").getTime() - Date.now()) / 86400000);
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function CyclePage() {
  const [data, setData] = useState<CycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pid, setPid] = useState<string | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [flow, setFlow] = useState<FlowLevel | "">("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load(id: string) {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/cycle/${encodeURIComponent(id)}`);
      if (!r.ok) return;
      const d: CycleData = await r.json();
      setData(d);
      const todayEntry = d.entries?.find((e) => e.date === today);
      if (todayEntry) {
        setFlow(todayEntry.flow ?? "");
        setSymptoms(todayEntry.symptoms ?? []);
        setNotes(todayEntry.notes ?? "");
        setSaved(true);
      }
    } catch { /**/ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const p = localStorage.getItem(LS_PROFILE);
    if (!p) { setNoProfile(true); setLoading(false); return; }
    setPid(p); load(p);
  }, []);

  async function save() {
    if (!pid) return;
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/healthai/cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: pid, date: today, flow: flow || undefined, symptoms, notes: notes || undefined }),
      });
      if (r.ok) { setSaved(true); load(pid); }
    } catch { /**/ }
    finally { setSaving(false); }
  }

  if (noProfile) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">🌸</div>
        <h1 className="text-xl font-bold mb-2">Создайте профиль HealthAI</h1>
        <p className="text-slate-400 text-sm mb-4">Трекер цикла требует профиль</p>
        <Link href="/healthai" className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-semibold text-sm transition-colors">→ Создать профиль</Link>
      </div>
    </div>
  );

  const dNext = daysUntil(data?.predictedNextStart ?? null);
  const dOv   = daysUntil(data?.predictedOvulation ?? null);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/healthai" className="text-slate-400 hover:text-white text-sm">← HealthAI</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Трекер цикла</span>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Predictions */}
        {!loading && data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Следующий период</p>
              <p className="text-base font-black text-white">{fmt(data.predictedNextStart)}</p>
              {dNext != null && <p className={`text-xs mt-0.5 ${dNext <= 3 ? "text-rose-400" : "text-slate-400"}`}>
                {dNext > 0 ? `через ${dNext} дн.` : "сегодня"}
              </p>}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Овуляция</p>
              <p className="text-base font-black text-white">{fmt(data.predictedOvulation)}</p>
              {dOv != null && <p className="text-xs text-slate-400 mt-0.5">{dOv > 0 ? `через ${dOv} дн.` : "сегодня"}</p>}
            </div>
            {data.avgCycleLength && (
              <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-slate-500">Средняя длина цикла</span>
                <span className="text-sm font-bold text-white">{data.avgCycleLength} дн.</span>
              </div>
            )}
          </div>
        )}

        {/* Today's log */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">Сегодня</h2>
            <span className="text-xs text-slate-500">{new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Интенсивность</p>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(FLOW) as FlowLevel[]).map((f) => (
                <button key={f} onClick={() => { setFlow(f === flow ? "" : f); setSaved(false); }}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    flow === f ? "bg-rose-900/50 border-rose-700/60 text-rose-200" : "bg-slate-800 border-slate-700 text-slate-500"
                  }`}
                >
                  {FLOW[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Симптомы</p>
            <div className="flex gap-1.5 flex-wrap">
              {SYMPTOMS.map((s) => (
                <button key={s} onClick={() => { setSaved(false); setSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    symptoms.includes(s) ? "bg-violet-600 border-violet-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <textarea rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            placeholder="Заметки..." className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none mb-3"
          />

          <button onClick={save} disabled={saving || (!flow && symptoms.length === 0 && !notes)}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 ${
              saved ? "bg-emerald-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"
            }`}
          >
            {saving ? "…" : saved ? "✓ Сохранено" : "Сохранить запись"}
          </button>
        </div>

        {/* History */}
        {data && data.entries.length > 0 && (
          <div>
            <h2 className="text-xs font-bold mb-3 text-slate-400 uppercase tracking-wider">История</h2>
            <div className="space-y-2">
              {[...data.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-slate-300 w-24 shrink-0">{new Date(e.date + "T00:00:00Z").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                  {e.flow && <span className="text-xs text-rose-300">{FLOW[e.flow]}</span>}
                  {e.symptoms.length > 0 && <span className="text-xs text-slate-500 truncate flex-1">{e.symptoms.slice(0, 2).join(", ")}{e.symptoms.length > 2 ? ` +${e.symptoms.length - 2}` : ""}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-600 text-center">Не является медицинской консультацией.</p>
      </div>
    </div>
  );
}
