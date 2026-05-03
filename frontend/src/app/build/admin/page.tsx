"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export default function AdminIndexPage() {
  return (
    <RequireAuth>
      <BuildShell>
        <Body />
      </BuildShell>
    </RequireAuth>
  );
}

function Body() {
  const user = useBuildAuth((s) => s.user);
  const token = useBuildAuth((s) => s.token);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof buildApi.adminStats>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") return;
    buildApi.adminStats().then(setStats).catch((e) => setError((e as Error).message));
  }, [token, user]);

  if (user && user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
        Only ADMIN accounts can view this page.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Admin · QBuild</h1>
        <p className="text-xs text-slate-400">
          Platform-wide metrics + ops shortcuts. ADMIN-only.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Users" value={stats?.users.total ?? "…"} />
        <Tile
          label="Leads"
          value={stats?.leads.total ?? "…"}
          sub={stats ? `+${stats.leads.last7d} за 7 дней` : ""}
        />
        <Tile
          label="PAID orders"
          value={stats?.paidOrders.count ?? "…"}
          sub={
            stats
              ? `${stats.paidOrders.totalAmount.toLocaleString("ru-RU")} ₽ оборот`
              : ""
          }
        />
        <Tile
          label="AEV cashback"
          value={stats ? `${stats.cashback.totalAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}` : "…"}
          sub={stats ? `${stats.cashback.claimedAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} CLAIMED` : ""}
          tone="emerald"
        />
      </div>

      <h2 className="pt-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Sections
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/build/admin/leads"
          title="Leads"
          body="Email captures from /build/why-aevion. Search, filter, CSV export."
        />
        <NavCard
          href="/build/stats"
          title="Public stats"
          body="Live numbers shown to non-admins. Use this when sharing the platform."
        />
        <NavCard
          href="/build/pricing"
          title="Pricing"
          body="Plans, loyalty tiers, AEV cashback. Marketing-facing."
        />
        <NavCard
          href="/build/admin/documents"
          title="🏅 Верификация документов"
          body="Проверка и подтверждение удостоверений работников (сварщик, электрик, медкомиссия и др.)"
        />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "emerald";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tone === "emerald" ? "text-emerald-300" : "text-white"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function NavCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-fuchsia-500/40 hover:bg-white/[0.05]"
    >
      <div className="font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
    </Link>
  );
}
