"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Bucket = { t: string; avgMs: number; ok: boolean };
type Service = {
  key: string;
  name: string;
  status: "up" | "down" | "unknown" | "pending";
  latestLatencyMs: number | null;
  latestStatus: number | null;
  lastChecked: string | null;
  uptime24hPct: number;
  sparkline: Bucket[];
};
type StatusResponse = {
  summary: "operational" | "degraded" | "pending";
  checkedAt: string;
  services: Service[];
};

function StatusDot({ status }: { status: Service["status"] }) {
  const color =
    status === "up" ? "bg-emerald-400" :
    status === "down" ? "bg-rose-500" :
    "bg-amber-400";
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} />;
}

function Sparkline({ data }: { data: Bucket[] }) {
  if (!data.length) return <span className="text-xs text-[#9aa3c0]">no data</span>;
  const W = 200;
  const H = 28;
  const maxMs = Math.max(...data.map((b) => b.avgMs), 1);
  const step = W / Math.max(data.length - 1, 1);
  const pts = data
    .map((b, i) => {
      const x = i * step;
      const y = H - (b.avgMs / maxMs) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-40 h-6">
      <polyline fill="none" stroke="#22d3ee" strokeWidth={1.5} points={pts} />
      {data.map((b, i) => (
        <circle key={i} cx={i * step} cy={H - (b.avgMs / maxMs) * (H - 4) - 2}
          r={1.5} fill={b.ok ? "#10b981" : "#ef4444"} />
      ))}
    </svg>
  );
}

export default function ConstitutionStatusPage() {
  const { t } = useI18n();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api-backend/api/constitution/status");
      if (r.ok) setData(await r.json() as StatusResponse);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const summaryColor = data?.summary === "operational" ? "emerald" :
    data?.summary === "degraded" ? "rose" : "amber";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">← Constitution</Link>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mt-2">
            <h1 className="text-3xl font-bold text-[#d4af37]">Status</h1>
            <button type="button" onClick={load}
              className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10">
              ↻ Refresh
            </button>
          </div>
          {data && (
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-${summaryColor}-500/15 border border-${summaryColor}-400/40 text-sm`}>
              <StatusDot status={data.summary === "operational" ? "up" : data.summary === "degraded" ? "down" : "unknown"} />
              <span className={`text-${summaryColor}-300 font-semibold capitalize`}>{data.summary}</span>
              <span className="text-[#9aa3c0] text-xs">
                · as of {new Date(data.checkedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
          <p className="text-[#9aa3c0] text-xs mt-2">
            {t("constitution.status.pingSubtitle")}
          </p>
        </header>

        {loading && <div className="text-center text-[#9aa3c0] py-8">{t("constitution.status.loading")}</div>}

        {data && (
          <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#d4af37]/15 text-xs text-[#9aa3c0]">
                  <th className="text-left py-3 px-4">Service</th>
                  <th className="text-center py-3 px-3">Status</th>
                  <th className="text-right py-3 px-3">Latency</th>
                  <th className="text-right py-3 px-3">Uptime 24h</th>
                  <th className="py-3 px-4">Sparkline (latency 24h)</th>
                  <th className="text-right py-3 px-4">Last checked</th>
                </tr>
              </thead>
              <tbody>
                {data.services.map((svc) => (
                  <tr key={svc.key} className="border-b border-[#d4af37]/5 hover:bg-[#d4af37]/3">
                    <td className="py-3 px-4 font-medium">{svc.name}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={svc.status} />
                        <span className={`text-xs font-medium ${
                          svc.status === "up" ? "text-emerald-300" :
                          svc.status === "down" ? "text-rose-400" :
                          "text-amber-300"
                        }`}>
                          {svc.status === "up" ? "Operational" :
                           svc.status === "down" ? "Down" : "Checking"}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#d4af37]">
                      {svc.latestLatencyMs != null ? `${svc.latestLatencyMs}ms` : "—"}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${
                      svc.uptime24hPct >= 99 ? "text-emerald-300" :
                      svc.uptime24hPct >= 95 ? "text-amber-300" : "text-rose-400"
                    }`}>
                      {svc.uptime24hPct}%
                    </td>
                    <td className="py-3 px-4">
                      <Sparkline data={svc.sparkline} />
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-[#9aa3c0]">
                      {svc.lastChecked
                        ? new Date(svc.lastChecked).toLocaleTimeString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-6 text-xs text-[#9aa3c0] text-center">
          {t("constitution.status.footer")}
        </footer>
      </div>
    </div>
  );
}
