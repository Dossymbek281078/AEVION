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
          aria-label="Search FAQ" placeholder="Search FAQ — попробуйте 'verified', 'AEV', 'CSV'…"
          className="flex-1 rounded-lg border border-paper-rule bg-white px-3 py-2 text-sm text-paper-ink placeholder:text-paper-ink-faint-2 focus:border-paper-teal focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-md border border-paper-rule bg-white px-2.5 py-2 text-xs text-paper-ink-soft hover:bg-paper-2"
          >
            ✕
          </button>
        )}
      </div>
      {q && (
        <p className="mt-2 text-[11px] text-paper-ink-faint-2">
          {totalShown === 0
            ? "Ничего не найдено. Попробуйте более общий запрос."
            : `${totalShown} match${totalShown === 1 ? "" : "es"}`}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#workers"
          className="rounded-full border border-paper-teal/30 bg-paper-teal/10 px-4 py-1.5 text-sm font-semibold text-paper-teal-deep hover:bg-paper-teal/20"
        >
          For workers →
        </a>
        <a
          href="#employers"
          className="rounded-full border border-[#2b6ea6]/30 bg-[#2b6ea6]/10 px-4 py-1.5 text-sm font-semibold text-[#1f5480] hover:bg-[#2b6ea6]/20"
        >
          For employers →
        </a>
      </div>

      {filteredWorkers.length > 0 && (
        <section className="mt-10" id="workers">
          <h2 className="mb-5 text-xl font-bold text-paper-ink">🔨 Для соискателей</h2>
          <FaqList items={filteredWorkers} highlight={q} />
        </section>
      )}

      {filteredEmployers.length > 0 && (
        <section className="mt-10" id="employers">
          <h2 className="mb-5 text-xl font-bold text-paper-ink">🏗 Для работодателей</h2>
          <FaqList items={filteredEmployers} highlight={q} />
        </section>
      )}

      <div className="mt-12 rounded-xl border border-paper-rule bg-paper-card p-6 text-center">
        <p className="text-sm text-paper-ink-soft">Не нашли ответ?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link
            href="/build/messages"
            className="rounded-lg bg-paper-teal px-4 py-2 text-sm font-semibold text-white hover:bg-paper-teal-deep"
          >
            Написать в чат
          </Link>
          <Link
            href="/build/coach"
            className="rounded-lg border border-paper-rule px-4 py-2 text-sm font-semibold text-paper-ink hover:bg-paper-2"
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
          className="group rounded-xl border border-paper-rule bg-paper-card px-5 py-4"
        >
          <summary className="cursor-pointer list-none font-semibold text-paper-ink marker:hidden">
            <span className="mr-2 inline-block text-paper-teal transition group-open:rotate-90">
              ›
            </span>
            {item.q}
          </summary>
          <p className="mt-3 pl-5 text-sm leading-relaxed text-paper-ink-soft">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
