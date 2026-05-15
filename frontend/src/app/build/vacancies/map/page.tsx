"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const VacancyMap = dynamic(() => import("./VacancyMap").then((m) => m.VacancyMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[70vh] place-items-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
      Загружаю карту…
    </div>
  ),
});

export default function VacancyMapPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🗺️ Карта вакансий</h1>
          <p className="text-sm text-slate-400">
            Все открытые вакансии на карте по городу. Кликните на маркер — откроется карточка.
          </p>
        </div>
        <Link
          href="/build/vacancies"
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Список
        </Link>
      </div>
      <VacancyMap />
    </main>
  );
}
