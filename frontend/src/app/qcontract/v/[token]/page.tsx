"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface DocMeta {
  id: string;
  title: string;
  contentType: string;
  maxViews: number | null;
  viewCount: number;
  expiresAt: string | null;
  hasPassword: boolean;
  expired: boolean;
}

interface DocContent {
  title: string;
  content: string;
  contentType: string;
  viewCount: number;
  maxViews: number | null;
  expiresAt: string | null;
  selfDestructed: boolean;
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Истёк"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}ч ${m}м ${s}с` : `${m}м ${s}с`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <span className="font-mono text-amber-400">{remaining}</span>;
}

export default function ViewDocument() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [content, setContent] = useState<DocContent | null>(null);
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"loading" | "meta" | "password" | "content" | "expired" | "error">("loading");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load meta first (no view recorded)
  useEffect(() => {
    fetch(`/api/qcontract/view/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setStage("error"); return; }
        setMeta(d);
        if (d.expired) { setStage("expired"); return; }
        if (d.hasPassword) { setStage("password"); return; }
        // No password — load content immediately
        loadContent();
      })
      .catch(() => { setError("Ошибка загрузки"); setStage("error"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadContent = useCallback(async (pw?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/qcontract/view/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === "wrong_password") { setError("Неверный пароль"); setSubmitting(false); return; }
        if (d.error === "document_expired") { setStage("expired"); setSubmitting(false); return; }
        setError(d.error ?? "Ошибка"); setStage("error"); setSubmitting(false); return;
      }
      setContent(d);
      setStage("content");
    } catch {
      setError("Ошибка загрузки"); setStage("error");
    } finally {
      setSubmitting(false);
    }
  }, [token]);

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💣</div>
          <p className="text-sm">Проверка документа...</p>
        </div>
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">💨</div>
          <h1 className="text-2xl font-black mb-3 text-slate-300">Документ уничтожен</h1>
          <p className="text-slate-500 text-sm mb-6">
            {meta?.title && <><strong className="text-slate-300">«{meta.title}»</strong><br /></>}
            Этот документ уже недоступен — истёк срок действия, лимит просмотров или он был отозван.
          </p>
          <Link href="/qcontract" className="text-xs text-slate-600 hover:text-slate-400">QContract</Link>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-2xl font-black mb-3">Документ не найден</h1>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (stage === "password") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-xl font-bold">{meta?.title ?? "Защищённый документ"}</h1>
            <p className="text-slate-500 text-sm mt-1">Введите пароль для доступа</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Пароль"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && password) loadContent(password); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={() => loadContent(password)}
              disabled={!password || submitting}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl font-semibold transition-colors"
            >
              {submitting ? "Проверка..." : "Открыть документ →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "content" && content) {
    const viewsLeft = content.maxViews != null ? content.maxViews - content.viewCount : null;

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Danger banner */}
        <div className={`px-4 py-2 text-center text-xs font-semibold ${
          content.selfDestructed ? "bg-red-600" : "bg-slate-800 text-slate-400"
        }`}>
          {content.selfDestructed
            ? "💣 Этот был последний просмотр — документ уничтожен"
            : viewsLeft != null
              ? `👁 Осталось просмотров: ${viewsLeft}`
              : content.expiresAt
                ? <>⏱ Истекает через: <CountdownTimer expiresAt={content.expiresAt} /></>
                : "🔒 Просмотр зафиксирован · QContract"}
        </div>

        {/* Document */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
            {/* Doc header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h1 className="font-bold text-lg">{content.title}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Просмотр {content.viewCount}{content.maxViews ? `/${content.maxViews}` : ""}
                  {content.expiresAt && <> · до {new Date(content.expiresAt).toLocaleDateString("ru-RU")}</>}
                </p>
              </div>
              <div className="text-2xl">📄</div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {content.contentType === "url" ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm mb-4">Этот документ — ссылка:</p>
                  <a
                    href={content.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline break-all"
                  >
                    {content.content}
                  </a>
                </div>
              ) : content.contentType === "html" ? (
                <div
                  className="prose prose-invert max-w-none prose-sm"
                  dangerouslySetInnerHTML={{ __html: content.content }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-slate-200 text-sm leading-relaxed">
                  {content.content}
                </pre>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-600">
              <span>Доставлено через QContract · AEVION</span>
              <span className="select-none">⚠ Не распространяйте без разрешения</span>
            </div>
          </div>

          {content.selfDestructed && (
            <div className="mt-6 bg-red-950/50 border border-red-900 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">💥</div>
              <p className="text-red-300 font-semibold text-sm">Документ самоуничтожен после этого просмотра</p>
              <p className="text-red-600 text-xs mt-1">Ни один пользователь больше не сможет открыть эту ссылку</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
