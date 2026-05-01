"use client";

import { useEffect, useState } from "react";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import Link from "next/link";

type Doc = {
  id: string;
  userId: string;
  docType: string;
  fileUrl: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

const DOC_LABEL: Record<string, string> = {
  WELDER: "🔥 Сварщик",
  ELECTRICIAN: "⚡ Электрик",
  DRIVER_LICENSE: "🚗 Водительское",
  MEDICAL: "🏥 Медкомиссия",
  SAFETY: "⛑ Охрана труда",
  PLUMBER: "🔧 Сантехник",
  ENGINEER: "🔩 Инженер",
  OTHER: "📄 Другое",
};

export default function AdminDocumentsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <AdminDocumentsInner />
      </RequireAuth>
    </BuildShell>
  );
}

function AdminDocumentsInner() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    buildApi.adminPendingDocuments()
      .then((r) => setDocs(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function verify(id: string) {
    setBusy(id);
    try { await buildApi.verifyDocument(id); load(); } catch {/**/} finally { setBusy(null); }
  }

  async function reject(id: string) {
    const reason = prompt("Причина отказа (необязательно):") ?? undefined;
    setBusy(id);
    try { await buildApi.rejectDocument(id, reason); load(); } catch {/**/} finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 Верификация документов</h1>
          <p className="mt-1 text-sm text-slate-400">Ожидают проверки: {docs.length}</p>
        </div>
        <Link href="/build/admin" className="text-sm text-slate-400 hover:text-white">← Admin</Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/5" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-3 text-slate-300">Нет документов для проверки</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{DOC_LABEL[doc.docType] ?? doc.docType}</span>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-bold">PENDING</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {doc.userName} ({doc.userEmail}) ·{" "}
                    <Link href={`/build/u/${doc.userId}`} className="text-teal-400 hover:underline">Профиль</Link>
                  </p>
                  <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleString("ru")}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Открыть файл
                  </a>
                  <button
                    disabled={busy === doc.id}
                    onClick={() => void verify(doc.id)}
                    className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {busy === doc.id ? "…" : "✓ Подтвердить"}
                  </button>
                  <button
                    disabled={busy === doc.id}
                    onClick={() => void reject(doc.id)}
                    className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
