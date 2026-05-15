"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type Health = {
  status: string;
  service: string;
  uptimeSec: number;
  sentry: boolean;
  ledger: { backend: string; accounts: number; transfers: number; planetCerts: number };
  memory: { heapUsedMb: number; rssMb: number };
};

type ModulesStatus = {
  total: number;
  byTier: Record<string, number>;
  items: Array<{
    id: string;
    name: string;
    status: string;
    effectiveTier: string | null;
    effectiveStatus: string;
  }>;
};

type Quotas = {
  version: string;
  publishedAt: string;
  tiers: Array<{ id: string; name: string; priceUsdMonthly: number | null; monthlyCalls: number | null }>;
  endpoints: Array<{ path: string }>;
};

type ApiState<T> = { loading: boolean; data: T | null; error: string | null; fetchedAt: number };

const initial = <T,>(): ApiState<T> => ({ loading: true, data: null, error: null, fetchedAt: 0 });

const fmtUptime = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
};

const fmtNum = (n: number | null) => (n === null ? "unlimited" : n.toLocaleString("en-US"));

export default function LaunchStatusPage() {
  const [health, setHealth] = useState<ApiState<Health>>(initial<Health>());
  const [modules, setModules] = useState<ApiState<ModulesStatus>>(initial<ModulesStatus>());
  const [quotas, setQuotas] = useState<ApiState<Quotas>>(initial<Quotas>());
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    const fetchOne = async <T,>(path: string, set: (s: ApiState<T>) => void) => {
      try {
        const r = await fetch(apiUrl(path), { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as T;
        set({ loading: false, data, error: null, fetchedAt: Date.now() });
      } catch (e) {
        set({ loading: false, data: null, error: e instanceof Error ? e.message : "fetch failed", fetchedAt: Date.now() });
      }
    };
    await Promise.all([
      fetchOne<Health>("/api/health/deep", setHealth),
      fetchOne<ModulesStatus>("/api/modules/status", setModules),
      fetchOne<Quotas>("/api/quotas", setQuotas),
    ]);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  const allOk = health.data?.status === "ok" && !modules.error && !quotas.error;
  const mvpLive = modules.data?.byTier?.mvp_live ?? 0;
  const launchedItems = modules.data?.items.filter((i) => i.status === "launched") ?? [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`h-3 w-3 rounded-full ${
                allOk ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-widest ${
                allOk ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {allOk ? "All systems operational" : "Degraded"}
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">AEVION Launch Status</h1>
          <p className="text-slate-400">
            Real-time состояние production-инфраструктуры. Auto-refresh каждые 60 секунд.{" "}
            <span className="text-slate-500">
              · последнее обновление {Math.floor((now - Math.max(health.fetchedAt, modules.fetchedAt, quotas.fetchedAt)) / 1000)}s назад
            </span>
          </p>
        </div>

        {/* Backend health */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Backend</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            {health.loading ? (
              <div className="text-slate-500">loading…</div>
            ) : health.error ? (
              <div className="text-rose-400">❌ {health.error}</div>
            ) : health.data ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <Stat label="Status" value={health.data.status} ok={health.data.status === "ok"} />
                <Stat label="Uptime" value={fmtUptime(health.data.uptimeSec)} />
                <Stat label="Ledger" value={health.data.ledger.backend} ok={health.data.ledger.backend === "postgres"} />
                <Stat label="Sentry" value={health.data.sentry ? "on" : "off"} muted={!health.data.sentry} />
                <Stat label="Heap" value={`${health.data.memory.heapUsedMb} MB`} />
                <Stat label="RSS" value={`${health.data.memory.rssMb} MB`} />
                <Stat label="Accounts" value={health.data.ledger.accounts.toString()} />
                <Stat label="Planet certs" value={health.data.ledger.planetCerts.toString()} />
              </div>
            ) : null}
          </div>
        </section>

        {/* Modules */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
            Modules{" "}
            {modules.data && (
              <span className="ml-2 font-mono text-xs text-slate-600">{modules.data.total} total</span>
            )}
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            {modules.loading ? (
              <div className="text-slate-500">loading…</div>
            ) : modules.error ? (
              <div className="text-rose-400">❌ {modules.error}</div>
            ) : modules.data ? (
              <>
                <div className="mb-5 flex flex-wrap gap-2">
                  <Pill label="MVP live" count={mvpLive} color="emerald" />
                  <Pill label="Platform API" count={modules.data.byTier?.platform_api ?? 0} color="sky" />
                  <Pill label="Portal-only" count={modules.data.byTier?.portal_only ?? 0} color="slate" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {launchedItems.slice(0, 12).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-200">{m.name}</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* Public API */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Public API contract</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            {quotas.loading ? (
              <div className="text-slate-500">loading…</div>
            ) : quotas.error ? (
              <div className="text-rose-400">❌ {quotas.error}</div>
            ) : quotas.data ? (
              <>
                <div className="mb-4 flex items-center gap-3 text-xs text-slate-500">
                  <span>spec v{quotas.data.version}</span>
                  <span>·</span>
                  <span>published {quotas.data.publishedAt}</span>
                  <span>·</span>
                  <span>{quotas.data.endpoints.length} public endpoints</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {quotas.data.tiers.map((t) => (
                    <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.name}</div>
                      <div className="mt-1 text-lg font-bold text-slate-100">
                        {t.priceUsdMonthly === null ? "custom" : `$${t.priceUsdMonthly}/mo`}
                      </div>
                      <div className="text-xs text-slate-500">{fmtNum(t.monthlyCalls)} calls/mo</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <Link href="/pricing/api-pricing" className="text-teal-400 hover:underline">
                    Pricing page →
                  </Link>
                  <a
                    href="/api-backend/api/quotas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:underline"
                  >
                    /api/quotas (machine-readable)
                  </a>
                  <a
                    href="https://github.com/Dossymbek281078/AEVION/blob/main/docs/api/PUBLIC_API_QUOTAS.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:underline"
                  >
                    Spec PUBLIC_API_QUOTAS.md →
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* CI / external */}
        <section className="mb-12">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">CI &amp; external</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <a
                href="https://github.com/Dossymbek281078/AEVION/actions/workflows/daily-smoke.yml"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline"
              >
                Daily smoke (GitHub Actions) →
              </a>
              <a
                href="https://github.com/Dossymbek281078/AEVION"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline"
              >
                Source code →
              </a>
              <a
                href="/api-backend/api/health/deep"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline"
              >
                Backend deep health →
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600">
          AEVION — Trust OS for the AI-content era · {new Date().getFullYear()} ·{" "}
          <Link href="/" className="text-slate-400 hover:underline">
            home
          </Link>
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value, ok, muted }: { label: string; value: string; ok?: boolean; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div
        className={`mt-1 font-mono text-sm ${
          ok ? "text-emerald-400" : muted ? "text-slate-500" : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ label, count, color }: { label: string; count: number; color: "emerald" | "sky" | "slate" }) {
  const cls = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    slate: "border-slate-500/30 bg-slate-700/20 text-slate-300",
  }[color];
  return (
    <div className={`rounded-lg border px-3 py-1.5 text-sm ${cls}`}>
      <span className="font-bold">{count}</span> <span className="opacity-80">{label}</span>
    </div>
  );
}
