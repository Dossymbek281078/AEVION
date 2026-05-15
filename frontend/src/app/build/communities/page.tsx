"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

type Community = {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  description: string | null;
  memberCount: number;
  lastMessageAt: string | null;
};

const SPECIALTY_EMOJI: Record<string, string> = {
  "Сварка": "🔥",
  "Электрика": "⚡",
  "Каменная кладка": "🧱",
  "Управление стройкой": "👷",
  "Отделка": "🎨",
  "Сантехника": "🔧",
  "Спецтехника": "🚜",
  "Дизайн интерьера": "🏠",
};

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buildApi.communities()
      .then((r) => setCommunities(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <BuildShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Профессиональные комьюнити</h1>
          <p className="mt-1 text-sm text-slate-400">
            Живые чаты по специальностям — вакансии, советы, нетворкинг
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="h-36 animate-pulse rounded-xl border border-white/5 bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((c) => (
              <Link
                key={c.id}
                href={`/build/communities/${c.slug}`}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-teal-500/30 hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {SPECIALTY_EMOJI[c.specialty] ?? "👷"}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.specialty}</p>
                  </div>
                </div>

                {c.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>👥 {c.memberCount.toLocaleString()} участников</span>
                  {c.lastMessageAt && (
                    <span>{new Date(c.lastMessageAt).toLocaleDateString("ru")}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </BuildShell>
  );
}
