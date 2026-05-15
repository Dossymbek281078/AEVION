"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import { apiUrl } from "@/lib/apiBase";

type StatusPayload = {
  module: string;
  status: string;
  conceptMessagesCount: number;
};

const FEATURES = [
  { t: "Research-first", d: "Не product roadmap, а исследование границ концепции. Открытый whitepaper." },
  { t: "Energy-anchored", d: "Привязка к измеримым актам (объём работы / влияние), не к спекулятивному курсу." },
  { t: "Not anonymous", d: "Каждая единица аудируема через QSign. Опровергает гипотезу, что privacy = anonymity." },
  { t: "Параллельный слой", d: "Не replace AEV. Экспериментальный layer параллельно основному монетарному контуру." },
];

export default function ZTideLanding() {
  const [status, setStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/ztide/status"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStatus(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 px-5 py-3 backdrop-blur sticky top-0 z-30 bg-slate-950/60">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← AEVION</Link>
          <div className="text-xs font-mono tracking-[0.2em] text-violet-300">Z·TIDE</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
        <div className="inline-block rounded-full bg-violet-500/15 border border-violet-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-200 mb-5">
          Energy currency · Research
        </div>
        <h1 className="text-4xl sm:text-5xl font-light leading-tight tracking-tight mb-4">
          Currency, but{" "}
          <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent font-semibold">
            energy-anchored.
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl text-base sm:text-lg leading-relaxed mb-6">
          Концептуальная валюта, связанная с энергией / эмоциями / социальным вкладом.
          Research-проект: можно ли строить экономику, где «единица» — не trust количества,
          а энергозатраты + социальная польза.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          <span className="rounded-full bg-violet-500/15 border border-violet-500/40 px-2.5 py-1 text-violet-200">
            status: {status?.status ?? "…"}
          </span>
          <span className="rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-400">
            concept signals: {status?.conceptMessagesCount ?? "…"}
          </span>
          <span className="rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-400">
            /api/ztide
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.t}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur"
            >
              <div className="text-sm font-semibold text-violet-200 mb-1">{f.t}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <MvpConceptBoard
        moduleId="ztide"
        noun="concept/messages"
        accent="violet"
        sectionTitle="Concept board"
        sectionHint="Поделись идеей: какой вклад/действие должно повышать tide-score? Что должно его обнулять?"
        titleField="idea"
        summaryField="rationale"
        fields={[
          { key: "idea", label: "Идея / вклад", placeholder: "напр.: помощь open-source > 8h/нед", required: true },
          { key: "rationale", label: "Почему это считается вкладом", type: "textarea", placeholder: "Кому это полезно, как это измеряется" },
          { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
        ]}
      />

      <footer className="border-t border-slate-800/60 px-5 py-6 mt-8">
        <div className="mx-auto max-w-6xl text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>AEVION · Z-Tide · in_progress MVP</span>
          <span className="font-mono">/api/ztide/status</span>
        </div>
      </footer>
    </div>
  );
}
