"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance: number;
  status: string;
  created_at: string;
}

interface Tx {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  fee: number;
  currency: string;
  description: string;
  status: string;
  created_at: string;
}

interface Stats {
  activeWallets: number;
  totalTransactions: number;
  totalDepositedKzt: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  deposit:        { label: "Пополнение",    color: "text-emerald-400", sign: "+" },
  withdraw:       { label: "Вывод",         color: "text-red-400",     sign: "−" },
  transfer_out:   { label: "Перевод (исх)", color: "text-amber-400",   sign: "−" },
  transfer_in:    { label: "Перевод (вх)",  color: "text-emerald-400", sign: "+" },
  merchant_charge:{ label: "Списание",      color: "text-red-400",     sign: "−" },
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function QPayNetDashboard() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const [newWalletName, setNewWalletName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    fetch("/api/qpaynet/stats").then(r => r.json()).then(setStats).catch(() => {});
    if (!t) { setLoading(false); return; }
    Promise.all([
      fetch("/api/qpaynet/wallets", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch("/api/qpaynet/transactions?limit=20", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
    ]).then(([wd, td]) => {
      setWallets(wd.wallets ?? []);
      setTxs(td.transactions ?? []);
      if (wd.wallets?.[0]) setActiveWallet(wd.wallets[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function saveRename() {
    const name = renameValue.trim();
    if (!name || !activeWallet) return;
    const r = await fetch(`/api/qpaynet/wallets/${activeWallet}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setWallets(prev => prev.map(w => w.id === activeWallet ? { ...w, name } : w));
    }
    setRenaming(false);
  }

  async function createWallet() {
    setCreating(true);
    const r = await fetch("/api/qpaynet/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newWalletName || "Мой кошелёк" }),
    });
    const d = await r.json();
    setWallets(prev => [d, ...prev]);
    setActiveWallet(d.id);
    setNewWalletName(""); setShowCreate(false); setCreating(false);
  }

  const activeW = wallets.find(w => w.id === activeWallet);
  const activeTxs = txs.filter(t => !activeWallet || t.wallet_id === activeWallet);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-violet-400 font-black text-lg">₸</span>
          <span className="font-bold">QPayNet</span>
          <span className="text-[10px] bg-violet-900 text-violet-300 px-2 py-0.5 rounded-full">BETA</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-400 hover:text-white">← AEVION</Link>
          <Link href="/qpaynet/merchant" className="text-xs text-slate-400 hover:text-white">Merchant API</Link>
          {token && (
            <button onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg">
              + Кошелёк
            </button>
          )}
        </div>
      </header>

      {/* Public stats */}
      {stats && (
        <div className="border-b border-slate-800 px-6 py-3 flex items-center gap-6 text-xs text-slate-500">
          <span>💳 {stats.activeWallets} кошельков</span>
          <span>⚡ {stats.totalTransactions} транзакций</span>
          <span>₸ {fmt(stats.totalDepositedKzt)} тнг. депозитов</span>
        </div>
      )}

      {!token && (
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="text-6xl mb-6">💳</div>
          <h1 className="text-4xl font-black mb-4">Платёжная инфраструктура<br />встроенная в AEVION</h1>
          <p className="text-slate-400 text-lg mb-8">
            Кошельки в тенге · P2P переводы · Merchant API для QBuild и других модулей
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-10">
            {[["₸","Тенге (KZT)"],["⚡","Мгновенные переводы"],["🔑","Merchant API Key"],["📊","История транзакций"]].map(([icon,label])=>(
              <div key={label} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 px-4 py-2 rounded-xl">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
          <Link href="/auth" className="inline-block px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white text-base font-bold rounded-xl">
            Войти и открыть кошелёк →
          </Link>
        </div>
      )}

      {token && (
        <div className="max-w-5xl mx-auto px-6 py-8">
          {loading ? (
            <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: wallets */}
              <div className="lg:col-span-1 space-y-3">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Кошельки</h2>
                {wallets.map(w => (
                  <button key={w.id} onClick={() => setActiveWallet(w.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      activeWallet === w.id
                        ? "bg-violet-900/30 border-violet-600"
                        : "bg-slate-900 border-slate-700 hover:border-slate-500"
                    }`}>
                    <div className="text-xs text-slate-400 mb-1">{w.name}</div>
                    <div className="text-xl font-bold text-white">{fmt(w.balance)} <span className="text-sm text-slate-400">{w.currency}</span></div>
                    <div className="text-[10px] text-slate-600 mt-1 font-mono">{w.id.slice(0,8)}...</div>
                  </button>
                ))}
                {wallets.length === 0 && (
                  <div className="text-slate-600 text-sm text-center py-6">Нет кошельков</div>
                )}
                {showCreate && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2">
                    <input type="text" value={newWalletName} onChange={e => setNewWalletName(e.target.value)}
                      placeholder="Название кошелька"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
                    <div className="flex gap-2">
                      <button onClick={createWallet} disabled={creating}
                        className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-semibold disabled:opacity-40">
                        {creating ? "..." : "Создать"}
                      </button>
                      <button onClick={() => setShowCreate(false)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs">✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: actions + txs */}
              <div className="lg:col-span-2 space-y-4">
                {activeW && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 group">
                          {renaming ? (
                            <>
                              <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(false); }}
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-violet-500 w-40" />
                              <button onClick={saveRename} className="text-emerald-400 hover:text-emerald-300 text-xs">✓</button>
                              <button onClick={() => setRenaming(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
                            </>
                          ) : (
                            <>
                              <div className="text-xs text-slate-400 truncate">{activeW.name}</div>
                              <button onClick={() => { setRenameValue(activeW.name); setRenaming(true); }}
                                className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 hover:text-slate-300 transition-opacity">
                                ✎
                              </button>
                            </>
                          )}
                        </div>
                        <div className="text-2xl font-bold">{fmt(activeW.balance)} ₸</div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Link href={`/qpaynet/deposit?wallet=${activeW.id}`}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-semibold">+ Пополнить</Link>
                        <Link href={`/qpaynet/send?wallet=${activeW.id}`}
                          className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-xs font-semibold">→ Отправить</Link>
                        <Link href={`/qpaynet/request?wallet=${activeW.id}`}
                          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded-lg text-xs font-semibold">📥 Запросить</Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-[10px] text-slate-600 font-mono truncate">{activeW.id}</div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(activeW.id); }}
                        title="Скопировать ID кошелька"
                        className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 bg-slate-800 rounded"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Последние транзакции
                    </h3>
                    <Link href="/qpaynet/transactions" className="text-[11px] text-violet-400 hover:text-violet-300">
                      Все →
                    </Link>
                  </div>
                  {activeTxs.length === 0 ? (
                    <div className="text-slate-600 text-sm text-center py-8 bg-slate-900 rounded-xl border border-slate-800">
                      Транзакций пока нет
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {activeTxs.slice(0, 15).map(tx => {
                        const t = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-slate-400", sign: "" };
                        return (
                          <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                            <div className="flex-1 min-w-0">
                              <div className="text-slate-300 font-medium truncate">{tx.description || t.label}</div>
                              <div className="text-slate-600 mt-0.5">{t.label} · {fmtDate(tx.created_at)}</div>
                            </div>
                            <div className={`font-bold ml-3 shrink-0 ${t.color}`}>
                              {t.sign}{fmt(tx.amount)} ₸
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
