import { LsrEditor } from "./components/LsrEditor";
import type { Lsr } from "./lib/types";

const initialLsr: Lsr = {
  id: "lsr-school-47-2026",
  title: "ЛСР — Капитальный ремонт учебного корпуса школы №47, г. Алматы",
  objectId: "school-47-room",
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  meta: {
    strojkaTitle: "Капитальный ремонт СОШ №47, г. Алматы, ул. Жандосова 56",
    strojkaCode: "02-2026-ПВП 20",
    objectTitle: "Учебный корпус, блок А — классные комнаты 1–3 этаж",
    objectCode: "2-01",
    lsrNumber: "2-01-01-01",
    worksTitle: "Отделочные и демонтажные работы по классным комнатам",
    osnovanje: "РП Том 2. Альбом 1. Черт. ОР-01",
    priceDate: "декабрь 2025 г.",
    author: "",
  },
  sections: [
    {
      id: "section-demont",
      title: "Раздел 1. Демонтажные работы",
      category: "демонтажные",
      positions: [],
    },
    {
      id: "section-shtuk",
      title: "Раздел 2. Штукатурно-шпатлёвочные работы",
      category: "отделочные",
      positions: [],
    },
    {
      id: "section-otdelka",
      title: "Раздел 3. Окраска и облицовка",
      category: "отделочные",
      positions: [],
    },
    {
      id: "section-poly",
      title: "Раздел 4. Полы",
      category: "отделочные",
      positions: [],
    },
    {
      id: "section-okna",
      title: "Раздел 5. Окна и двери",
      category: "отделочные",
      positions: [],
    },
  ],
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
};

export default function SmetaTrainerPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold text-sm tracking-wide">AEVION</span>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-medium text-slate-100">Сметный тренажёр РК</h1>
          <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">учебный</span>
        </div>
        <div className="text-[10px] text-slate-400">
          НДЦС РК 8.01-08-2022 · Базисно-индексный метод · Учебный квартал 2026-Q2
        </div>
      </header>
      <LsrEditor initialLsr={initialLsr} />
    </main>
  );
}
