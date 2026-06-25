"use client";

/**
 * Реальные расценки РК — эталонный слой тренажёра.
 *
 * Показывает настоящую локальную смету (Форма 4, ресурсный метод по НДЦС РК 8.01-08-2022),
 * распарсенную из реального объекта «канализационный коллектор + КНС» (3237 расценок,
 * 11634 ресурса, 34 ЛС). Рядом с каждой реальной позицией — учебный аналог из корпуса
 * тренажёра и наглядная разница: реальный код ЭСН РК vs учебный шифр, ресурсная разбивка
 * vs плоская цена.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import realRates from "../data/real-rates.json";
import { RealRatesView } from "../components/RealRatesView";

const META = realRates as unknown as {
  source: string;
  norm: string;
  smetyCount: number;
  positionsCount: number;
  resourcesCount?: number;
};

export default function RealRatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-slate-500 text-sm">Загрузка…</div>}>
      <RealRatesPageInner />
    </Suspense>
  );
}

function RealRatesPageInner() {
  const searchParams = useSearchParams();
  const fromExam = searchParams?.get("from") === "exam";
  const examId = searchParams?.get("examId") ?? null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
              ← Главная
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              🏗 Реальные расценки РК (Форма 4)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {META.positionsCount.toLocaleString("ru-RU")} расценок и{" "}
              {(META.resourcesCount ?? 0).toLocaleString("ru-RU")} ресурсов из{" "}
              {META.smetyCount} локальных смет настоящего объекта. {META.norm}.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/smeta-trainer/resource-quiz"
              className="text-xs px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              🧱 Тест по методу
            </Link>
            <Link
              href="/smeta-trainer/real-rates/assemble"
              className="text-xs px-3 py-2 bg-emerald-600 text-white border border-emerald-600 rounded hover:bg-emerald-700"
            >
              🧰 Собрать смету →
            </Link>
          </div>
        </div>

        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
          <strong>Эталон для сравнения.</strong> Это выгрузка из реальной сметной программы РК
          (объект до госэкспертизы). Разверните любую позицию (▶) — увидите состав ресурсов
          с настоящими кодами ЭСН/ССЦ и учебный аналог из корпуса тренажёра с разбором отличий.
          Источник: <span className="font-mono">{META.source}</span>.
        </div>

        <RealRatesView fromExam={fromExam} examId={examId} />
      </div>
    </div>
  );
}
