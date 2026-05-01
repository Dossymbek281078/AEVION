import { Level1View } from "../../components/Level1View";
import { Level2View } from "../../components/Level2View";
import { Level3View } from "../../components/Level3View";
import { Level4View } from "../../components/Level4View";
import { Level5View } from "../../components/Level5View";
import Link from "next/link";

interface Props {
  params: { num: string };
}

const LEVEL_META: Record<string, { role: string; title: string }> = {
  "1": { role: "С нуля",         title: "Читаю смету" },
  "2": { role: "Пользователь",   title: "Составляю ЛСР" },
  "3": { role: "ПТО",            title: "Веду исполнительные" },
  "4": { role: "Проектировщик",  title: "Полный комплект" },
  "5": { role: "Эксперт",        title: "Нахожу ошибки" },
};

export default function LevelPage({ params }: Props) {
  const num = params.num;
  const meta = LEVEL_META[num];

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col">
      {/* Шапка с навигацией */}
      <header className="bg-slate-900 text-white px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="text-emerald-400 font-bold text-sm tracking-wide">AEVION</span>
        <span className="text-slate-600">·</span>
        <Link href="/smeta-trainer" className="text-slate-400 hover:text-white text-xs">
          ← Все уровни
        </Link>
        <span className="text-slate-600">·</span>
        {meta && (
          <>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
              Уровень {num} — {meta.role}
            </span>
            <span className="text-sm font-medium text-slate-100">{meta.title}</span>
          </>
        )}
        <div className="ml-auto text-[10px] text-slate-400">
          НДЦС РК 8.01-08-2022 · Учебный режим
        </div>
      </header>

      {/* Контент уровня */}
      <div className="flex-1 overflow-hidden">
        {num === "1" && <Level1View />}
        {num === "2" && <Level2View />}
        {num === "3" && <Level3View />}
        {num === "4" && <Level4View />}
        {num === "5" && <Level5View />}
        {!["1","2","3","4","5"].includes(num) && (
          <div className="flex items-center justify-center h-full text-slate-400">
            Уровень {num} не найден.{" "}
            <Link href="/smeta-trainer" className="ml-2 text-emerald-600 underline">
              Вернуться
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
