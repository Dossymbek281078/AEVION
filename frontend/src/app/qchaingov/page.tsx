"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import { apiUrl } from "@/lib/apiBase";
import ModulePricingChip from "@/components/ModulePricingChip";

type StatusPayload = {
  module: string;
  status: string;
  conceptMessagesCount: number;
};

type Stats = {
  total_proposals: number;
  open_proposals: number;
  closed_proposals: number;
  total_votes: number;
  unique_voters: number;
};

type Proposal = {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: "draft" | "open" | "closed" | "executed" | string;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-800 border-slate-600 text-slate-300",
  open: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300",
  closed: "bg-amber-500/15 border-amber-500/50 text-amber-300",
  executed: "bg-sky-500/15 border-sky-500/50 text-sky-300",
};

const FEATURES = [
  { t: "Identity-bound", d: "Голоса привязаны к AEVION Auth identity. Без анонимных botnet-роёв." },
  { t: "Открытые инициативы", d: "Любой создаёт предложение. Threshold-фильтр от спама без gatekeeper-цензуры." },
  { t: "QSign-цепочка", d: "Под каждым голосом — QSign-подпись. Откатить решение задним числом нельзя." },
  // Здесь обещались «Quadratic voting + delegate-trees». В бэкенде их нет:
  // `VOTE_MODES` (routes/qchaingov.ts) — это "yes-no-abstain",
  // "ranked-choice" и "weighted". Июльская правка убрала это обещание из
  // метаданных, но карточку на самой странице не тронула — то есть человек
  // читал про несуществующий режим ровно там, где смотрит.
  { t: "Три режима голосования", d: "Да/нет/воздержался, ранжированный выбор и взвешенный: голос можно распределить между вариантами." },
];

export default function QChainGovLanding() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/qchaingov/status"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStatus(d);
      })
      .catch(() => {});
    fetch(apiUrl("/api/qchaingov/stats"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStats(d);
      })
      .catch(() => {});
    fetch(apiUrl("/api/qchaingov/proposals?limit=5"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setProposals(Array.isArray(d.proposals) ? d.proposals : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950/30 to-slate-950 text-slate-100">
      <header
        // Полоса раздела прилипает ПОД шапкой сайта: у шапки тоже sticky
        // top:0, но слой 50 против 30 — при прокрученной странице она
        // закрывала кнопку «Купить» и строку цены. Замер прода 28.08.2026.
        style={{ top: "var(--aevion-header-h, 0px)" }}
        className="border-b border-slate-800/60 px-5 py-3 backdrop-blur sticky top-0 z-30 bg-slate-950/60">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← AEVION</Link>
          <div className="flex items-center gap-3">
            <ModulePricingChip moduleId="qchaingov" theme="dark" />
            <div className="text-xs font-mono tracking-[0.2em] text-sky-300">QCHAINGOV</div>
          </div>
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

      {/* Live governance — real stats + recent proposals from the chain */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">Live governance</h2>
          <Link href="/qchaingov/proposals" className="text-xs text-slate-400 hover:text-white">all proposals →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <StatCard label="Proposals" value={stats?.total_proposals} />
          <StatCard label="Open" value={stats?.open_proposals} accent="emerald" />
          <StatCard label="Closed" value={stats?.closed_proposals} accent="amber" />
          <StatCard label="Votes" value={stats?.total_votes} />
          <StatCard label="Voters" value={stats?.unique_voters} />
        </div>
        {proposals === null ? (
          <div className="text-sm text-slate-500">Загружаем последние инициативы…</div>
        ) : proposals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-400">
            Пока нет инициатив.{" "}
            <Link href="/qchaingov/new" className="text-sky-300 hover:underline">Создай первую →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {proposals.map((p) => (
              <Link
                key={p.id}
                href={`/qchaingov/proposals/${p.id}`}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-sky-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-semibold text-slate-100 text-sm leading-snug">{p.title}</div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}>
                    {p.status}
                  </span>
                </div>
                {p.summary && <div className="text-xs text-slate-400 line-clamp-2 mb-2">{p.summary}</div>}
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">{p.category}</span>
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
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

function StatCard({ label, value, accent }: { label: string; value: number | undefined; accent?: "emerald" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : "text-sky-300";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-center">
      <div className={`text-xl font-bold ${color}`}>{value ?? "…"}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
