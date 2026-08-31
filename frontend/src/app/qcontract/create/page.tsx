"use client";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type ContentType = "text" | "url" | "html";
type SelfDestructMode = "views" | "time" | "both" | "none";

interface Template {
  id: string;
  title: string;
  description: string;
  contentType: ContentType;
}

export default function CreateDocument() {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [destructMode, setDestructMode] = useState<SelfDestructMode>("none");
  const [maxViews, setMaxViews] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [requireSignature, setRequireSignature] = useState(false);
  const [qrightId, setQrightId] = useState("");
  const [useQright, setUseQright] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ shareUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/qcontract/templates"))
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  async function applyTemplate(id: string) {
    const res = await fetch(apiUrl(`/api/qcontract/templates/${id}`));
    const t = await res.json();
    setTitle(t.title);
    setContent(t.content);
    setContentType(t.contentType);
    setShowTemplates(false);
  }

  async function handleCreate() {
    const token = getAuthToken() ?? "";
    if (!token) { setError(t("qcontract.create.error.auth_required")); return; }
    if (!title.trim()) { setError(t("qcontract.create.error.title_required")); return; }
    if (!content.trim()) { setError(t("qcontract.create.error.content_required")); return; }

    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { title, content, contentType };
      if (destructMode === "views" || destructMode === "both") body.maxViews = maxViews;
      if ((destructMode === "time" || destructMode === "both") && expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      if (usePassword && password) body.password = password;
      if (requireSignature) body.requireSignature = true;
      if (useQright && qrightId.trim()) body.qrightId = qrightId.trim();

      const res = await fetch(apiUrl("/api/qcontract/documents"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("qcontract.create.error.generic"));
      setResult({ shareUrl: data.shareUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qcontract.create.error.generic"));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">💣</div>
            <h1 className="text-2xl font-black mb-2">{t("qcontract.create.done.title")}</h1>
            <p className="text-slate-400 text-sm">{t("qcontract.create.done.body")}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">{t("qcontract.create.done.link_label")}</label>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 bg-slate-800 text-emerald-400 text-xs px-3 py-2 rounded-lg break-all">{result.shareUrl}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(result.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                >
                  {copied ? "✓" : t("qcontract.create.done.copy")}
                </button>
              </div>
            </div>
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-300">
              {t("qcontract.create.done.warn")}
            </div>
            <div className="flex gap-3 pt-2">
              <Link href="/qcontract" className="flex-1 text-center py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">{t("qcontract.create.done.to_dashboard")}</Link>
              <button onClick={() => { setResult(null); setTitle(""); setContent(""); setCopied(false); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors">{t("qcontract.create.done.another")}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/qcontract" className="text-slate-400 hover:text-white text-sm">{t("qcontract.create.header.back")}</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">{t("qcontract.create.header.title")}</h1>
        </div>
        {templates.length > 0 && (
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300"
          >
            {t("qcontract.create.header.templates")}
          </button>
        )}
      </header>

      {/* Templates panel */}
      {showTemplates && (
        <div className="border-b border-slate-800 bg-slate-900 px-6 py-4">
          <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">{t("qcontract.create.templates_heading")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="text-left p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
              >
                <div className="text-sm font-semibold text-white">{t.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("qcontract.create.field.title_label")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t("qcontract.create.field.title_label")}
            placeholder={t("qcontract.create.field.title_ph")}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* Content type */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("qcontract.create.field.type_label")}</label>
          <div className="flex gap-2">
            {([
              ["text", t("qcontract.create.field.type.text")],
              ["url", "🔗 URL"],
              ["html", t("qcontract.create.field.type.html")],
            ] as const).map(([key, l]) => (
              <button key={key} onClick={() => setContentType(key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${contentType === key ? "bg-red-600 border-red-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {contentType === "url" ? "URL" : t("qcontract.create.field.content_label")}
          </label>
          {contentType === "url" ? (
            <input type="url" value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="https://docs.google.com/..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors" />
          ) : (
            <textarea aria-label={t("qcontract.create.field.content_label")} rows={9} value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={contentType === "html" ? t("qcontract.create.field.content_ph.html") : t("qcontract.create.field.content_ph.text")}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors resize-none font-mono text-sm" />
          )}
        </div>

        {/* Self-destruct */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("qcontract.create.destruct.label")}</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              ["none", t("qcontract.create.destruct.none")],
              ["views", t("qcontract.create.destruct.views")],
              ["time", t("qcontract.create.destruct.time")],
              ["both", t("qcontract.create.destruct.both")],
            ] as const).map(([m, l]) => (
              <button key={m} onClick={() => setDestructMode(m as SelfDestructMode)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors border ${destructMode === m ? "bg-red-900 border-red-600 text-red-200" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                {l}
              </button>
            ))}
          </div>
          {(destructMode === "views" || destructMode === "both") && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-2">
              <label className="text-xs text-slate-400 mb-2 block">{t("qcontract.create.destruct.max_views")}</label>
              <div className="flex gap-2 flex-wrap">
                {[1,3,5,10].map((n) => (
                  <button key={n} onClick={() => setMaxViews(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${maxViews === n ? "bg-red-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                    {n === 1 ? t("qcontract.create.destruct.one_time") : `${n}×`}
                  </button>
                ))}
                <input type="number" min={1} value={maxViews} onChange={(e) => setMaxViews(Math.max(1, parseInt(e.target.value)||1))}
                  className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-red-500" />
              </div>
            </div>
          )}
          {(destructMode === "time" || destructMode === "both") && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <label className="text-xs text-slate-400 mb-2 block">{t("qcontract.create.destruct.expires_label")}</label>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full" />
            </div>
          )}
        </div>

        {/* Security options */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("qcontract.create.sec.label")}</label>

          {/* Password */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="w-4 h-4 accent-red-500" />
              <span className="text-sm font-medium">{t("qcontract.create.sec.password")}</span>
            </label>
            {usePassword && (
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t("qcontract.create.sec.password_ph")}
                className="mt-3 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500" />
            )}
          </div>

          {/* Signature */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={requireSignature} onChange={(e) => setRequireSignature(e.target.checked)} className="w-4 h-4 accent-red-500" />
              <div>
                <span className="text-sm font-medium">{t("qcontract.create.sec.signature")}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{t("qcontract.create.sec.signature_hint")}</p>
              </div>
            </label>
          </div>

          {/* QRight */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={useQright} onChange={(e) => setUseQright(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
              <div>
                <span className="text-sm font-medium">{t("qcontract.create.sec.qright")}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{t("qcontract.create.sec.qright_hint")}</p>
              </div>
            </label>
            {useQright && (
              <input type="text" value={qrightId} onChange={(e) => setQrightId(e.target.value)}
                placeholder={t("qcontract.create.sec.qright_ph")}
                className="mt-3 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500" />
            )}
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>}

        <button
          onClick={handleCreate}
          disabled={loading || !title.trim() || !content.trim()}
          className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors"
        >
          {loading ? t("qcontract.create.submit.loading") : t("qcontract.create.submit.cta")}
        </button>
      </div>
    </div>
  );
}
