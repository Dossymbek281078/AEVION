"use client";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";
import MvpConceptBoard from "@/components/MvpConceptBoard";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductNotice } from "@/components/ProductNotice";
import ModulePricingChip from "@/components/ModulePricingChip";
import { useI18n } from "@/lib/i18n";

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

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function StatusBadge({ doc, t }: { doc: DocItem; t: TFn }) {
  if (doc.revokedAt) return <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{t("qcontract.home.status.revoked")}</span>;
  if (doc.expired) return <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{t("qcontract.home.status.expired")}</span>;
  return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{t("qcontract.home.status.active")}</span>;
}

function formatDate(iso: string, lang: string) {
  // ru / kk locales use the same "ru-RU" day-month-year ordering; en flips
  const localeTag = lang === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
}

export default function QContractHome() {
  const { t, lang } = useI18n();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  // Отказ отзыва раньше не показывался никак: ответ сервера не проверялся,
  // и документ помечался отозванным в списке даже когда сервер отказал.
  // Человек считал отзыв состоявшимся и мог на это положиться. То же самое
  // было на странице документа — починено отдельно.
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = getAuthToken() ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    fetch(apiUrl("/api/qcontract/documents"), { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function revoke(id: string) {
    if (!confirm(t("qcontract.home.confirm.revoke"))) return;
    setRevoking(id);
    setRevokeError(null);
    try {
      const r = await fetch(apiUrl(`/api/qcontract/documents/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setRevokeError((d && (d.error || d.message)) || `Отозвать не удалось (${r.status}). Документ действует.`);
        setRevoking(null);
        return;
      }
      setDocs((prev) => prev.map((d) => d.id === id ? { ...d, revokedAt: new Date().toISOString(), expired: true } : d));
    } catch {
      setRevokeError("Не удалось связаться с сервером — документ НЕ отозван.");
    } finally {
      setRevoking(null);
    }
  }

  async function extend(id: string) {
    const days = prompt(t("qcontract.home.prompt.extend"), "7");
    const n = parseInt(days ?? "");
    if (!n || n < 1 || n > 365) return;
    const r = await fetch(apiUrl(`/api/qcontract/documents/${id}`), {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QContract",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, iOS, Android",
            description:
              "Self-destruct smart documents: burn-after-N-reads, time expiry, password gate, email-watermark, audit log, QRight cert.",
            url: "https://aevion.app/qcontract",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Burn after N reads",
              "Time-based expiry",
              "Password gate",
              "Email watermark",
              "Audit log (CSV export)",
              "QRight legal cert",
              "Public share link with revoke",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />
      {/* Header */}
      <header className="border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-red-500 font-black text-lg tracking-tight">Q</span>
          <span className="font-bold text-white">Contract</span>
          <span className="text-[10px] bg-red-900 text-red-300 px-2 py-0.5 rounded-full">BETA</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="text-xs text-slate-400 hover:text-white px-2 py-1.5">{t("qcontract.home.back")}</Link>
          <Link
            href="/qcontract/create"
            className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors min-h-[36px] inline-flex items-center"
          >
            <span className="sm:hidden">{t("qcontract.home.new.short")}</span>
            <span className="hidden sm:inline">{t("qcontract.home.new.long")}</span>
          </Link>
        </div>
      </header>

      {/* Pricing chip */}
      <div className="border-b border-slate-800 px-4 sm:px-6 py-2 flex justify-end">
        <ModulePricingChip moduleId="qcontract" theme="dark" />
      </div>

      {/* Оговорка каталога — там, где даются обещания, а не только у цены. */}
      <div className="px-4 sm:px-6 pt-4">
        <ProductNotice productId="qcontract" theme="dark" />
      </div>

      {/* Hero */}
      {!token && (
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="text-6xl mb-6">💣</div>
          <h1 className="text-4xl font-black mb-4">{t("qcontract.home.hero.title")}</h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            {t("qcontract.home.hero.body")}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-10">
            {[
              ["🔒", t("qcontract.home.hero.feat.password")],
              ["👁", t("qcontract.home.hero.feat.views")],
              ["⏱", t("qcontract.home.hero.feat.expiry")],
              ["📊", t("qcontract.home.hero.feat.log")],
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
            {t("qcontract.home.hero.cta")}
          </Link>
          <p className="text-xs text-slate-600 mt-4">{t("qcontract.home.hero.auth_required")}</p>
        </div>
      )}

      {/* Dashboard */}
      {token && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold">{t("qcontract.home.dash.title")}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("qcontract.home.dash.summary", {
                  total: docs.length,
                  active: docs.filter(d => !d.expired).length,
                  expired: docs.filter(d => d.expired).length,
                })}
              </p>
            </div>
            <Link
              href="/qcontract/create"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
            >
              {t("qcontract.home.dash.new")}
            </Link>
          </div>

          {/* Search bar */}
          {docs.length > 0 && (
            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("qcontract.home.dash.search")}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          )}

          {loading && (
            <div className="space-y-3 animate-pulse" aria-label={t("qcontract.home.dash.loading")} role="status">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border border-slate-800 rounded-xl p-4 bg-slate-900/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-16 bg-slate-800 rounded" />
                      <div className="h-5 w-3/4 bg-slate-800 rounded" />
                      <div className="h-3 w-1/2 bg-slate-800 rounded" />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <div className="h-7 w-16 bg-slate-800 rounded" />
                      <div className="h-7 w-12 bg-slate-800 rounded" />
                      <div className="h-7 w-16 bg-slate-800 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {revokeError && (
            <div role="alert" className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-lg px-3 py-2 text-sm">
              {revokeError}
            </div>
          )}

          {!loading && docs.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-sm">{t("qcontract.home.dash.empty")}</p>
              <Link href="/qcontract/create" className="text-red-400 hover:text-red-300 text-sm underline mt-2 inline-block">
                {t("qcontract.home.dash.create_first")}
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
                      <StatusBadge doc={doc} t={t} />
                      {doc.hasPassword && <span className="text-[10px] text-slate-400">{t("qcontract.home.doc.password_label")}</span>}
                      {doc.contentType === "url" && <span className="text-[10px] text-slate-400">🔗 URL</span>}
                    </div>
                    <h3 className="font-semibold text-white truncate">{doc.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                      <span>{t("qcontract.home.doc.views", { viewed: doc.viewCount, cap: doc.maxViews ? `/${doc.maxViews}` : "" })}</span>
                      {doc.expiresAt && <span>{t("qcontract.home.doc.until", { date: formatDate(doc.expiresAt, lang) })}</span>}
                      <span>📅 {formatDate(doc.createdAt, lang)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                    {!doc.expired && (
                      <>
                        <button
                          onClick={() => copyLink(doc.shareUrl, doc.id)}
                          className="text-xs px-3 py-2 sm:py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors min-h-[36px]"
                          aria-label={copied === doc.id ? t("qcontract.home.doc.copy_aria_done") : t("qcontract.home.doc.copy_aria")}
                        >
                          {copied === doc.id ? t("qcontract.home.doc.copied") : t("qcontract.home.doc.copy")}
                        </button>
                        <Link
                          href={`/qcontract/documents/${doc.id}/log`}
                          className="text-xs px-3 py-2 sm:py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors min-h-[36px] inline-flex items-center justify-center"
                        >
                          {t("qcontract.home.doc.log")}
                        </Link>
                        {doc.expiresAt && (
                          <button
                            onClick={() => extend(doc.id)}
                            title={t("qcontract.home.doc.extend_title")}
                            aria-label={t("qcontract.home.doc.extend_aria")}
                            className="text-xs px-3 py-2 sm:py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors min-h-[36px]"
                          >
                            {t("qcontract.home.doc.extend")}
                          </button>
                        )}
                        <button
                          onClick={() => revoke(doc.id)}
                          disabled={revoking === doc.id}
                          aria-label={t("qcontract.home.doc.revoke_aria")}
                          className="text-xs px-3 py-2 sm:py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg transition-colors disabled:opacity-40 min-h-[36px]"
                        >
                          {revoking === doc.id ? "..." : t("qcontract.home.doc.revoke")}
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

      <div className="max-w-5xl mx-auto px-6 pb-10">
        <MvpConceptBoard
          moduleId="qcontract"
          noun="concept/messages"
          accent="violet"
          sectionTitle={t("qcontract.home.cb.title")}
          sectionHint={t("qcontract.home.cb.hint")}
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: t("qcontract.home.cb.idea_label"), placeholder: t("qcontract.home.cb.idea_ph"), required: true },
            { key: "rationale", label: t("qcontract.home.cb.rationale_label"), type: "textarea", placeholder: t("qcontract.home.cb.rationale_ph") },
            { key: "author", label: t("qcontract.home.cb.author_label"), placeholder: "anon" },
          ]}
        />
      </div>

      {/* Stats footer */}
      <QContractStats t={t} />
    </div>
  );
}

function QContractStats({ t }: { t: TFn }) {
  const [stats, setStats] = useState<{ totalDocuments: number; totalViews: number } | null>(null);
  useEffect(() => {
    // fetch does not reject on a non-2xx status: without the r.ok check the error
    // body becomes `stats`, which is truthy, and the block renders "undefined".
    fetch(apiUrl("/api/qcontract/stats"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats unavailable"))))
      .then(setStats)
      .catch(() => {});
  }, []);
  if (!stats) return null;
  return (
    <div className="border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-8 text-xs text-slate-600">
      <span>{t("qcontract.home.stats.docs", { n: stats.totalDocuments })}</span>
      <span>·</span>
      <span>{t("qcontract.home.stats.views", { n: stats.totalViews })}</span>
    </div>
  );
}
