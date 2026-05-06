"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

type Item = Awaited<ReturnType<typeof buildApi.myInterviews>>["items"][number];

export default function CalendarPage() {
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
      .myInterviews()
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

  // Group items into 7 day-buckets relative to today.
  const groups = useMemo(() => {
    const out: { day: Date; items: Item[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      out.push({ day: new Date(today.getTime() + i * 86400_000), items: [] });
    }
    if (!items) return out;
    const cutoff = today.getTime();
    const horizon = today.getTime() + 7 * 86400_000;
    for (const it of items) {
      const t = new Date(it.updatedAt).getTime();
      if (t < cutoff || t >= horizon) continue;
      const dayIdx = Math.floor((t - cutoff) / 86400_000);
      out[dayIdx]?.items.push(it);
    }
    return out;
  }, [items]);

  const upcomingTotal = groups.reduce((s, g) => s + g.items.length, 0);
  const pastWeek = items
    ? items.filter((it) => {
        const t = new Date(it.updatedAt).getTime();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return t < today.getTime() && t >= today.getTime() - 7 * 86400_000;
      })
    : [];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Interview calendar</h1>
          <p className="mt-1 text-sm text-slate-400">
            Кандидаты с лейблом{" "}
            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-200">
              💬 Interview
            </span>{" "}
            в ваших вакансиях, сгруппированные по дню. Нажмите для перехода в review-режим.
          </p>
        </div>
        <Link
          href="/build/dashboard"
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
        >
          ← Dashboard
        </Link>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {!items && !error && <p className="text-sm text-slate-400">Loading…</p>}

      {items && upcomingTotal === 0 && pastWeek.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          <p>Нет кандидатов с лейблом «Interview».</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Проставьте лейбл в review-режиме клавишей «3», чтобы они появились здесь.
          </p>
        </div>
      )}

      {items && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Next 7 days · {upcomingTotal}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
            {groups.map((g) => (
              <DayColumn key={g.day.toISOString()} day={g.day} items={g.items} />
            ))}
          </div>

          {pastWeek.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Past 7 days · {pastWeek.length}
              </h2>
              <ul className="space-y-2">
                {pastWeek.map((it) => (
                  <li key={it.id}>
                    <ItemCard item={it} dim />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="mt-8 text-[11px] text-slate-500">
        Время лейблирования = последнее обновление заявки. Полноценный interview-scheduler
        придёт позже — пока используйте 📅 в чате для отправки слотов.
      </p>
    </>
  );
}

function DayColumn({ day, items }: { day: Date; items: Item[] }) {
  const isToday = (() => {
    const today = new Date();
    return (
      today.getFullYear() === day.getFullYear() &&
      today.getMonth() === day.getMonth() &&
      today.getDate() === day.getDate()
    );
  })();
  const dow = day.toLocaleDateString(undefined, { weekday: "short" });
  const dm = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        isToday
          ? "border-emerald-400/40 bg-emerald-400/5"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{dow}</div>
        <div className={isToday ? "font-semibold text-emerald-200" : "font-semibold text-slate-200"}>
          {dm}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-[10px] text-slate-600">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id}>
              <ItemCard item={it} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemCard({
  item,
  compact = false,
  dim = false,
}: {
  item: Item;
  compact?: boolean;
  dim?: boolean;
}) {
  return (
    <Link
      href={`/build/vacancy/${encodeURIComponent(item.vacancyId)}/review/${encodeURIComponent(item.id)}`}
      className={`block rounded-md border border-white/10 bg-black/20 p-2 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 ${
        dim ? "opacity-60" : ""
      }`}
    >
      <div className={`truncate font-semibold ${compact ? "text-[11px]" : "text-sm"} text-slate-100`}>
        {item.applicantName || "Anonymous"}
      </div>
      <div className={`truncate ${compact ? "text-[10px]" : "text-xs"} text-slate-400`}>
        {item.vacancyTitle}
      </div>
      {item.matchScore != null && (
        <div className="mt-0.5 text-[10px] text-cyan-300">
          match {Math.round(item.matchScore)}%
        </div>
      )}
    </Link>
  );
}
