"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type AdminStats = Awaited<ReturnType<typeof buildApi.adminStats>>;

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
  const [stats, setStats] = useState<AdminStats | null>(null);
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
        <p className="text-xs text-slate-400">Platform-wide metrics + ops shortcuts. ADMIN-only.</p>
      </header>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Users" value={stats?.users.total ?? "…"} sub={stats ? `+${(stats.users as {total:number;newLast7d?:number}).newLast7d ?? 0} за 7 дней` : ""} />
        <Tile label="Profiles" value={stats ? (stats as AdminStats & { profiles?: { total: number } }).profiles?.total ?? "…" : "…"} />
        <Tile label="Open vacancies" value={stats ? (stats as AdminStats & { vacancies?: { open: number } }).vacancies?.open ?? "…" : "…"} tone="emerald" />
        <Tile label="Pending apps" value={stats ? (stats as AdminStats & { applications?: { pending: number } }).applications?.pending ?? "…" : "…"} tone="amber" />
        <Tile label="Verify queue" value={stats ? (stats as AdminStats & { verificationPending?: number }).verificationPending ?? 0 : "…"} tone="amber" />
        <Tile
          label="Leads"
          value={stats?.leads.total ?? "…"}
          sub={stats ? `+${stats.leads.last7d} за 7 дней` : ""}
        />
        <Tile
          label="PAID orders"
          value={stats?.paidOrders.count ?? "…"}
          sub={stats ? `${stats.paidOrders.totalAmount.toLocaleString("ru-RU")} ₽` : ""}
        />
        <Tile
          label="AEV cashback"
          value={stats ? `${stats.cashback.totalAev.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}` : "…"}
          sub={stats ? `${stats.cashback.claimedAev.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} CLAIMED` : ""}
          tone="emerald"
        />
      </div>

      <h2 className="pt-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Quick actions</h2>
      <div className="flex flex-wrap gap-2">
        <BulkActionButton token={token} label="Close expired vacancies" endpoint="/api/build/admin/vacancies/close-expired" />
      </div>

      <h2 className="pt-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Sections</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard href="/build/admin/insights" title="Weekly insights" body="Past 7d platform metrics: new users / apps / hires + top employers + conversion." />
        <NavCard href="/build/admin/leads" title="Leads" body="Email captures from /build/why-aevion. Search, filter, CSV export." />
        <NavCard href="/build/admin/partner-keys" title="Partner API keys" body="Read-only API keys for partner sites syndicating the vacancy feed." />
        <NavCard href="/build/admin/users" title="Users" body="All registered users, roles, profiles, verification status." />
        <NavCard href="/build/admin/verification" title="Verification queue" body="Pending ✓ verified badge requests from candidates. Approve or reject." />
        <NavCard href="/build/stats" title="Public stats" body="Live platform numbers shown to non-admins." />
        <NavCard href="/build/pricing" title="Pricing" body="Plans, loyalty tiers, AEV cashback. Marketing-facing." />
        <NavCard href="/build/referrals" title="Referrals" body="Top-50 referral leaderboard. Public page." />
        <NavCard href="/build/vacancies" title="Vacancies" body="Browse all open vacancies with skills + sort filters." />
        <NavCard href="/build/leaderboard" title="Leaderboard" body="Top-rated employers and workers by review score." />
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
  tone?: "emerald" | "amber";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${
        tone === "emerald" ? "text-emerald-300" :
        tone === "amber" ? "text-amber-300" :
        "text-white"
      }`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function BulkActionButton({ token, label, endpoint }: { token: string | null; label: string; endpoint: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (!token) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setResult(j.success ? `Done: ${JSON.stringify(j.data)}` : j.error);
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
      >
        {busy ? "…" : label}
      </button>
      {result && <span className="text-xs text-slate-400">{result}</span>}
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
