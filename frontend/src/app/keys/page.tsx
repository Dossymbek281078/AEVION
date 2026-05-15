"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: "test" | "live";
  tier: string;
  callsThisMonth: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
  active: boolean;
  createdAt: string;
}

interface NewKeyResult {
  id: string;
  name: string;
  key: string;
  prefix: string;
  env: string;
  monthlyLimit: number;
}

interface KeyUsage {
  id: string;
  callsThisMonth: number;
  monthlyLimit: number | null;
  monthlyLimitDisplay: string;
  percentUsed: number;
  remaining: number | null;
  rateLimitPerMinute: number | null;
  tier: string;
  resetAt: string;
  daysUntilReset: number;
}

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_auth_token_v1") ?? localStorage.getItem("aevion_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"test" | "live">("test");
  const [hasAuth, setHasAuth] = useState(true);
  // Inline rename state — { keyId: draftName } when actively editing
  const [renameDraft, setRenameDraft] = useState<{ id: string; value: string } | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  // Per-key usage cache. Lazy-loaded when the user expands a key card.
  const [usageById, setUsageById] = useState<Record<string, KeyUsage>>({});
  const [usageLoading, setUsageLoading] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const t = localStorage.getItem("aevion_auth_token_v1") ?? localStorage.getItem("aevion_token") ?? "";
      if (!t) { setHasAuth(false); setLoading(false); return; }
      const r = await fetch(apiUrl("/api/keys"), { headers: authHeader() });
      if (r.status === 401) { setHasAuth(false); setLoading(false); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setKeys(d.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createKey() {
    if (!name.trim() || name.length > 80) { setError("Имя ключа: 1-80 символов"); return; }
    setCreating(true); setError("");
    try {
      const r = await fetch(apiUrl("/api/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ name: name.trim(), env }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? d.error ?? `HTTP ${r.status}`);
      setNewKey(d);
      setShowCreate(false);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Отозвать API-ключ? Это действие необратимо.")) return;
    try {
      const r = await fetch(apiUrl(`/api/keys/${id}`), { method: "DELETE", headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отзыва");
    }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.key).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  }

  async function saveRename(id: string) {
    if (!renameDraft || renameDraft.id !== id) return;
    const trimmed = renameDraft.value.trim();
    if (!trimmed || trimmed.length > 80) { setError("Имя ключа: 1-80 символов"); return; }
    setRenameSaving(true); setError("");
    try {
      const r = await fetch(apiUrl(`/api/keys/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ name: trimmed }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message ?? d.error ?? `HTTP ${r.status}`);
      // Optimistically patch the row in place so the UI updates without a full reload
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, name: trimmed } : k)));
      setRenameDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переименовать");
    } finally {
      setRenameSaving(false);
    }
  }

  async function loadUsage(id: string) {
    if (usageLoading[id]) return;
    setUsageLoading((s) => ({ ...s, [id]: true }));
    try {
      const r = await fetch(apiUrl(`/api/keys/${id}/usage`), { headers: authHeader() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setUsageById((s) => ({ ...s, [id]: d }));
    } catch (e) {
      // Surface inline only — don't blow up the page
      console.error("[keys] usage load failed", e);
    } finally {
      setUsageLoading((s) => ({ ...s, [id]: false }));
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!usageById[id]) void loadUsage(id);
  }

  if (!hasAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-xl font-bold mb-2">Войдите чтобы управлять ключами</h1>
          <p className="text-slate-400 text-sm mb-6">
            API-ключи AEVION привязаны к вашему аккаунту. Войдите чтобы создавать и просматривать ключи.
          </p>
          <Link
            href={`/auth?redirect=${encodeURIComponent("/keys")}`}
            className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-semibold text-sm transition-colors"
          >
            → Войти в AEVION
          </Link>
        </div>
      </div>
    );
  }

  // New key reveal screen
  if (newKey) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
          <Link href="/keys" onClick={() => setNewKey(null)} className="text-slate-400 hover:text-white text-sm">← Ключи</Link>
        </header>
        <div className="max-w-lg mx-auto px-6 py-10">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔑</div>
            <h1 className="text-2xl font-black mb-1">Ключ создан</h1>
            <p className="text-slate-400 text-sm">
              <strong className="text-amber-300">Сохраните его сейчас</strong> — он показывается только один раз
            </p>
          </div>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 mb-4 text-sm text-amber-200">
            ⚠ Этот ключ больше нельзя будет посмотреть. Сохраните его в безопасном месте (1Password, .env).
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{newKey.name}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-800 text-emerald-400 text-xs px-3 py-3 rounded-lg break-all font-mono">
                {newKey.key}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold transition-colors"
              >
                {keyCopied ? "✓" : "Скопировать"}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
              <span>env: <strong className="text-white">{newKey.env}</strong></span>
              <span>·</span>
              <span>лимит: {newKey.monthlyLimit.toLocaleString("ru-RU")}/мес</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 mb-6">
            <p className="font-semibold text-slate-400 mb-2">Как использовать:</p>
            <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-300">
{`curl https://api.aevion.app/api/quotas \\
  -H "Authorization: Bearer ${newKey.prefix}…"`}
            </pre>
          </div>

          <button
            onClick={() => setNewKey(null)}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-semibold text-sm transition-colors"
          >
            Готово — я сохранил ключ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← AEVION</Link>
          <span className="text-slate-700">·</span>
          <h1 className="text-sm font-bold">API-ключи</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold transition-colors"
        >
          + Создать ключ
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-slate-400 text-sm leading-relaxed">
            API-ключи дают доступ к платформенным эндпойнтам AEVION (QRight, QSign, Bureau, QPayNet, QCoreAI и др.).
            Формат: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-400">aev_test_</code>… или{" "}
            <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-400">aev_live_</code>…
          </p>
          <div className="mt-3 flex gap-3 text-xs">
            <Link href="/developers" className="text-violet-400 hover:underline">📚 API docs</Link>
            <Link href="/pricing/api-pricing" className="text-violet-400 hover:underline">💎 Тарифы</Link>
            <Link href="/qcoreai/budget" className="text-violet-400 hover:underline">📊 Бюджет</Link>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-slate-900 border border-violet-700/40 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-bold mb-3">Новый ключ</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Имя ключа</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production backend, mobile-app, ..."
                  maxLength={80}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Окружение</label>
                <div className="flex gap-2">
                  {(["test", "live"] as const).map((e) => (
                    <button
                      key={e}
                      onClick={() => setEnv(e)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                        env === e
                          ? e === "live" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-amber-600 border-amber-500 text-white"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {e === "test" ? "🧪 Test" : "🚀 Live"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {env === "test" ? "Test-режим: безопасно для разработки, не учитывается в биллинге" : "Live-режим: реальные операции, учитывается в биллинге"}
                </p>
              </div>
              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={createKey}
                  disabled={creating || !name.trim()}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl text-sm font-bold transition-colors"
                >
                  {creating ? "Создание…" : "Создать"}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setName(""); setError(""); }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keys list */}
        {loading && <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Загрузка…</div>}

        {!loading && keys.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🔑</div>
            <p className="text-sm">У вас пока нет API-ключей</p>
            <p className="text-xs text-slate-600 mt-2">
              Developer-tier: до 3 активных ключей бесплатно, 10K запросов/мес
            </p>
          </div>
        )}

        <div className="space-y-3">
          {keys.map((k) => {
            const activeRename = renameDraft && renameDraft.id === k.id ? renameDraft : null;
            const isRenaming = activeRename !== null;
            const isExpanded = expandedId === k.id;
            const usage = usageById[k.id];
            return (
              <div
                key={k.id}
                className={`bg-slate-900 border rounded-2xl p-4 ${
                  k.active ? "border-slate-700" : "border-slate-800 opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {activeRename ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={activeRename.value}
                            autoFocus
                            maxLength={80}
                            onChange={(e) => setRenameDraft({ id: k.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveRename(k.id);
                              if (e.key === "Escape") setRenameDraft(null);
                            }}
                            className="flex-1 min-w-0 bg-slate-800 border border-violet-600 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-400"
                            placeholder="Новое имя ключа"
                          />
                          <button
                            onClick={() => void saveRename(k.id)}
                            disabled={renameSaving || !activeRename.value.trim()}
                            className="text-xs px-3 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg font-semibold transition-colors"
                            title="Сохранить"
                          >
                            {renameSaving ? "…" : "Сохранить"}
                          </button>
                          <button
                            onClick={() => setRenameDraft(null)}
                            className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                            title="Отмена"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-bold text-white text-sm">{k.name}</h3>
                          {k.active && (
                            <button
                              onClick={() => setRenameDraft({ id: k.id, value: k.name })}
                              className="text-[11px] text-slate-500 hover:text-violet-400 transition-colors"
                              title="Переименовать"
                              aria-label="Переименовать ключ"
                            >
                              ✎ rename
                            </button>
                          )}
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            k.env === "live"
                              ? "bg-emerald-900/40 border-emerald-700/40 text-emerald-300"
                              : "bg-amber-900/40 border-amber-700/40 text-amber-300"
                          }`}>{k.env}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">
                            {k.tier}
                          </span>
                          {!k.active && <span className="text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full border border-red-800/40">Отозван</span>}
                        </>
                      )}
                    </div>
                    {!isRenaming && <code className="text-xs text-slate-400 font-mono">{k.prefix}</code>}
                  </div>
                  {k.active && !isRenaming && (
                    <button
                      onClick={() => revokeKey(k.id)}
                      className="shrink-0 text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800/40 rounded-lg text-red-300 transition-colors"
                    >
                      Отозвать
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 flex-wrap">
                  <button
                    onClick={() => toggleExpand(k.id)}
                    className="hover:text-violet-400 transition-colors"
                    title="Показать квоту и лимиты"
                  >
                    📊 {k.callsThisMonth.toLocaleString("ru-RU")} запросов в этом месяце {isExpanded ? "▲" : "▼"}
                  </button>
                  <span>·</span>
                  <span>Создан {fmtDate(k.createdAt)}</span>
                  {k.lastUsedAt && (
                    <>
                      <span>·</span>
                      <span>последний раз {fmtDate(k.lastUsedAt)}</span>
                    </>
                  )}
                </div>

                {/* Expanded usage meter — lazy-loaded on first click */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    {usageLoading[k.id] && !usage && (
                      <div className="text-xs text-slate-500 animate-pulse">Загрузка статистики…</div>
                    )}
                    {usage && (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-400">
                            Квота {usage.tier}-тарифа
                          </span>
                          <span className="text-xs font-mono text-slate-300">
                            {usage.callsThisMonth.toLocaleString("ru-RU")}
                            <span className="text-slate-600"> / </span>
                            <span className="text-slate-400">{usage.monthlyLimitDisplay}</span>
                          </span>
                        </div>
                        {usage.monthlyLimit !== null && (
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                usage.percentUsed >= 90
                                  ? "bg-red-500"
                                  : usage.percentUsed >= 70
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.max(2, Math.min(100, usage.percentUsed))}%` }}
                              aria-valuenow={usage.percentUsed}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              role="progressbar"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                          <span>
                            {usage.monthlyLimit === null
                              ? "Без лимита (Enterprise)"
                              : `${usage.percentUsed.toFixed(1)}% использовано · осталось ${(usage.remaining ?? 0).toLocaleString("ru-RU")}`}
                          </span>
                          <span>
                            {usage.rateLimitPerMinute !== null && (
                              <>⚡ {usage.rateLimitPerMinute}/мин · </>
                            )}
                            🔄 сброс через {usage.daysUntilReset}д
                          </span>
                        </div>
                        {usage.percentUsed >= 80 && usage.monthlyLimit !== null && (
                          <div className="mt-2 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2 text-[11px] text-amber-200 flex items-center justify-between gap-2 flex-wrap">
                            <span>⚠ Близко к лимиту тарифа</span>
                            <Link href="/pricing/api-pricing" className="font-semibold underline hover:text-amber-100">
                              Апгрейд →
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && !showCreate && (
          <div className="mt-4 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
