import { LevelHome } from "./components/LevelHome";

export default function SmetaTrainerPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold text-sm tracking-wide">AEVION</span>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-medium text-slate-100">Сметный тренажёр РК</h1>
          <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">учебный</span>
        </div>
        <div className="text-[10px] text-slate-400">
          НДЦС РК 8.01-08-2022 · 5 уровней · Школа №47, Алматы
        </div>
      </header>
      <LevelHome />
    </main>
  );
}
