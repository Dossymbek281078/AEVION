"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "aevion_auth_token_v1";

type EndpointStat = {
  path: string;
  method: string;
  count: number;
  errors: number;
  lastSeen: number;
};
type IpStat = {
  ip: string;
  count: number;
  scenarios: number;
  votes: number;
  comments: number;
  lastSeen: number;
};
type SuspiciousIp = IpStat & { reasons: string[] };
type Ban = { ip: string; until: string; reason: string };
type Metrics = {
  bucketHours: number;
  totalRequests: number;
  totalErrors: number;
  errorRatePct: number;
  topEndpoints: EndpointStat[];
  topIps: IpStat[];
  suspicious: SuspiciousIp[];
  bans: Ban[];
  thresholds: { scenariosPerDay: number; votesPerDay: number };
};

export default function ConstitutionAdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [banIp, setBanIp] = useState<string>("");
  const [banHours, setBanHours] = useState<number>(24);

  useEffect(() => {
    try {
      setHasToken(!!localStorage.getItem(TOKEN_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api-backend/api/admin/constitution/metrics", {
        headers: authHeaders(),
      });
      if (r.status === 403) {
        setError("Доступ запрещён — требуется admin-токен.");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMetrics((await r.json()) as Metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const ban = async (ip: string, hours: number) => {
    if (!ip) return;
    try {
      const r = await fetch("/api-backend/api/admin/constitution/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ip, hours, reason: "admin manual" }),
      });
      if (r.ok) {
        setBanIp("");
        await load();
      }
    } catch {
      /* ignore */
    }
  };

  const unban = async (ip: string) => {
    try {
      const r = await fetch("/api-backend/api/admin/constitution/unban", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ip }),
      });
      if (r.ok) await load();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution
          </Link>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mt-2">
            <h1 className="text-3xl font-bold text-[#d4af37]">Admin — Telemetry & Abuse Shield</h1>
            <button
              type="button"
              onClick={load}
              className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
            >
              ↻ Обновить
            </button>
          </div>
          <p className="text-[#9aa3c0] text-sm mt-2">
            24h rolling stats per endpoint and per IP. Авто-обновление каждые 30с.
          </p>
        </header>

        {!hasToken && (
          <div className="mb-4 border border-amber-500/40 rounded p-3 bg-amber-500/5 text-amber-300 text-sm">
            ⚠ Auth токен не найден в localStorage. Сначала авторизуйся через{" "}
            <Link href="/auth" className="underline">
              /auth
            </Link>
            . Доступ только для admin-юзеров.
          </div>
        )}

        {error && (
          <div className="mb-4 border border-rose-500/40 rounded p-3 bg-rose-500/5 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {loading && !metrics && (
          <div className="text-center text-[#9aa3c0] py-8">Загрузка…</div>
        )}

        {metrics && (
          <div className="space-y-5">
            <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Запросов за 24h" value={metrics.totalRequests.toLocaleString()} />
                <Stat label="Ошибок" value={metrics.totalErrors.toString()} bad={metrics.totalErrors > 0} />
                <Stat label="Error rate" value={`${metrics.errorRatePct}%`} bad={metrics.errorRatePct > 5} />
                <Stat label="Banned IPs" value={metrics.bans.length.toString()} bad={metrics.bans.length > 0} />
              </div>
            </section>

            <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-[#f5d27a] mb-3">Top endpoints (24h)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#9aa3c0] border-b border-[#d4af37]/15">
                    <th className="text-left py-1">Method</th>
                    <th className="text-left py-1">Path</th>
                    <th className="text-right py-1">Count</th>
                    <th className="text-right py-1">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topEndpoints.map((ep, i) => (
                    <tr key={i} className="border-b border-[#d4af37]/5">
                      <td className="py-1.5">
                        <span
                          className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                            ep.method === "GET"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-cyan-500/20 text-cyan-300"
                          }`}
                        >
                          {ep.method}
                        </span>
                      </td>
                      <td className="text-xs font-mono truncate max-w-md">{ep.path}</td>
                      <td className="text-right font-mono text-[#d4af37]">{ep.count}</td>
                      <td
                        className={`text-right font-mono ${
                          ep.errors > 0 ? "text-rose-300" : "text-[#9aa3c0]"
                        }`}
                      >
                        {ep.errors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-[#f5d27a] mb-3">Top IPs (24h)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#9aa3c0] border-b border-[#d4af37]/15">
                    <th className="text-left py-1">IP</th>
                    <th className="text-right py-1">Req</th>
                    <th className="text-right py-1">Scen</th>
                    <th className="text-right py-1">Votes</th>
                    <th className="text-right py-1">Comm</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topIps.map((ip) => (
                    <tr key={ip.ip} className="border-b border-[#d4af37]/5">
                      <td className="font-mono text-xs">{ip.ip}</td>
                      <td className="text-right font-mono text-[#d4af37]">{ip.count}</td>
                      <td className="text-right font-mono">{ip.scenarios}</td>
                      <td className="text-right font-mono">{ip.votes}</td>
                      <td className="text-right font-mono">{ip.comments}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => ban(ip.ip, 24)}
                          className="text-xs px-2 py-0.5 rounded border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                          title="Soft-ban 24h"
                        >
                          Ban 24h
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {metrics.suspicious.length > 0 && (
              <section className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-rose-300 mb-3">
                  🚨 Suspicious IPs ({metrics.suspicious.length})
                </h2>
                <p className="text-xs text-[#9aa3c0] mb-3">
                  Thresholds: scenarios &gt; {metrics.thresholds.scenariosPerDay}/day OR votes
                  &gt; {metrics.thresholds.votesPerDay}/day
                </p>
                <ul className="space-y-2">
                  {metrics.suspicious.map((s) => (
                    <li
                      key={s.ip}
                      className="flex justify-between items-center border border-rose-500/30 rounded px-3 py-2"
                    >
                      <div>
                        <div className="font-mono">{s.ip}</div>
                        <div className="text-xs text-rose-300">{s.reasons.join(", ")}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => ban(s.ip, 24)}
                        className="text-xs px-3 py-1 rounded bg-rose-500 text-white font-bold hover:bg-rose-600"
                      >
                        Ban 24h
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-[#f5d27a] mb-3">Active bans</h2>
              {metrics.bans.length === 0 ? (
                <p className="text-sm text-[#9aa3c0] italic">Нет активных банов.</p>
              ) : (
                <ul className="space-y-1">
                  {metrics.bans.map((b) => (
                    <li
                      key={b.ip}
                      className="flex justify-between items-center text-sm border-b border-[#d4af37]/10 pb-1"
                    >
                      <span className="font-mono">{b.ip}</span>
                      <span className="text-xs text-[#9aa3c0]">until {new Date(b.until).toLocaleString()}</span>
                      <span className="text-xs text-[#9aa3c0]">{b.reason}</span>
                      <button
                        type="button"
                        onClick={() => unban(b.ip)}
                        className="text-xs px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Unban
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-3 border-t border-[#d4af37]/15">
                <div className="text-xs text-[#9aa3c0] mb-2">Manual ban</div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={banIp}
                    onChange={(e) => setBanIp(e.target.value)}
                    placeholder="123.45.67.89"
                    className="flex-1 min-w-[180px] bg-[#050a1a] border border-[#d4af37]/30 rounded px-2 py-1.5 text-sm font-mono"
                  />
                  <input
                    type="number"
                    value={banHours}
                    onChange={(e) => setBanHours(Number(e.target.value))}
                    min={1}
                    max={720}
                    className="w-20 bg-[#050a1a] border border-[#d4af37]/30 rounded px-2 py-1.5 text-sm font-mono text-center"
                  />
                  <button
                    type="button"
                    onClick={() => ban(banIp, banHours)}
                    disabled={!banIp}
                    className="px-3 py-1.5 rounded bg-rose-500 text-white font-bold text-sm disabled:opacity-40"
                  >
                    Ban
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  bad,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className="border border-[#d4af37]/15 rounded p-3 bg-[#050a1a]/40">
      <div className="text-xs text-[#9aa3c0]">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 font-mono ${
          bad ? "text-rose-300" : "text-[#d4af37]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
