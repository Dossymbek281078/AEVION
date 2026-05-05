"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DocItem {
  id: string;
  title: string;
  contentType: string;
  maxViews: number | null;
  viewCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  hasPassword: boolean;
  expired: boolean;
  shareUrl: string;
  createdAt: string;
}

function StatusBadge({ doc }: { doc: DocItem }) {
  if (doc.revokedAt) return <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Отозван</span>;
  if (doc.expired) return <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Истёк</span>;
  return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Активен</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function QContractHome() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    fetch("/api/qcontract/documents", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function revoke(id: string) {
    if (!confirm("Отозвать документ? Ссылка перестанет работать немедленно.")) return;
    setRevoking(id);
    await fetch(`/api/qcontract/documents/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, revokedAt: new Date().toISOString(), expired: true } : d));
    setRevoking(null);
  }

  async function extend(id: string) {
    const days = prompt("Продлить на сколько дней?", "7");
    const n = parseInt(days ?? "");
    if (!n || n < 1 || n > 365) return;
    const r = await fetch(`/api/qcontract/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ extendDays: n }),
    });
    if (!r.ok) return;
    const d = await r.json();
    setDocs((prev) => prev.map((x) => x.id === id ? { ...x, expiresAt: d.expires_at } : x));
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-red-500 font-black text-lg tracking-tight">Q</span>
          <span className="font-bold text-white">Contract</span>
          <span className="text-[10px] bg-red-900 text-red-300 px-2 py-0.5 rounded-full">BETA</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-400 hover:text-white">← AEVION</Link>
          <Link
            href="/qcontract/create"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Создать документ
          </Link>
        </div>
      </header>

      {/* Hero */}
      {!token && (
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="text-6xl mb-6">💣</div>
          <h1 className="text-4xl font-black mb-4">Документы, которые<br />сами себя уничтожают</h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Отправьте секретный документ. Установите лимит просмотров или срок действия.<br />
            После — он исчезнет навсегда. Никаких следов.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-10">
            {[
              ["🔒", "Пароль на доступ"],
              ["👁", "Лимит просмотров"],
              ["⏱", "Срок действия"],
              ["📊", "Лог просмотров"],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 px-4 py-2 rounded-xl">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <Link
            href="/qcontract/create"
            className="inline-block px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-base font-bold rounded-xl transition-colors"
          >
            Создать саморазрушающийся документ →
          </Link>
          <p className="text-xs text-slate-600 mt-4">Требуется авторизация AEVION</p>
        </div>
      )}

      {/* Dashboard */}
      {token && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold">Мои документы</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {docs.length} всего · {docs.filter(d => !d.expired).length} активных · {docs.filter(d => d.expired).length} истёкших
              </p>
            </div>
            <Link
              href="/qcontract/create"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
            >
              + Создать
            </Link>
          </div>

          {/* Search bar */}
          {docs.length > 0 && (
            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Поиск по названию документа..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          )}

          {loading && (
            <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>
          )}

          {!loading && docs.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-sm">Документов пока нет.</p>
              <Link href="/qcontract/create" className="text-red-400 hover:text-red-300 text-sm underline mt-2 inline-block">
                Создать первый →
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {docs.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase())).map((doc) => (
              <div
                key={doc.id}
                className={`border rounded-xl p-4 transition-colors ${
                  doc.expired ? "border-slate-800 bg-slate-900/30 opacity-60" : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge doc={doc} />
                      {doc.hasPassword && <span className="text-[10px] text-slate-400">🔒 Пароль</span>}
                      {doc.contentType === "url" && <span className="text-[10px] text-slate-400">🔗 URL</span>}
                    </div>
                    <h3 className="font-semibold text-white truncate">{doc.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                      <span>👁 {doc.viewCount}{doc.maxViews ? `/${doc.maxViews}` : ""} просмотров</span>
                      {doc.expiresAt && <span>⏱ до {formatDate(doc.expiresAt)}</span>}
                      <span>📅 {formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!doc.expired && (
                      <>
                        <button
                          onClick={() => copyLink(doc.shareUrl, doc.id)}
                          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          {copied === doc.id ? "✓ Скопировано" : "Ссылка"}
                        </button>
                        <Link
                          href={`/qcontract/documents/${doc.id}/log`}
                          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          Лог
                        </Link>
                        {doc.expiresAt && (
                          <button
                            onClick={() => extend(doc.id)}
                            title="Продлить срок действия"
                            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            ⏱ Продлить
                          </button>
                        )}
                        <button
                          onClick={() => revoke(doc.id)}
                          disabled={revoking === doc.id}
                          className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {revoking === doc.id ? "..." : "Отозвать"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats footer */}
      <QContractStats />
    </div>
  );
}

function QContractStats() {
  const [stats, setStats] = useState<{ totalDocuments: number; totalViews: number } | null>(null);
  useEffect(() => {
    fetch("/api/qcontract/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);
  if (!stats) return null;
  return (
    <div className="border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-8 text-xs text-slate-600">
      <span>{stats.totalDocuments} документов создано</span>
      <span>·</span>
      <span>{stats.totalViews} просмотров зафиксировано</span>
    </div>
  );
}
