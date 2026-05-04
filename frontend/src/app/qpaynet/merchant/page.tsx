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
          <h2 className="font-bold mb-3">Использование (server-to-server)</h2>
          <code className="block bg-slate-800 text-emerald-400 text-xs p-4 rounded-xl font-mono whitespace-pre overflow-x-auto">{`POST /api/qpaynet/merchant/charge
X-Api-Key: qpn_live_...

{
  "customerWalletId": "uuid-кошелька-клиента",
  "amount": 990,
  "description": "Оплата подписки QBuild Pro"
}`}</code>
        </div>

        {/* Webhook subscriptions (set-once) */}
        <WebhookSubs token={token} />

        {/* Webhook tester */}
        <WebhookTester token={token} />

        {/* Embed widget */}
        {wallets.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <h2 className="font-bold mb-1">Pay-кнопка для сайта</h2>
            <p className="text-xs text-slate-400 mb-3">
              Вставьте iframe на любой сайт — получатели смогут оплатить через AEVION без интеграции:
            </p>
            <code className="block bg-slate-800 text-violet-300 text-xs p-4 rounded-xl font-mono whitespace-pre-wrap break-all">{`<iframe
  src="https://aevion.kz/qpaynet/widget/${wallets[0].id}?amount=990&desc=Подписка"
  width="380" height="360" frameborder="0"
  style="border-radius:16px"
></iframe>`}</code>
            <p className="text-[11px] text-slate-500 mt-2">
              Параметры: <code className="text-slate-400">amount</code>, <code className="text-slate-400">desc</code>, <code className="text-slate-400">compact=1</code> (прозрачный фон).
            </p>
          </div>
        )}

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

interface SubItem {
  id: string;
  url: string;
  events: string;
  revoked_at: string | null;
  created_at: string;
}

function WebhookSubs({ token }: { token: string }) {
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch("/api/qpaynet/webhook-subs", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSubs(d.subscriptions ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return null;

  async function create() {
    if (!newUrl.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/qpaynet/webhook-subs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        setSubs(prev => [{ id: d.id, url: d.url, events: d.events, revoked_at: null, created_at: new Date().toISOString() }, ...prev]);
        setCreatedSecret(d.secret);
        setNewUrl("");
      }
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!confirm("Отозвать webhook подписку?")) return;
    const r = await fetch(`/api/qpaynet/webhook-subs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setSubs(prev => prev.map(s => s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s));
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
      <h2 className="font-bold mb-1">Webhook подписки (set-once)</h2>
      <p className="text-xs text-slate-400 mb-3">
        Подписка получает все <code>payment_request.paid</code> события для всех ваших кошельков.
        Альтернатива per-request <code>notifyUrl</code>.
      </p>

      {createdSecret && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-3 mb-3">
          <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">Секрет (показан 1 раз)</div>
          <code className="text-xs text-amber-200 break-all block">{createdSecret}</code>
          <button onClick={() => setCreatedSecret(null)} className="text-[10px] text-amber-400/70 mt-2 hover:text-amber-300">Скрыть</button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)}
          placeholder="https://your-site.kz/webhooks/qpaynet"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
        <button onClick={create} disabled={creating || !newUrl}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
          {creating ? "..." : "+ Добавить"}
        </button>
      </div>

      {loading && <div className="text-slate-500 text-xs">Загрузка...</div>}
      {!loading && subs.length === 0 && <div className="text-slate-600 text-xs">Подписок нет</div>}

      <div className="space-y-2">
        {subs.map(s => (
          <div key={s.id} className={`flex items-center justify-between p-2 rounded-lg border ${s.revoked_at ? "border-slate-800 opacity-50" : "border-slate-700 bg-slate-950"}`}>
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-xs font-mono text-slate-300 truncate">{s.url}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.events}</div>
            </div>
            {s.revoked_at ? (
              <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full shrink-0">Отозвана</span>
            ) : (
              <button onClick={() => revoke(s.id)}
                className="text-[10px] px-2 py-1 bg-red-900 hover:bg-red-800 text-red-300 rounded shrink-0">
                Отозвать
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhookTester({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; deliveryStatus: number; error?: string; hint: string; payloadSent: unknown } | null>(null);

  if (!token) return null;

  async function run() {
    if (!url || !secret) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch("/api/qpaynet/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim(), secret: secret.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setResult({ ok: false, deliveryStatus: 0, error: d.error, hint: "Validation failed.", payloadSent: null });
      } else {
        setResult(d);
      }
    } finally { setRunning(false); }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
      <h2 className="font-bold mb-1">Тест webhook</h2>
      <p className="text-xs text-slate-400 mb-3">
        Проверьте свой endpoint до боевого использования. Получатель должен ответить 2xx.
      </p>
      <div className="space-y-2">
        <input type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://your-site.kz/webhook/qpaynet"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
        <input type="text" value={secret} onChange={e => setSecret(e.target.value)}
          placeholder="notifySecret (≥16 chars)"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500" />
        <button onClick={run} disabled={running || !url || !secret}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
          {running ? "Отправка..." : "Отправить тестовый POST"}
        </button>
      </div>
      {result && (
        <div className={`mt-3 p-3 rounded-lg border text-xs ${result.ok ? "border-emerald-800 bg-emerald-950/30" : "border-red-800 bg-red-950/30"}`}>
          <div className={`font-semibold mb-1 ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
            {result.ok ? "✓ Доставлено" : "✗ Ошибка"}
            {result.deliveryStatus > 0 && <span className="ml-2 text-slate-400 font-mono">HTTP {result.deliveryStatus}</span>}
          </div>
          <div className="text-slate-300">{result.hint}</div>
          {result.error && <div className="text-red-300/80 mt-1 font-mono break-all">{result.error}</div>}
        </div>
      )}
    </div>
  );
}
