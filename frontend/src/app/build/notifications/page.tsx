"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { Skeleton } from "@/components/build/Skeleton";

type NotifItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  at: string;
};

const KIND_ICON: Record<string, string> = {
  message: "💬",
  accepted: "✅",
  rejected: "❌",
  pending: "📋",
};

export default function NotificationsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await buildApi.notifications();
      setItems(r.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    setMarking(true);
    try {
      await buildApi.markNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    } finally {
      setMarking(false);
    }
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unread > 0 && (
            <p className="mt-1 text-sm text-slate-400">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {marking ? "…" : "Mark all read"}
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <Skeleton width="55%" height={13} />
              <Skeleton width="90%" height={11} className="mt-2" />
              <Skeleton width="20%" height={10} className="mt-2" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <div className="text-4xl">🔔</div>
          <p className="mt-3 text-sm text-slate-400">All caught up. Nothing new.</p>
          <Link
            href="/build"
            className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
          >
            ← Back to projects
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              href={n.href}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 transition ${
                n.read
                  ? "border-white/5 bg-white/[0.02] hover:bg-white/5"
                  : "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
              }`}
            >
              <span className="mt-0.5 text-xl leading-none" aria-hidden>
                {KIND_ICON[n.kind] ?? "🔔"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm font-semibold ${n.read ? "text-slate-300" : "text-white"}`}>
                    {n.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {new Date(n.at).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p>
              </div>
              {!n.read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
