"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface DocMeta {
  id: string;
  title: string;
  contentType: string;
  maxViews: number | null;
  viewCount: number;
  expiresAt: string | null;
  hasPassword: boolean;
  requireSignature: boolean;
  qrightId: string | null;
  expired: boolean;
}

interface DocContent {
  title: string;
  content: string;
  contentType: string;
  viewCount: number;
  maxViews: number | null;
  expiresAt: string | null;
  qrightId: string | null;
  viewerEmail: string | null;
  selfDestructed: boolean;
}

function CountdownTimer({ expiresAt, t }: { expiresAt: string; t: TFn }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(t("qcontract.viewer.countdown.expired")); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt, t]);
  return <span className="font-mono text-amber-400">{remaining}</span>;
}

function WatermarkOverlay({ email, ip, t }: { email?: string | null; ip?: string; t: TFn }) {
  const text = email ?? ip ?? t("qcontract.viewer.watermark.default");
  const lines = Array.from({ length: 8 }, () => text).join("    ");
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      style={{ zIndex: 10 }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="text-[11px] text-slate-400 whitespace-nowrap absolute w-full"
          style={{
            top: `${i * 8}%`,
            opacity: 0.07,
            transform: "rotate(-25deg)",
            transformOrigin: "left center",
            letterSpacing: "0.1em",
          }}
        >
          {lines}
        </div>
      ))}
    </div>
  );
}

function QRightBadge({ qrightId, t }: { qrightId: string; t: TFn }) {
  return (
    <Link
      href={`/qright/${qrightId}`}
      target="_blank"
      className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 px-2.5 py-1 rounded-full hover:bg-emerald-900/70 transition-colors"
    >
      {t("qcontract.viewer.qright_badge", { id: qrightId.slice(0, 8) })}
    </Link>
  );
}

