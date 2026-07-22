"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";

interface ProviderRow {
  provider: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

interface ModelRow {
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  costUsd: number;
}

interface DailyRow {
  date: string;
  calls: number;
  costUsd: number;
}

interface OpexData {
  totals: { calls: number; tokensIn: number; tokensOut: number; costUsd: number };
  byProvider: ProviderRow[];
  byModel: ModelRow[];
  daily: DailyRow[];
  source: "db" | "memory";
}

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  gemini: "#3b82f6",
  deepseek: "#8b5cf6",
  grok: "#ef4444",
};

const fmtUsd = (v: number) =>
  v >= 1 ? `$${v.toFixed(2)}` : v > 0 ? `$${v.toFixed(4)}` : "$0";

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

export default function OpexPage() {
  const { t } = useI18n();
  const [data, setData] = useState<OpexData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/opex?days=30"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxDaily = data ? Math.max(...data.daily.map((d) => d.costUsd), 0.000001) : 1;
  const totalCost = data?.totals.costUsd ?? 0;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <Link href="/qcoreai" className="text-slate-400 hover:text-white text-sm">← QCoreAI</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Provider OPEX</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">{t("qcoreai.opex.title")}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {t("qcoreai.opex.subtitle")}{" "}
            <Link href="/qcoreai/analytics" className="text-teal-400 hover:text-teal-300 underline">/qcoreai/analytics</Link>.
          </p>
        </div>

        {loading && <div className="text-center py-16 text-slate-500 animate-pulse text-sm">{t("qcoreai.common.loading")}</div>}

        {!loading && !data && (
          <div className="text-center py-16 text-slate-500 text-sm">{t("qcoreai.opex.unavailable")}</div>
        )}

        {!loading && data && (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                [t("qcoreai.opex.spent"), fmtUsd(data.totals.costUsd)],
                [t("qcoreai.opex.calls"), String(data.totals.calls)],
                [t("qcoreai.opex.tokensIn"), fmtTokens(data.totals.tokensIn)],
                [t("qcoreai.opex.tokensOut"), fmtTokens(data.totals.tokensOut)],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-lg font-bold mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Daily spend, last 30 days */}
            {data.daily.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">{t("qcoreai.opex.daily")}</p>
                <div className="flex items-end gap-[2px] h-20">
                  {data.daily.map((d) => (
                    <div
                      key={d.date}
                      className="flex-1 bg-teal-500/70 rounded-t-sm min-h-[2px]"
                      style={{ height: `${Math.max(3, (d.costUsd / maxDaily) * 100)}%` }}
                      title={`${d.date}: ${fmtUsd(d.costUsd)} · ${d.calls} ${t("qcoreai.opex.callsUnit")}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Per-provider */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">{t("qcoreai.opex.byProvider")}</p>
              {data.byProvider.length === 0 && (
                <p className="text-sm text-slate-500">{t("qcoreai.opex.noCalls")}</p>
              )}
              <div className="space-y-3">
                {data.byProvider.map((p) => {
                  const color = PROVIDER_COLOR[p.provider] ?? "#64748b";
                  const share = totalCost > 0 ? (p.costUsd / totalCost) * 100 : 0;
                  return (
                    <div key={p.provider}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold capitalize">{p.provider}</span>
                        <span className="text-slate-400 text-xs">
                          {fmtUsd(p.costUsd)} · {share.toFixed(1)}% · {p.calls} {t("qcoreai.opex.callsUnit")} · {fmtTokens(p.tokensIn + p.tokensOut)} {t("qcoreai.opex.tokensUnit")}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-model top */}
            {data.byModel.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 overflow-x-auto">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">{t("qcoreai.opex.topModels")}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider">
                      <th className="pb-2 pr-3 font-medium">{t("qcoreai.opex.model")}</th>
                      <th className="pb-2 pr-3 font-medium text-right">{t("qcoreai.opex.calls")}</th>
                      <th className="pb-2 pr-3 font-medium text-right">{t("qcoreai.opex.tokens")}</th>
                      <th className="pb-2 font-medium text-right">{t("qcoreai.opex.cost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byModel.map((m) => (
                      <tr key={`${m.provider}:${m.model}`} className="border-t border-slate-800">
                        <td className="py-2 pr-3">
                          <span className="capitalize text-slate-400">{m.provider}</span>
                          <span className="text-slate-600"> / </span>
                          {m.model}
                        </td>
                        <td className="py-2 pr-3 text-right text-slate-400">{m.calls}</td>
                        <td className="py-2 pr-3 text-right text-slate-400">{fmtTokens(m.tokens)}</td>
                        <td className="py-2 text-right font-semibold">{fmtUsd(m.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-600 text-center mt-4">
              {data.source === "db" ? t("qcoreai.opex.source.db") : t("qcoreai.opex.source.memory")} · {t("qcoreai.opex.freeNote")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
