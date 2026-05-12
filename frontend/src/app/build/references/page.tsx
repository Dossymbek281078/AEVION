"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

interface Reference {
  id: string;
  projectId: string;
  workerId: string;
  authorId: string;
  rating: number;
  text: string;
  recommend: boolean;
  createdAt: string;
  projectTitle?: string;
  workerName?: string;
  workerTitle?: string;
  workerPhoto?: string | null;
  authorName?: string;
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < rating ? "text-amber-400" : "text-slate-700"}>★</span>
      ))}
    </span>
  );
}

function ReferenceCard({ ref: r, showWorker = false }: { ref: Reference; showWorker?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-3">
        {showWorker && (
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg shrink-0 overflow-hidden">
            {r.workerPhoto
              ? <img src={r.workerPhoto} alt={r.workerName ?? ""} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              : <span className="text-slate-400 text-sm font-bold">{(r.workerName ?? "?")[0]?.toUpperCase()}</span>
            }
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showWorker && r.workerName && (
              <span className="font-semibold text-white text-sm">{r.workerName}</span>
            )}
            {r.workerTitle && <span className="text-xs text-slate-500">{r.workerTitle}</span>}
            <StarRating rating={r.rating} />
            {r.recommend && (
              <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/40">
                Рекомендует
              </span>
            )}
          </div>
          {r.projectTitle && (
            <p className="text-xs text-slate-500 mt-0.5">
              Проект:{" "}
              <Link href={`/build/project/${r.projectId}`} className="text-violet-400 hover:underline">
                {r.projectTitle}
              </Link>
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{r.text}</p>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-600">
        <span>{r.authorName && `от ${r.authorName}`}</span>
        <span>{new Date(r.createdAt).toLocaleDateString("ru-RU")}</span>
      </div>
    </div>
  );
}

function MyReferencesContent() {
  const user = useBuildAuth((s) => s.user);
  const [given, setGiven] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buildApi.myReferences()
      .then((r) => setGiven(r.references ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Мои рекомендации</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Рекомендации, которые вы написали специалистам после завершения проектов
        </p>
      </div>

      {loading && <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Загрузка…</div>}

      {!loading && given.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm">Вы ещё не написали ни одной рекомендации.</p>
          <p className="text-xs text-slate-600 mt-2">
            После завершения проекта вы можете написать рекомендацию специалистам, с которыми работали.
          </p>
          <Link href="/build" className="text-violet-400 underline text-sm mt-4 inline-block">← К проектам</Link>
        </div>
      )}

      <div className="space-y-4">
        {given.map((r) => (
          <ReferenceCard key={r.id} ref={r} showWorker />
        ))}
      </div>
    </div>
  );
}

export default function ReferencesPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <MyReferencesContent />
      </RequireAuth>
    </BuildShell>
  );
}
