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
          className="flex-1 rounded-lg border border-[#d4d3cc] bg-white px-3 py-2 text-sm text-[#17181a] placeholder:text-[#9a9c9f] focus:border-[#0a7d72] focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-md border border-[#d4d3cc] bg-white px-2.5 py-2 text-xs text-[#45474c] hover:bg-[#efeee8]"
          >
            ✕
          </button>
        )}
      </div>
      {q && (
        <p className="mt-2 text-[11px] text-[#9a9c9f]">
          {totalShown === 0
            ? "Ничего не найдено. Попробуйте более общий запрос."
            : `${totalShown} match${totalShown === 1 ? "" : "es"}`}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#workers"
          className="rounded-full border border-[#0a7d72]/30 bg-[#0a7d72]/10 px-4 py-1.5 text-sm font-semibold text-[#075b53] hover:bg-[#0a7d72]/20"
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
          <h2 className="mb-5 text-xl font-bold text-[#17181a]">🔨 Для соискателей</h2>
          <FaqList items={filteredWorkers} highlight={q} />
        </section>
      )}

      {filteredEmployers.length > 0 && (
        <section className="mt-10" id="employers">
          <h2 className="mb-5 text-xl font-bold text-[#17181a]">🏗 Для работодателей</h2>
          <FaqList items={filteredEmployers} highlight={q} />
        </section>
      )}

      <div className="mt-12 rounded-xl border border-[#d4d3cc] bg-[#fffefb] p-6 text-center">
        <p className="text-sm text-[#45474c]">Не нашли ответ?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link
            href="/build/messages"
            className="rounded-lg bg-[#0a7d72] px-4 py-2 text-sm font-semibold text-white hover:bg-[#075b53]"
          >
            Написать в чат
          </Link>
          <Link
            href="/build/coach"
            className="rounded-lg border border-[#d4d3cc] px-4 py-2 text-sm font-semibold text-[#17181a] hover:bg-[#efeee8]"
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
          className="group rounded-xl border border-[#d4d3cc] bg-[#fffefb] px-5 py-4"
        >
          <summary className="cursor-pointer list-none font-semibold text-[#17181a] marker:hidden">
            <span className="mr-2 inline-block text-[#0a7d72] transition group-open:rotate-90">
              ›
            </span>
            {item.q}
          </summary>
          <p className="mt-3 pl-5 text-sm leading-relaxed text-[#45474c]">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
