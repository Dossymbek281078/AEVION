"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type ApplicationLabel } from "@/lib/build/api";

type Item = Awaited<ReturnType<typeof buildApi.myPipeline>>["items"][number];

const COLUMNS: {
  key: ApplicationLabel | "UNLABELED";
  title: string;
  emoji: string;
  tone: string;
}[] = [
  { key: "TOP_PICK", title: "Top picks", emoji: "⭐", tone: "border-fuchsia-400/40 bg-fuchsia-500/[0.06]" },
  { key: "SHORTLIST", title: "Shortlist", emoji: "📋", tone: "border-emerald-400/40 bg-emerald-500/[0.06]" },
  { key: "INTERVIEW", title: "Interview", emoji: "💬", tone: "border-sky-400/40 bg-sky-500/[0.06]" },
  { key: "OFFER", title: "Offer sent", emoji: "📝", tone: "border-amber-300/50 bg-amber-300/[0.08]" },
  { key: "HOLD", title: "On hold", emoji: "⏸", tone: "border-slate-400/30 bg-slate-500/[0.06]" },
  { key: "UNLABELED", title: "Inbox", emoji: "📥", tone: "border-white/10 bg-white/[0.02]" },
];

export default function PipelinePage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .myPipeline()
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<ApplicationLabel | "UNLABELED", Item[]>();
    for (const c of COLUMNS) m.set(c.key, []);
    for (const it of items ?? []) {
      const key: ApplicationLabel | "UNLABELED" = it.labelKey ?? "UNLABELED";
      const arr = m.get(key);
      if (arr) arr.push(it);
      else m.set("UNLABELED", [...(m.get("UNLABELED") ?? []), it]);
    }
    return m;
  }, [items]);

  const total = items?.length ?? 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-400">
            Все pending-кандидаты по этапам. Лейблы проставляются в review-режиме (клавиши 1–5).
            Карточка → review screen.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
            {total} pending total
          </span>
          <Link href="/build/dashboard" className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-300 hover:bg-white/10">
            ← Dashboard
          </Link>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {!items && !error && <p className="text-sm text-slate-400">Loading…</p>}

      {items && total === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          Нет pending-кандидатов. Когда появятся — отобразятся здесь по колонкам.
        </div>
      )}

      {items && total > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((c) => (
            <Column key={c.key} column={c} items={grouped.get(c.key) ?? []} />
          ))}
        </div>
      )}
    </>
  );
}

function Column({
  column,
  items,
}: {
  column: (typeof COLUMNS)[number];
  items: Item[];
}) {
  return (
    <div className={`rounded-xl border p-3 ${column.tone}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">
          {column.emoji} {column.title}
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-slate-400">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id}>
              <Card item={it} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ item }: { item: Item }) {
  return (
    <Link
      href={`/build/vacancy/${encodeURIComponent(item.vacancyId)}/review/${encodeURIComponent(item.id)}`}
      className="block rounded-md border border-white/10 bg-black/20 p-2 transition hover:border-emerald-400/40 hover:bg-emerald-400/10"
    >
      <div className="truncate text-xs font-semibold text-slate-100">
        {item.applicantName || "Anonymous"}
      </div>
      <div className="truncate text-[10px] text-slate-400">{item.vacancyTitle}</div>
      {item.matchScore != null && (
        <div className="mt-0.5 text-[10px] text-cyan-300">
          match {Math.round(item.matchScore)}%
        </div>
      )}
    </Link>
  );
}
