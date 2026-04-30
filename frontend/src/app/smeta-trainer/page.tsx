import { LsrEditor } from "./components/LsrEditor";
import type { Lsr } from "./lib/types";

// MVP: один учебный объект с заранее заданными разделами.
// Позиции студент добавляет сам через UI.
const initialLsr: Lsr = {
  id: "lsr-school-47-otdelka",
  title: "ЛСР — Капремонт классной комнаты школы №47, отделочные работы",
  objectId: "school-47-room",
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  sections: [
    {
      id: "section-demont",
      title: "Раздел 1. Демонтажные работы",
      category: "демонтажные",
      positions: [],
    },
    {
      id: "section-otdelka",
      title: "Раздел 2. Отделочные работы",
      category: "отделочные",
      positions: [],
    },
  ],
  createdAt: "2026-04-30T00:00:00Z",
  updatedAt: "2026-04-30T00:00:00Z",
};

export default function SmetaTrainerPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold text-sm">AEVION</span>
          <span className="text-slate-300">·</span>
          <h1 className="text-base font-medium">Сметный тренажёр РК</h1>
        </div>
        <div className="text-xs text-slate-300">
          Учебный режим · СНБ 2026-Q2 · {initialLsr.indexRegion}
        </div>
      </header>
      <LsrEditor initialLsr={initialLsr} />
    </main>
  );
}