export default function ViewDocument() {
  const { t, lang } = useI18n();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [content, setContent] = useState<DocContent | null>(null);
  const [password, setPassword] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");
  const [stage, setStage] = useState<"loading" | "password" | "signature" | "both" | "content" | "expired" | "error">("loading");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadContent = useCallback(async (pw?: string, email?: string) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/qcontract/view/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, viewerEmail: email }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === "wrong_password") { setError(t("qcontract.viewer.error.wrong_password")); return; }
        if (d.error === "signature_required") { setStage("signature"); return; }
        if (d.error === "document_expired") { setStage("expired"); return; }
        setError(d.error ?? t("qcontract.viewer.error.generic")); setStage("error"); return;
      }
      setContent(d);
      setStage("content");
    } catch {
      setError(t("qcontract.viewer.error.load")); setStage("error");
    } finally {
      setSubmitting(false);
    }
  }, [token, t]);

  useEffect(() => {
    fetch(apiUrl(`/api/qcontract/view/${token}`))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setStage("error"); return; }
        setMeta(d);
        if (d.expired) { setStage("expired"); return; }
        if (d.hasPassword && d.requireSignature) { setStage("both"); return; }
        if (d.hasPassword) { setStage("password"); return; }
        if (d.requireSignature) { setStage("signature"); return; }
        loadContent();
      })
      .catch(() => { setError(t("qcontract.viewer.error.load")); setStage("error"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Loading ──
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center"><div className="text-4xl mb-4 animate-pulse">💣</div><p className="text-sm">{t("qcontract.viewer.loading")}</p></div>
      </div>
    );
  }

  // ── Expired ──
  if (stage === "expired") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">💨</div>
          <h1 className="text-2xl font-black mb-3 text-slate-300">{t("qcontract.viewer.expired.title")}</h1>
          <p className="text-slate-500 text-sm mb-4">
            {meta?.title && <><strong className="text-slate-300">«{meta.title}»</strong><br /></>}
            {t("qcontract.viewer.expired.body")}
          </p>
          <Link href="/qcontract" className="text-xs text-slate-600 hover:text-slate-400">QContract</Link>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (stage === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-2xl font-black mb-3">{t("qcontract.viewer.not_found.title")}</h1>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ── Password + Signature ──
  if (stage === "both" || stage === "password" || stage === "signature") {
    const needPassword = stage === "both" || stage === "password";
    const needSignature = stage === "both" || stage === "signature";

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">{needSignature ? "✍️" : "🔒"}</div>
            <h1 className="text-xl font-bold">{meta?.title ?? t("qcontract.viewer.gate.fallback_title")}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {needSignature && needPassword
                ? t("qcontract.viewer.gate.prompt.both")
                : needPassword
                  ? t("qcontract.viewer.gate.prompt.password")
                  : t("qcontract.viewer.gate.prompt.email")}
            </p>
          </div>
          <div className="space-y-3">
            {needPassword && (
              <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder={t("qcontract.viewer.gate.password_ph")} autoFocus={!needSignature}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors" />
            )}
            {needSignature && (
              <div>
                <input type="email" value={viewerEmail} onChange={(e) => { setViewerEmail(e.target.value); setError(""); }}
                  placeholder={t("qcontract.viewer.gate.email_ph")} autoFocus={!needPassword}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors" />
                <p className="text-[11px] text-slate-600 mt-1">{t("qcontract.viewer.gate.email_hint")}</p>
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={() => loadContent(needPassword ? password : undefined, needSignature ? viewerEmail : undefined)}
              disabled={submitting || (needPassword && !password) || (needSignature && !viewerEmail)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl font-semibold transition-colors"
            >
              {submitting ? t("qcontract.viewer.gate.checking") : t("qcontract.viewer.gate.open")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Content ──
  if (stage === "content" && content) {
    const viewsLeft = content.maxViews != null ? content.maxViews - content.viewCount : null;
    const dateLocale = lang === "en" ? "en-US" : "ru-RU";

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Status banner */}
        <div className={`px-4 py-2 text-center text-xs font-semibold ${
          content.selfDestructed ? "bg-red-600" : "bg-slate-800 text-slate-400"
        }`}>
          {content.selfDestructed
            ? t("qcontract.viewer.banner.last_view")
            : viewsLeft != null
              ? t("qcontract.viewer.banner.views_left", { n: viewsLeft })
              : content.expiresAt
                ? <>{t("qcontract.viewer.banner.expires_in")} <CountdownTimer expiresAt={content.expiresAt} t={t} /></>
                : t("qcontract.viewer.banner.logged")}
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="font-bold text-lg truncate">{content.title}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-slate-500">
                      {t("qcontract.viewer.doc.view_count", { viewed: content.viewCount, cap: content.maxViews ? `/${content.maxViews}` : "" })}
                      {content.expiresAt && <> {t("qcontract.viewer.doc.until", { date: new Date(content.expiresAt).toLocaleDateString(dateLocale) })}</>}
                    </span>
                    {content.viewerEmail && (
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                        ✍️ {content.viewerEmail}
                      </span>
                    )}
                    {content.qrightId && <QRightBadge qrightId={content.qrightId} t={t} />}
                  </div>
                </div>
                <div className="text-2xl shrink-0">📄</div>
              </div>
            </div>

            {/* Content with watermark */}
            <div className="relative px-6 py-6">
              <WatermarkOverlay email={content.viewerEmail} t={t} />
              <div className="relative" style={{ zIndex: 1 }}>
                {content.contentType === "url" ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400 text-sm mb-4">{t("qcontract.viewer.doc.is_link")}</p>
                    <a href={content.content} target="_blank" rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline break-all">
                      {content.content}
                    </a>
                  </div>
                ) : content.contentType === "html" ? (
                  <div className="prose prose-invert max-w-none prose-sm"
                    dangerouslySetInnerHTML={{ __html: content.content }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-slate-200 text-sm leading-relaxed">
                    {content.content}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-600">
              <span>{t("qcontract.viewer.footer.delivered")}</span>
              <span className="select-none">{t("qcontract.viewer.footer.no_share")}</span>
            </div>
          </div>

          {content.selfDestructed && (
            <div className="mt-6 bg-red-950/50 border border-red-900 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">💥</div>
              <p className="text-red-300 font-semibold text-sm">{t("qcontract.viewer.destroyed.title")}</p>
              <p className="text-red-600 text-xs mt-1">{t("qcontract.viewer.destroyed.body")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
