"use client";

import { useEffect, useState } from "react";
import { buildApi } from "@/lib/build/api";

type Stats = { workerExpectations: { p50: number | null; currency: string }; employerOffers: { p50: number | null; currency: string }; count: number };

export function SalaryBenchmark({ skill, city }: { skill?: string; city?: string | null }) {
  const [data, setData] = useState<Stats | null>(null);

  useEffect(() => {
    if (!skill && !city) return;
    buildApi.salaryBenchmark(skill, city ?? undefined)
      .then(setData)
      .catch(() => {});
  }, [skill, city]);

  if (!data || data.count === 0) return null;

  const offers = data.employerOffers.p50;
  const expects = data.workerExpectations.p50;
  const currency = data.employerOffers.currency || "₽";

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs">
      <div className="mb-1 font-bold text-blue-300">📊 Рыночные данные</div>
      <div className="flex gap-4 text-slate-300">
        {offers != null && (
          <span>Вакансии: <strong>{offers.toLocaleString("ru-RU")} {currency}</strong></span>
        )}
        {expects != null && (
          <span>Работники: <strong>{expects.toLocaleString("ru-RU")} {currency}</strong></span>
        )}
        <span className="text-slate-500">({data.count} записей)</span>
      </div>
    </div>
  );
}
