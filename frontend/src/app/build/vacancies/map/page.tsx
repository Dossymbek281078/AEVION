"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const VacancyMap = dynamic(() => import("./VacancyMap").then((m) => m.VacancyMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const { t } = useI18n();
  return (
    <div className="grid h-[70vh] place-items-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
      {t("build.vacanciesMap.loading")}
    </div>
  );
}

export default function VacancyMapPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🗺️ {t("build.vacanciesMap.title")}</h1>
          <p className="text-sm text-slate-400">
            {t("build.vacanciesMap.subtitle")}
          </p>
        </div>
        <Link
          href="/build/vacancies"
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← {t("build.vacanciesMap.backToList")}
        </Link>
      </div>
      <VacancyMap />
    </main>
  );
}
