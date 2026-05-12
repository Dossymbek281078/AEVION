"use client";

import { LevelHome } from "./components/LevelHome";
import { OnboardingModal } from "./components/OnboardingModal";
import { ThemeToggle } from "./components/ThemeToggle";
import { ProgressBanner } from "./components/ProgressBanner";
import { QuickCalc } from "./components/QuickCalc";
import { PageExportButton } from "./components/PageExportButton";

export default function SmetaTrainerPage() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold text-sm tracking-wide">AEVION</span>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-medium text-slate-100">Сметный тренажёр РК</h1>
          <span className="text-[10px] bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded-full">beta</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-slate-400 hidden sm:block">
            НДЦС РК 8.01-08-2022 · 222 расценки ЭСН · 5 уровней · Школа №47, Алматы
          </div>
          <PageExportButton />
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
            className="hidden sm:block text-[10px] text-slate-400 hover:text-emerald-400 px-1.5 py-0.5 border border-slate-700 rounded font-mono"
            title="Клавиатурные шорткаты"
            aria-label="Показать клавиатурные шорткаты"
          >
            ?
          </button>
          <ThemeToggle />
        </div>
      </header>
      <ProgressBanner />
      <OnboardingModal />
      <LevelHome />
      <QuickCalc />
    </main>
  );
}
