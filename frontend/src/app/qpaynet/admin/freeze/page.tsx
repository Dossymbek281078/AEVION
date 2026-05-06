"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reportError } from "@/lib/reporter";

type ActionKind = "freeze" | "unfreeze";

interface ActionResult {
  walletId: string;
  status: "frozen" | "active";
  action: ActionKind;
  reason: string;
  at: string;
}

interface WalletHit {
  id: string;
  ownerId: string;
  name: string;
  status: "active" | "frozen" | "closed";
  balanceKzt: number;
  currency: string;
  createdAt: string;
}

const STATUS_CHIP: Record<WalletHit["status"], string> = {
  active: "bg-emerald-900 text-emerald-300",
  frozen: "bg-cyan-900 text-cyan-300",
  closed: "bg-slate-800 text-slate-500",
};

export default function AdminFreezePage() {
  const [token, setToken] = useState("");
  const [walletId, setWalletId] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<ActionKind>("freeze");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<ActionResult[]>([]);

  // Search state
  const [searchQ, setSearchQ] = useState("");
  const [searchStatus, setSearchStatus] = useState<"" | "active" | "frozen" | "closed">("");
  const [searchHits, setSearchHits] = useState<WalletHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    try {
      const raw = localStorage.getItem("aevion_admin_freeze_log");
      if (raw) setRecent(JSON.parse(raw) as ActionResult[]);
    } catch {
      // ignore corrupt log
    }
  }, []);

  async function search() {
    if (!searchQ.trim() && !searchStatus) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (searchQ.trim()) params.set("q", searchQ.trim());
      if (searchStatus) params.set("status", searchStatus);
      const r = await fetch(`/api/qpaynet/admin/wallets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setError(`Поиск не удался: ${r.status}`);
        return;
      }
      const d = await r.json();
      setSearchHits(d.items ?? []);
    } catch (err) {
      reportError(err, "qpaynet/admin/freeze");
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function persistRecent(updated: ActionResult[]) {
    setRecent(updated);
    try {
      localStorage.setItem("aevion_admin_freeze_log", JSON.stringify(updated));
    } catch {
      // ignore quota errors
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!walletId.trim()) {
      setError("Введите Wallet ID");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Причина должна быть от 5 до 500 символов");
      return;
    }
    const verb = action === "freeze" ? "ЗАМОРОЗИТЬ" : "РАЗМОРОЗИТЬ";
    if (!confirm(`Вы уверены, что хотите ${verb} кошелёк ${walletId.slice(0, 8)}…?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/qpaynet/admin/wallets/${walletId.trim()}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403) {
        setError("Не админ. Добавьте email в QPAYNET_ADMIN_EMAILS.");
        return;
      }
      if (!r.ok) {
        setError(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      const result: ActionResult = {
        walletId: d.walletId,
        status: d.status,
        action,
        reason: reason.trim(),
        at: new Date().toISOString(),
      };
      persistRecent([result, ...recent].slice(0, 20));
      setWalletId("");
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Войдите как админ.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">🧊 Freeze / Unfreeze</h1>
        </div>
        <Link href="/qpaynet/admin/refund" className="text-xs text-slate-400 hover:text-white">
          Refund →
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            🔍 Найти кошелёк
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") void search();
              }}
              placeholder="email, owner-id, wallet-id или имя"
              className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono focus:border-violet-600 focus:outline-none"
            />
            <select
              value={searchStatus}
              onChange={e => setSearchStatus(e.target.value as typeof searchStatus)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm"
            >
              <option value="">любой статус</option>
              <option value="active">active</option>
              <option value="frozen">frozen</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <button
            onClick={() => void search()}
            disabled={searching}
            className="mt-2 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-xs font-semibold"
          >
            {searching ? "..." : "Найти"}
          </button>

          {searchHits.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
              {searchHits.map(h => (
                <button
                  key={h.id}
                  onClick={() => {
                    setWalletId(h.id);
                    setAction(h.status === "frozen" ? "unfreeze" : "freeze");
                  }}
                  className="w-full text-left bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg p-2.5 flex items-center gap-3 text-xs"
                >
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_CHIP[h.status]}`}
                  >
                    {h.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-slate-300 truncate">{h.id}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {h.name} · owner: {h.ownerId}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-slate-400">
                      {h.balanceKzt.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {h.currency}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Управление статусом кошелька
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAction("freeze")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  action === "freeze"
                    ? "bg-cyan-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                🧊 Freeze
              </button>
              <button
                type="button"
                onClick={() => setAction("unfreeze")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  action === "unfreeze"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                🔥 Unfreeze
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Wallet ID (UUID)</label>
              <input
                type="text"
                value={walletId}
                onChange={e => setWalletId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono focus:border-violet-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Причина (5–500 символов)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder={
                  action === "freeze"
                    ? "Fraud investigation / chargeback / court order / KYC dispute"
                    : "Investigation closed / legitimate user / dispute resolved"
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
              <div className="text-[10px] text-slate-600 mt-1">
                Записывается в аудит-лог; пользователь получит уведомление.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 ${
                action === "freeze"
                  ? "bg-cyan-700 hover:bg-cyan-600"
                  : "bg-emerald-700 hover:bg-emerald-600"
              }`}
            >
              {submitting
                ? "..."
                : action === "freeze"
                ? "🧊 Заморозить кошелёк"
                : "🔥 Разморозить кошелёк"}
            </button>
          </form>

          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-400">Что делает freeze:</strong> блокирует
            depositы / переводы / charges / payouts на этом кошельке. Баланс сохраняется.
            Никаких новых движений до unfreeze.
            <br />
            <strong className="text-slate-400 mt-2 block">Use cases:</strong> расследование
            fraud, чарджбек в полёте, спор по KYC, судебный приказ, security-hold по запросу
            пользователя.
          </div>
        </div>

        {recent.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Последние действия (локально, до 20)
              </div>
              <button
                onClick={() => persistRecent([])}
                className="text-[10px] text-slate-600 hover:text-slate-400"
              >
                очистить
              </button>
            </div>
            <div className="space-y-1.5">
              {recent.map((r, i) => (
                <div
                  key={`${r.walletId}-${r.at}-${i}`}
                  className="flex items-center gap-3 text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
                >
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      r.status === "frozen"
                        ? "bg-cyan-900 text-cyan-300"
                        : "bg-emerald-900 text-emerald-300"
                    }`}
                  >
                    {r.action.toUpperCase()}
                  </span>
                  <span className="font-mono text-slate-400 truncate">{r.walletId}</span>
                  <span className="text-slate-500 truncate flex-1">{r.reason}</span>
                  <span className="text-slate-600 shrink-0">
                    {new Date(r.at).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-600 mt-3">
              Источник истины — серверный audit-log. Этот список — лишь локальная подсказка.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
