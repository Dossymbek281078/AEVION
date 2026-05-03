"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MerchantKey {
  id: string;
  name: string;
  key_prefix: string;
  wallet_id: string;
  revoked_at: string | null;
  created_at: string;
}

interface Wallet { id: string; name: string; balance: number; currency: string; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MerchantPage() {
  const [keys, setKeys] = useState<MerchantKey[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyWallet, setNewKeyWallet] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    Promise.all([
      fetch("/api/qpaynet/merchant/keys", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch("/api/qpaynet/wallets", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
    ]).then(([kd, wd]) => {
      setKeys(kd.keys ?? []);
      setWallets(wd.wallets ?? []);
      if (wd.wallets?.[0]) setNewKeyWallet(wd.wallets[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createKey() {
    if (!newKeyWallet) return;
    setCreating(true);
    const r = await fetch("/api/qpaynet/merchant/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newKeyName || "API Key", walletId: newKeyWallet }),
    });
    const d = await r.json();
    setCreatedKey(d.key);
    setKeys(prev => [{ id: d.id, name: d.name, key_prefix: d.keyPrefix, wallet_id: newKeyWallet, revoked_at: null, created_at: new Date().toISOString() }, ...prev]);
    setCreating(false);
  }

  async function revokeKey(id: string) {
    if (!confirm("Отозвать ключ?")) return;
    await fetch(`/api/qpaynet/merchant/keys/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setKeys(prev => prev.map(k => k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
        <span className="text-slate-600">·</span>
        <h1 className="text-sm font-bold">Merchant API</h1>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* API key warning */}
        {createdKey && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-5">
            <div className="font-bold text-amber-300 mb-2">🔑 Ваш API-ключ — сохраните сейчас!</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900 text-emerald-400 text-xs px-3 py-2 rounded-lg break-all font-mono">{createdKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-semibold">
                {copied ? "✓" : "Копировать"}
              </button>
            </div>
            <p className="text-xs text-amber-600 mt-2">Ключ показан только один раз. После закрытия восстановить невозможно.</p>
            <button onClick={() => setCreatedKey(null)} className="text-xs text-slate-500 hover:text-slate-300 underline mt-2">Закрыть</button>
          </div>
        )}

        {/* Create new key */}
        {token && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <h2 className="font-bold mb-4">Создать API-ключ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Название ключа</label>
                <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Production, Test, QBuild..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Кошелёк для получения</label>
                <select value={newKeyWallet} onChange={e => setNewKeyWallet(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {w.currency})</option>
                  ))}
                  {wallets.length === 0 && <option value="">Нет кошельков</option>}
                </select>
              </div>
            </div>
            <button onClick={createKey} disabled={creating || !newKeyWallet}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
              {creating ? "Создание..." : "+ Создать ключ"}
            </button>
          </div>
        )}

        {/* Usage example */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-bold mb-3">Использование</h2>
          <code className="block bg-slate-800 text-emerald-400 text-xs p-4 rounded-xl font-mono whitespace-pre overflow-x-auto">{`POST /api/qpaynet/merchant/charge
X-Api-Key: qpn_live_...

{
  "customerWalletId": "uuid-кошелька-клиента",
  "amount": 990,
  "description": "Оплата подписки QBuild Pro"
}`}</code>
        </div>

        {/* Keys list */}
        <div>
          <h2 className="font-bold mb-3">API-ключи ({keys.length})</h2>
          {loading && <div className="text-slate-500 text-sm py-4">Загрузка...</div>}
          {!loading && keys.length === 0 && <div className="text-slate-600 text-sm py-4">Ключей нет</div>}
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className={`flex items-center justify-between p-3 rounded-xl border ${k.revoked_at ? "border-slate-800 opacity-50" : "border-slate-700 bg-slate-900"}`}>
                <div>
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{k.key_prefix}... · создан {fmtDate(k.created_at)}</div>
                </div>
                {k.revoked_at ? (
                  <span className="text-[10px] bg-red-900 text-red-400 px-2 py-0.5 rounded-full">Отозван</span>
                ) : (
                  <button onClick={() => revokeKey(k.id)}
                    className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg">
                    Отозвать
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
