"use client";

import { useState } from "react";
import Link from "next/link";
import { buildApi } from "@/lib/build/api";

export function ProjectCertificate({ projectId }: { projectId: string }) {
  const [cert, setCert] = useState<Awaited<ReturnType<typeof buildApi.projectCertificate>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (cert) {
    const workers = cert.workers as Array<{ id: string; name: string; role?: string }>;
    const project = cert.project as { title: string; city?: string; budget?: number };
    return (
      <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            📋 Сертификат завершения
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">{cert.certId}</div>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">Проект</div>
            <div className="font-semibold text-white">{project.title}</div>
            {project.city && <div className="text-xs text-slate-500">📍 {project.city}</div>}
          </div>
          {workers.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Участники</div>
              <div className="space-y-1">
                {workers.map((w) => (
                  <div key={w.id} className="flex items-center gap-2">
                    <Link href={`/build/u/${w.id}`} className="text-white hover:text-emerald-200">
                      {w.name}
                    </Link>
                    {w.role && <span className="text-xs text-slate-500">— {w.role}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-slate-500">
            Выдан: {new Date(cert.issuedAt).toLocaleDateString("ru-RU")}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => window.print()}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              🖨️ Печать
            </button>
            <Link
              href={cert.qsignUrl}
              className="rounded-md bg-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-500/30"
            >
              ✍️ Подписать QSign
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {err && <p className="mb-2 text-xs text-rose-300">{err}</p>}
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setErr(null);
          try { setCert(await buildApi.projectCertificate(projectId)); }
          catch (e) { setErr((e as Error).message); }
          finally { setLoading(false); }
        }}
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
      >
        {loading ? "Генерируем…" : "📋 Сертификат завершения"}
      </button>
    </div>
  );
}
