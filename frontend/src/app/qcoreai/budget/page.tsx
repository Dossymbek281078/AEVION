"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") ?? sessionStorage.getItem("qcoreai_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface SpendSummary {
  spentUsd: number;
  limitUsd: number | null;
  alertAt: number;
  pct: number | null;
  alerting: boolean;
  exceeded: boolean;
}

interface SpendLimit {
  monthlyLimitUsd: number;
  alertAt: number;
}

export default function QCoreBudgetPage() {
  const [summary, setSummary] = useState<SpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [limitInput, setLimitInput] = useState("");
  const [alertInput, setAlertInput] = useState("80");

  async function fetchSummary() {
    try {
      const r = await fetch(apiUrl("/api/qcoreai/me/spend-summary"), {
        headers: bearerHeader(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setSummary(d);
      if (d.limitUsd) {
        setLimitInput(String(d.limitUsd));
        setAlertInput(String(Math.round((d.alertAt ?? 0.8) * 100)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSummary(); }, []);

  async function saveLimit() {
    const limitVal = parseFloat(limitInput);
    const alertVal = parseFloat(alertInput) / 100;
    if (!limitVal || limitVal <= 0) { setError("Введите положительный лимит"); return; }
    if (alertVal <= 0 || alertVal > 1) { setError("Порог оповещения 1-100%"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const r = await fetch(apiUrl("/api/qcoreai/me/spend-limit"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ monthlyLimitUsd: limitVal, alertAt: alertVal }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setSuccess("Лимит сохранён");
      await fetchSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function removeLimit() {
    if (!confirm("Удалить лимит бюджета?")) return;
    setRemoving(true); setError(""); setSuccess("");
    try {
      const r = await fetch(apiUrl("/api/qcoreai/me/spend-limit"), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? `HTTP ${r.status}`); }
      setSuccess("Лимит удалён");
      setLimitInput(""); setAlertInput("80");
      await fetchSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setRemoving(false);
    }
  }

  const spentPct = summary?.pct != null ? Math.round(summary.pct * 100) : null;
  const barColor =
    summary?.exceeded ? "bg-red-500" :
    summary?.alerting ? "bg-amber-500" :
    "bg-teal-500";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/qcoreai" className="text-slate-400 hover:text-white text-sm">← QCoreAI</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Бюджет и лимиты</span>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {loading && (
          <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Загрузка…</div>
        )}

        {!loading && summary && (
          <>
            {/* Current month spend */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                Расходы текущего месяца
              </h2>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-black text-white">
                  ${summary.spentUsd.toFixed(4)}
                </span>
                {summary.limitUsd && (
                  <span className="text-slate-500 text-sm mb-1">
                    / ${summary.limitUsd.toFixed(2)} лимит
                  </span>
                )}
              </div>

              {summary.limitUsd && spentPct !== null && (
                <>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, spentPct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{spentPct}% использовано</span>
                    <span>
                      {summary.exceeded ? (
                        <span className="text-red-400 font-semibold">⛔ Лимит превышен</span>
                      ) : summary.alerting ? (
                        <span className="text-amber-400 font-semibold">⚠ Близко к лимиту</span>
                      ) : (
                        <span className="text-teal-400">✓ В пределах лимита</span>
                      )}
                    </span>
                  </div>
                </>
              )}

              {!summary.limitUsd && (
                <p className="text-xs text-slate-600 mt-2">
                  Лимит не установлен — расходы не ограничены
                </p>
              )}
            </div>

            {/* Set limit form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {summary.limitUsd ? "Изменить лимит" : "Установить лимит"}
              </h2>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Месячный лимит (USD)
                </label>
                <div className="flex gap-2">
                  {[1, 5, 10, 25].map((v) => (
                    <button
                      key={v}
                      onClick={() => setLimitInput(String(v))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        limitInput === String(v)
                          ? "bg-teal-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="0.00"
                  className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Оповещать при достижении (%)
                </label>
                <div className="flex gap-2">
                  {[50, 70, 80, 90].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAlertInput(String(v))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        alertInput === String(v)
                          ? "bg-violet-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-teal-900/30 border border-teal-800 rounded-xl px-4 py-2.5 text-sm text-teal-300">
                  ✓ {success}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={saveLimit}
                  disabled={saving}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {saving ? "Сохранение…" : "Сохранить лимит"}
                </button>
                {summary.limitUsd && (
                  <button
                    onClick={removeLimit}
                    disabled={removing}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 rounded-xl text-sm transition-colors"
                  >
                    {removing ? "…" : "Удалить"}
                  </button>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="text-xs text-slate-600 space-y-1.5">
              <p>• Лимит считается по фактическим расходам за календарный месяц</p>
              <p>• При превышении новые запросы к AI будут отклонены</p>
              <p>• Лимит применяется к каждому пользователю независимо</p>
            </div>
          </>
        )}

        <div className="pt-2 border-t border-slate-800 flex gap-4">
          <Link href="/qcoreai/analytics" className="text-xs text-slate-500 hover:text-slate-300">
            📊 Analytics
          </Link>
          <Link href="/qcoreai" className="text-xs text-slate-500 hover:text-slate-300">
            ← QCoreAI
          </Link>
        </div>
      </div>
    </div>
  );
}
