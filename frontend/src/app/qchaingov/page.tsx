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
  { t: "Identity-bound", d: "Голоса привязаны к AEVION Auth identity. Без анонимных botnet-роёв." },
  { t: "Открытые инициативы", d: "Любой создаёт предложение. Threshold-фильтр от спама без gatekeeper-цензуры." },
  { t: "QSign-цепочка", d: "Под каждым голосом — QSign-подпись. Откатить решение задним числом нельзя." },
  { t: "Quadratic + delegate", d: "Quadratic voting + delegate-trees: концентрация капитала ≠ концентрация решений." },
];

export default function QChainGovLanding() {
  const [status, setStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/qchaingov/status"))
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950/30 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 px-5 py-3 backdrop-blur sticky top-0 z-30 bg-slate-950/60">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← AEVION</Link>
          <div className="text-xs font-mono tracking-[0.2em] text-sky-300">QCHAINGOV</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
        <div className="inline-block rounded-full bg-sky-500/15 border border-sky-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-sky-200 mb-5">
          DAO governance · Identity-bound
        </div>
        <h1 className="text-4xl sm:text-5xl font-light leading-tight tracking-tight mb-4">
          Governance that{" "}
          <span className="bg-gradient-to-r from-sky-300 to-cyan-300 bg-clip-text text-transparent font-semibold">
            survives a vote.
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl text-base sm:text-lg leading-relaxed mb-6">
          DAO-платформа народного управления: голосования, инициативы, прозрачные процессы.
          Поверх AEVION Auth + QSign — без обхода идентификации через одноразовые кошельки.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          <span className="rounded-full bg-sky-500/15 border border-sky-500/40 px-2.5 py-1 text-sky-200">
            status: {status?.status ?? "…"}
          </span>
          <span className="rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-400">
            citizen topics: {status?.conceptMessagesCount ?? "…"}
          </span>
          <span className="rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-400">
            /api/qchaingov
          </span>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            href="/qchaingov/proposals"
            className="rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2 text-sm font-semibold"
          >
            Active proposals →
          </Link>
          <Link
            href="/qchaingov/new"
            className="rounded-lg border border-slate-700 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Draft a proposal
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.t}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur"
            >
              <div className="text-sm font-semibold text-sky-200 mb-1">{f.t}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <MvpConceptBoard
        moduleId="qchaingov"
        noun="concept/messages"
        accent="sky"
        sectionTitle="Citizen topic board"
        sectionHint="Не готов оформлять полное предложение? Брось топик сюда — соберём в инициативу позже."
        titleField="topic"
        summaryField="motivation"
        fields={[
          { key: "topic", label: "Тема инициативы", placeholder: "напр.: прозрачная процедура отбора планетных судей", required: true },
          { key: "motivation", label: "Зачем это нужно", type: "textarea", placeholder: "Какая проблема решается, кого это касается" },
          { key: "category", label: "Категория", placeholder: "social / treasury / protocol / partnership / ..." },
        ]}
      />

      <footer className="border-t border-slate-800/60 px-5 py-6 mt-8">
        <div className="mx-auto max-w-6xl text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>AEVION · QChainGov · in_progress MVP</span>
          <span className="font-mono">/api/qchaingov/status</span>
        </div>
      </footer>
    </div>
  );
}
