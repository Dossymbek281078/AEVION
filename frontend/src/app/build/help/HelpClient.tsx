"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type FaqItem = { q: string; a: string };

export function HelpClient({
  workers,
  employers,
}: {
  workers: FaqItem[];
  employers: FaqItem[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredWorkers = useMemo(
    () => (q ? workers.filter((it) => match(it, q)) : workers),
    [workers, q],
  );
  const filteredEmployers = useMemo(
    () => (q ? employers.filter((it) => match(it, q)) : employers),
    [employers, q],
  );
  const totalShown = filteredWorkers.length + filteredEmployers.length;

  return (
    <>
      <div className="mt-6 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FAQ — попробуйте 'verified', 'AEV', 'CSV'…"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-300 hover:bg-white/10"
          >
            ✕
          </button>
        )}
      </div>
      {q && (
        <p className="mt-2 text-[11px] text-slate-500">
          {totalShown === 0
            ? "Ничего не найдено. Попробуйте более общий запрос."
            : `${totalShown} match${totalShown === 1 ? "" : "es"}`}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#workers"
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20"
        >
          For workers →
        </a>
        <a
          href="#employers"
          className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
        >
          For employers →
        </a>
      </div>

      {filteredWorkers.length > 0 && (
        <section className="mt-10" id="workers">
          <h2 className="mb-5 text-xl font-bold text-white">🔨 Для соискателей</h2>
          <FaqList items={filteredWorkers} highlight={q} />
        </section>
      )}

      {filteredEmployers.length > 0 && (
        <section className="mt-10" id="employers">
          <h2 className="mb-5 text-xl font-bold text-white">🏗 Для работодателей</h2>
          <FaqList items={filteredEmployers} highlight={q} />
        </section>
      )}

      <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-slate-300">Не нашли ответ?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link
            href="/build/messages"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Написать в чат
          </Link>
          <Link
            href="/build/coach"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Ask AI Coach
          </Link>
        </div>
      </div>
    </>
  );
}

function match(item: FaqItem, q: string): boolean {
  return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
}

function FaqList({ items, highlight }: { items: FaqItem[]; highlight: string }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <details
          key={i}
          // Auto-open matching results so the user sees the answer immediately
          // without having to click each one open.
          open={highlight.length > 0}
          className="group rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4"
        >
          <summary className="cursor-pointer list-none font-semibold text-slate-200 marker:hidden">
            <span className="mr-2 inline-block text-emerald-300 transition group-open:rotate-90">
              ›
            </span>
            {item.q}
          </summary>
          <p className="mt-3 pl-5 text-sm leading-relaxed text-slate-400">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
