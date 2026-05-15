"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

interface SkillBadge {
  id: string;
  testId: string;
  testTitle: string;
  score: number;
  grantedAt: string;
}

interface Reference {
  id: string;
  projectId: string;
  authorId: string;
  rating: number;
  text: string;
  recommend: boolean;
  projectTitle?: string;
  authorName?: string;
  authorPhoto?: string | null;
  createdAt: string;
}

const TEST_ICON: Record<string, string> = {
  welding: "🔥", concrete: "🏗", electrician: "⚡",
};

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < rating ? "text-amber-400" : "text-slate-700"}>★</span>
      ))}
    </span>
  );
}

export function ProfileExtras({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<SkillBadge[]>([]);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl(`/api/build/skill-badges/user/${encodeURIComponent(userId)}`))
        .then((r) => r.ok ? r.json() : { data: { badges: [] } })
        .then((d) => setBadges(d.data?.badges ?? d.badges ?? []))
        .catch(() => {}),
      fetch(apiUrl(`/api/build/worker-references/${encodeURIComponent(userId)}`))
        .then((r) => r.ok ? r.json() : { data: { references: [], total: 0, avgRating: null } })
        .then((d) => {
          setRefs(d.data?.references ?? d.references ?? []);
          setAvgRating(d.data?.avgRating ?? d.avgRating ?? null);
        })
        .catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, [userId]);

  if (!loaded) return null;
  if (badges.length === 0 && refs.length === 0) return null;

  return (
    <>
      {badges.length > 0 && (
        <section className="rounded-2xl border border-emerald-700/30 bg-emerald-500/5 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300 mb-3">
            🏅 Подтверждённые навыки
          </h3>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                className="inline-flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/40 rounded-xl px-3 py-2"
                title={`Сдан ${new Date(b.grantedAt).toLocaleDateString("ru-RU")}`}
              >
                <span className="text-lg">{TEST_ICON[b.testId] ?? "🏅"}</span>
                <div>
                  <p className="text-sm font-bold text-white">{b.testTitle}</p>
                  <p className="text-[10px] text-emerald-400">{b.score}%</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {refs.length > 0 && (
        <section className="rounded-2xl border border-violet-700/30 bg-violet-500/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-violet-300">
              🤝 Рекомендации работодателей
            </h3>
            {avgRating != null && (
              <div className="text-right">
                <span className="text-lg font-black text-white">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-slate-400 ml-1">/ 5 ({refs.length})</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {refs.slice(0, 5).map((r) => (
              <article key={r.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRating rating={r.rating} />
                    {r.recommend && (
                      <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/40">
                        Рекомендует
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line line-clamp-4">{r.text}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                  <span>
                    {r.authorName && `от ${r.authorName}`}
                  </span>
                  {r.projectTitle && (
                    <Link href={`/build/project/${r.projectId}`} className="text-violet-400 hover:underline">
                      → {r.projectTitle}
                    </Link>
                  )}
                </div>
              </article>
            ))}
            {refs.length > 5 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                ещё {refs.length - 5} {refs.length - 5 === 1 ? "рекомендация" : refs.length - 5 < 5 ? "рекомендации" : "рекомендаций"}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
