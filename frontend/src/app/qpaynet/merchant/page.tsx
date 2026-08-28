"use client";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface MerchantKey {
  id: string;
  name: string;
  key_prefix: string;
  wallet_id: string;
  revoked_at: string | null;
  created_at: string;
}

interface Wallet { id: string; name: string; balance: number; currency: string; }

function fmtDate(iso: string, lang: string) {
  const localeTag = lang === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * What to show when a revoke comes back not-ok. The server's own message is
 * preferred over a status code; the dictionary lives in a file several
 * sessions edit, so nothing new is added to it here.
 */
async function failureText(r: Response): Promise<string> {
  try {
    const body = await r.json();
    const msg = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : "";
    if (msg) return `${msg} (HTTP ${r.status})`;
  } catch { /* not JSON — the status is all we have */ }
  return `HTTP ${r.status}`;
}

export default function MerchantPage() {
  const { t, lang } = useI18n();
  const [keys, setKeys] = useState<MerchantKey[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyWallet, setNewKeyWallet] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  // Отдельно от revokeError: имя должно говорить правду о том, ЧТО не
  // получилось. Отказ создания раньше не показывался никак — ответ сервера
  // не проверялся, и в список ключей уходила запись с пустыми полями, а в
  // окно «ваш ключ» — undefined. Человек считал ключ созданным.
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const saved = getAuthToken() ?? "";
    setToken(saved);
    if (!saved) { setLoading(false); return; }
    Promise.all([
      fetch(apiUrl("/api/qpaynet/merchant/keys"), { headers: { Authorization: `Bearer ${saved}` } }).then(r => r.json()),
      fetch(apiUrl("/api/qpaynet/wallets"), { headers: { Authorization: `Bearer ${saved}` } }).then(r => r.json()),
    ]).then(([kd, wd]) => {
      setKeys(kd.keys ?? []);
      setWallets(wd.wallets ?? []);
      if (wd.wallets?.[0]) setNewKeyWallet(wd.wallets[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createKey() {
    if (!newKeyWallet) return;
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch(apiUrl("/api/qpaynet/merchant/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName || t("qpaynet.merchant.defaultKeyName"), walletId: newKeyWallet }),
      });
      const d = await r.json().catch(() => null);
      // Проверяем И код ответа, И что ключ действительно пришёл: без второго
      // условия в окно «ваш ключ» попадал бы undefined, а в список — запись
      // с пустым идентификатором.
      if (!r.ok || !d || !d.key) {
        setCreateError((d && (d.error || d.message)) || `Не удалось создать ключ (${r.status}).`);
        setCreating(false);
        return;
      }
      setCreatedKey(d.key);
      setKeys(prev => [{ id: d.id, name: d.name, key_prefix: d.keyPrefix, wallet_id: newKeyWallet, revoked_at: null, created_at: new Date().toISOString() }, ...prev]);
    } catch {
      // Обрыв связи тоже перестаёт быть тишиной: раньше исключение уходило
      // наружу необработанным, кнопка оставалась в состоянии «создаю».
      setCreateError("Не удалось связаться с сервером — ключ не создан.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm(t("qpaynet.merchant.confirmRevoke"))) return;
    setRevokeError(null);
    // apiUrl(), not a bare path: "/api/qpaynet/..." is answered by Next, which
    // has no such route — prod returns 404 there and 401 through the proxy.
    const r = await fetch(apiUrl(`/api/qpaynet/merchant/keys/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      // The list used to be marked revoked no matter what came back, so a
      // failed revoke looked exactly like a successful one — on an API key.
      setRevokeError(await failureText(r));
      return;
    }
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
            <div className="font-bold text-amber-300 mb-2">{t("qpaynet.merchant.keySaveTitle")}</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900 text-emerald-400 text-xs px-3 py-2 rounded-lg break-all font-mono">{createdKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-semibold">
                {copied ? "✓" : t("qpaynet.merchant.copy")}
              </button>
            </div>
            <p className="text-xs text-amber-600 mt-2">{t("qpaynet.merchant.keyOnce")}</p>
            <button onClick={() => setCreatedKey(null)} className="text-xs text-slate-500 hover:text-slate-300 underline mt-2">{t("qpaynet.merchant.close")}</button>
          </div>
        )}

        {/* Create new key */}
        {token && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <h2 className="font-bold mb-4">{t("qpaynet.merchant.createTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.merchant.keyNameLabel")}</label>
                <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                  placeholder={t("qpaynet.merchant.keyNamePlaceholder")}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.merchant.walletLabel")}</label>
                <select value={newKeyWallet} onChange={e => setNewKeyWallet(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {w.currency})</option>
                  ))}
                  {wallets.length === 0 && <option value="">{t("qpaynet.merchant.noWallets")}</option>}
                </select>
              </div>
            </div>
            {createError && (
              <div role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg px-3 py-2 mb-2">
                {createError}
              </div>
            )}
            <button onClick={createKey} disabled={creating || !newKeyWallet}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
              {creating ? t("qpaynet.merchant.creating") : t("qpaynet.merchant.createKey")}
            </button>
          </div>
        )}

        {/* Usage example */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-bold mb-3">{t("qpaynet.merchant.usageTitle")}</h2>
          <code className="block bg-slate-800 text-emerald-400 text-xs p-4 rounded-xl font-mono whitespace-pre overflow-x-auto">{`POST /api/qpaynet/merchant/charge
X-Api-Key: qpn_live_...

{
  "customerWalletId": "${t("qpaynet.merchant.codeCustomerId")}",
  "amount": 990,
  "description": "${t("qpaynet.merchant.codeDesc")}"
}`}</code>
        </div>

        {/* Webhook subscriptions (set-once) */}
        <WebhookSubs token={token} />

        {/* Webhook tester */}
        <WebhookTester token={token} />

        {/* Embed widget */}
        {wallets.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <h2 className="font-bold mb-1">{t("qpaynet.merchant.embedTitle")}</h2>
            <p className="text-xs text-slate-400 mb-3">
              {t("qpaynet.merchant.embedDesc")}
            </p>
            <code className="block bg-slate-800 text-violet-300 text-xs p-4 rounded-xl font-mono whitespace-pre-wrap break-all">{`<iframe
  src="https://aevion.app/qpaynet/widget/${wallets[0].id}?amount=990&desc=${t("qpaynet.merchant.embedDescParam")}"
  width="380" height="360" frameborder="0"
  style="border-radius:16px"
></iframe>`}</code>
            <p className="text-[11px] text-slate-500 mt-2">
              {t("qpaynet.merchant.embedParamsPre")} <code className="text-slate-400">amount</code>, <code className="text-slate-400">desc</code>, <code className="text-slate-400">compact=1</code> {t("qpaynet.merchant.embedParamsCompact")}
            </p>
          </div>
        )}

        {/* Keys list */}
        <div>
          <h2 className="font-bold mb-3">{t("qpaynet.merchant.keysTitle", { count: keys.length })}</h2>
          {loading && <div className="text-slate-500 text-sm py-4">{t("qpaynet.merchant.loading")}</div>}
          {!loading && keys.length === 0 && <div className="text-slate-600 text-sm py-4">{t("qpaynet.merchant.noKeys")}</div>}
          {revokeError && (
            <div role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900 rounded-xl px-3 py-2 mb-2">
              {revokeError}
            </div>
          )}
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className={`flex items-center justify-between p-3 rounded-xl border ${k.revoked_at ? "border-slate-800 opacity-50" : "border-slate-700 bg-slate-900"}`}>
                <div>
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{k.key_prefix}... · {t("qpaynet.merchant.createdAt")} {fmtDate(k.created_at, lang)}</div>
                </div>
                {k.revoked_at ? (
                  <span className="text-xs bg-red-900 text-red-400 px-2 py-1 rounded-full">{t("qpaynet.merchant.revoked")}</span>
                ) : (
                  <button onClick={() => revokeKey(k.id)}
                    className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg">
                    {t("qpaynet.merchant.revoke")}
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
  const { t } = useI18n();
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [subsError, setSubsError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(apiUrl("/api/qpaynet/webhook-subs"), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSubs(d.subscriptions ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return null;

  async function create() {
    if (!newUrl.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/qpaynet/webhook-subs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setSubsError(typeof d?.error === "string" ? `${d.error} (HTTP ${r.status})` : `HTTP ${r.status}`);
        return;
      }
      setSubs(prev => [{ id: d.id, url: d.url, events: d.events, revoked_at: null, created_at: new Date().toISOString() }, ...prev]);
      setCreatedSecret(d.secret);
      setNewUrl("");
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!confirm(t("qpaynet.merchant.subs.confirmRevoke"))) return;
    setSubsError(null);
    // Bare "/api/..." never reached the backend — see the note on revokeKey.
    const r = await fetch(apiUrl(`/api/qpaynet/webhook-subs/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      // Previously the button simply did nothing on failure, with no message.
      setSubsError(await failureText(r));
      return;
    }
    setSubs(prev => prev.map(s => s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s));
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
      <h2 className="font-bold mb-1">{t("qpaynet.merchant.subs.title")}</h2>
      <p className="text-xs text-slate-400 mb-3">
        {t("qpaynet.merchant.subs.descA")} <code>payment_request.paid</code> {t("qpaynet.merchant.subs.descB")} <code>notifyUrl</code>.
      </p>

      {createdSecret && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-3 mb-3">
          <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">{t("qpaynet.merchant.subs.secretTitle")}</div>
          <code className="text-xs text-amber-200 break-all block">{createdSecret}</code>
          <button onClick={() => setCreatedSecret(null)} className="text-[10px] text-amber-400/70 mt-2 hover:text-amber-300">{t("qpaynet.merchant.subs.hide")}</button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)}
          placeholder="https://your-site.kz/webhooks/qpaynet"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
        <button onClick={create} disabled={creating || !newUrl}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
          {creating ? "..." : t("qpaynet.merchant.subs.add")}
        </button>
      </div>

      {subsError && (
        <div role="alert" className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg px-3 py-2 mb-3">
          {subsError}
        </div>
      )}

      {loading && <div className="text-slate-500 text-xs">{t("qpaynet.merchant.subs.loading")}</div>}
      {!loading && subs.length === 0 && <div className="text-slate-600 text-xs">{t("qpaynet.merchant.subs.empty")}</div>}

      <div className="space-y-2">
        {subs.map(s => (
          <div key={s.id} className={`flex items-center justify-between p-2 rounded-lg border ${s.revoked_at ? "border-slate-800 opacity-50" : "border-slate-700 bg-slate-950"}`}>
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-xs font-mono text-slate-300 truncate">{s.url}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.events}</div>
            </div>
            {s.revoked_at ? (
              <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-full shrink-0">{t("qpaynet.merchant.subs.revoked")}</span>
            ) : (
              <button onClick={() => revoke(s.id)}
                className="text-[10px] px-2 py-1 bg-red-900 hover:bg-red-800 text-red-300 rounded shrink-0">
                {t("qpaynet.merchant.subs.revoke")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhookTester({ token }: { token: string }) {
  const { t } = useI18n();
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
      const r = await fetch(apiUrl("/api/qpaynet/webhooks/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim(), secret: secret.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setResult({ ok: false, deliveryStatus: 0, error: d.error, hint: t("qpaynet.merchant.test.validationFailed"), payloadSent: null });
      } else {
        setResult(d);
      }
    } finally { setRunning(false); }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
      <h2 className="font-bold mb-1">{t("qpaynet.merchant.test.title")}</h2>
      <p className="text-xs text-slate-400 mb-3">
        {t("qpaynet.merchant.test.desc")}
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
          {running ? t("qpaynet.merchant.test.sending") : t("qpaynet.merchant.test.send")}
        </button>
      </div>
      {result && (
        <div className={`mt-3 p-3 rounded-lg border text-xs ${result.ok ? "border-emerald-800 bg-emerald-950/30" : "border-red-800 bg-red-950/30"}`}>
          <div className={`font-semibold mb-1 ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
            {result.ok ? t("qpaynet.merchant.test.delivered") : t("qpaynet.merchant.test.failed")}
            {result.deliveryStatus > 0 && <span className="ml-2 text-slate-400 font-mono">HTTP {result.deliveryStatus}</span>}
          </div>
          <div className="text-slate-300">{result.hint}</div>
          {result.error && <div className="text-red-300/80 mt-1 font-mono break-all">{result.error}</div>}
        </div>
      )}
    </div>
  );
}
