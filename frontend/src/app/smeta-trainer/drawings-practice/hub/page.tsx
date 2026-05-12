"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDrawingsProgress } from "../../lib/useDrawingsProgress";

const MODULES = [
  {
    id: "normatives",
    href: "/smeta-trainer/drawings-practice/normatives",
    icon: "📋",
    title: "Нормативная база",
    subtitle: "СНиП РК, ЭСН РК, категории грунтов, откосы, Кр, ширина траншей",
    level: "L2",
    exercises: 2,
    color: "slate",
  },
  {
    id: "rate-selector",
    href: "/smeta-trainer/drawings-practice/rate-selector",
    icon: "🎯",
    title: "Задачник: выбери расценку ЭСН",
    subtitle: "10 задач — земля, бетон, кладка, кровля, отделка, дороги",
    level: "L3",
    exercises: 10,
    color: "slate",
  },
  {
    id: "self-study",
    href: "/smeta-trainer/drawings-practice/self-study",
    icon: "📝",
    title: "Самостоятельная работа",
    subtitle: "3 задания: составь ВОР по нормативам (лёгкий/средний/сложный)",
    level: "L4",
    exercises: 3,
    color: "teal",
  },
  {
    id: "trenches",
    href: "/smeta-trainer/drawings-practice/trenches",
    icon: "🔗",
    title: "Траншеи под сети",
    subtitle: "Нормативная ширина, объём, подушка, ручная засыпка",
    level: "L3",
    exercises: 4,
    color: "teal",
  },
  {
    id: "sewage",
    href: "/smeta-trainer/drawings-practice/sewage",
    icon: "🚰",
    title: "Канализация — наружные сети",
    subtitle: "Самотечная Ø200, уклон 8‰, колодцы КК-1000",
    level: "L3",
    exercises: 3,
    color: "blue",
  },
  {
    id: "heating",
    href: "/smeta-trainer/drawings-practice/heating",
    icon: "♨️",
    title: "Тепловые сети",
    subtitle: "Двухтрубная Ø108, изоляция минвата 60 мм, опоры",
    level: "L4",
    exercises: 4,
    color: "orange",
  },
  {
    id: "cables",
    href: "/smeta-trainer/drawings-practice/cables",
    icon: "⚡",
    title: "Кабельные трассы",
    subtitle: "Силовые до 1 кВ, песчаная постель, защита кирпичом",
    level: "L3",
    exercises: 4,
    color: "violet",
  },
  {
    id: "gas",
    href: "/smeta-trainer/drawings-practice/gas",
    icon: "🔥",
    title: "Газоснабжение",
    subtitle: "ПЭ Ø110 низкого давления, футляры на пересечениях",
    level: "L4",
    exercises: 3,
    color: "amber",
  },
  {
    id: "water",
    href: "/smeta-trainer/drawings-practice/water",
    icon: "💧",
    title: "Водоснабжение",
    subtitle: "ПЭ100 SDR17 Ø160, водомерный колодец ВК",
    level: "L3",
    exercises: 4,
    color: "sky",
  },
  {
    id: "ventilation",
    href: "/smeta-trainer/drawings-practice/ventilation",
    icon: "🌬",
    title: "Вентиляция",
    subtitle: "Воздуховоды 800×500, изоляция, расчёт площадей",
    level: "L3",
    exercises: 4,
    color: "emerald",
  },
  {
    id: "excavation",
    href: "/smeta-trainer/drawings-practice/excavation",
    icon: "🔶",
    title: "Котлован",
    subtitle: "Объём земляных работ с откосами",
    level: "L2",
    exercises: 4,
    color: "amber",
  },
  {
    id: "foundation",
    href: "/smeta-trainer/drawings-practice/foundation",
    icon: "🏗",
    title: "Фундаменты",
    subtitle: "Ленточный ж/б: тело, подошва, г/и",
    level: "L3",
    exercises: 3,
    color: "slate",
  },
  {
    id: "walls",
    href: "/smeta-trainer/drawings-practice/walls",
    icon: "🧱",
    title: "Стены",
    subtitle: "Кладка кирпич/газобетон, объём и площадь",
    level: "L2",
    exercises: 4,
    color: "orange",
  },
  {
    id: "slabs",
    href: "/smeta-trainer/drawings-practice/slabs",
    icon: "🔲",
    title: "Перекрытия",
    subtitle: "Монолит и пустотные плиты, опалубка",
    level: "L3",
    exercises: 3,
    color: "slate",
  },
  {
    id: "roof-flat",
    href: "/smeta-trainer/drawings-practice/roof-flat",
    icon: "🏠",
    title: "Кровля",
    subtitle: "Плоская + скатная с уклоном",
    level: "L4",
    exercises: 4,
    color: "blue",
  },
  {
    id: "windows-doors",
    href: "/smeta-trainer/drawings-practice/windows-doors",
    icon: "🪟",
    title: "Окна и двери",
    subtitle: "Количество, откосы, монтаж",
    level: "L2",
    exercises: 3,
    color: "sky",
  },
  {
    id: "stairs",
    href: "/smeta-trainer/drawings-practice/stairs",
    icon: "🪜",
    title: "Лестницы",
    subtitle: "Ступени, марши, площадки, отделка",
    level: "L3",
    exercises: 3,
    color: "violet",
  },
  {
    id: "finishing",
    href: "/smeta-trainer/drawings-practice/finishing",
    icon: "🎨",
    title: "Отделка",
    subtitle: "Плитка, штукатурка, окраска по помещениям",
    level: "L2",
    exercises: 5,
    color: "emerald",
  },
  {
    id: "utilities",
    href: "/smeta-trainer/drawings-practice/utilities",
    icon: "🔧",
    title: "Инженерные системы",
    subtitle: "Трубопроводы, изоляция, воздуховоды",
    level: "L4",
    exercises: 3,
    color: "purple",
  },
  {
    id: "advanced",
    href: "/smeta-trainer/drawings-practice/advanced",
    icon: "📐",
    title: "Сложные объёмы",
    subtitle: "Кровля с уклоном, фасад, лестничный марш",
    level: "L4",
    exercises: 3,
    color: "indigo",
  },
  {
    id: "errors",
    href: "/smeta-trainer/drawings-practice/errors",
    icon: "🔍",
    title: "Найди ошибку в ВОР",
    subtitle: "3 сценария с неверными расчётами",
    level: "L5",
    exercises: 3,
    color: "red",
  },
  {
    id: "inspections",
    href: "/smeta-trainer/drawings-practice/inspections",
    icon: "✅",
    title: "Приёмка работ",
    subtitle: "АОСР, КС-2/КС-3, исполнительная документация",
    level: "L4",
    exercises: 0,
    color: "indigo",
  },
  {
    id: "safety",
    href: "/smeta-trainer/drawings-practice/safety",
    icon: "🦺",
    title: "Охрана труда",
    subtitle: "Расценки, ППР, ограждения, СИЗ — 0.4-1% от ФОТ",
    level: "L3",
    exercises: 3,
    color: "orange",
  },
  {
    id: "winter",
    href: "/smeta-trainer/drawings-practice/winter",
    icon: "❄️",
    title: "Зимние работы",
    subtitle: "Кз 1.10-1.60, прогрев бетона, противоморозные добавки",
    level: "L4",
    exercises: 3,
    color: "blue",
  },
  {
    id: "roads",
    href: "/smeta-trainer/drawings-practice/roads",
    icon: "🛣",
    title: "Дороги и благоустройство",
    subtitle: "А/б покрытие, бордюры, тротуары, дорожная одежда",
    level: "L3",
    exercises: 4,
    color: "slate",
  },
  {
    id: "demolition",
    href: "/smeta-trainer/drawings-practice/demolition",
    icon: "🔨",
    title: "Демонтаж",
    subtitle: "ЭСН Сб.46, утилизация, вторсырьё, экология",
    level: "L3",
    exercises: 3,
    color: "amber",
  },
  {
    id: "facade-svtk",
    href: "/smeta-trainer/drawings-practice/facade-svtk",
    icon: "🏢",
    title: "Фасады — СФТК и НВФ",
    subtitle: "Композитные системы и навесные вентилируемые фасады",
    level: "L4",
    exercises: 4,
    color: "violet",
  },
];

const LEVEL_COLORS: Record<string, string> = {
  L2: "bg-emerald-100 text-emerald-800",
  L3: "bg-blue-100 text-blue-800",
  L4: "bg-indigo-100 text-indigo-800",
  L5: "bg-red-100 text-red-800",
};

const MODULE_COLORS: Record<string, string> = {
  amber:   "border-amber-200 hover:border-amber-400",
  slate:   "border-slate-200 hover:border-slate-400",
  orange:  "border-orange-200 hover:border-orange-400",
  blue:    "border-blue-200 hover:border-blue-400",
  sky:     "border-sky-200 hover:border-sky-400",
  violet:  "border-violet-200 hover:border-violet-400",
  emerald: "border-emerald-200 hover:border-emerald-400",
  purple:  "border-purple-200 hover:border-purple-400",
  indigo:  "border-indigo-200 hover:border-indigo-400",
  red:     "border-red-200 hover:border-red-400",
};

export default function DrawingsHub() {
  const [progress, setProgress] = useState({ basicDone: 0, advancedDone: 0, errorsDone: 0 });

  useEffect(() => {
    const p = loadDrawingsProgress();
    setProgress({ basicDone: p.basicDone, advancedDone: p.advancedDone, errorsDone: p.errorsDone });
  }, []);

  const totalEx = MODULES.reduce((s, m) => s + m.exercises, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📐 Чтение чертежей — все разделы
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {MODULES.length} модулей · {totalEx} упражнений · от котлована до отделки
            </p>
          </div>
        </div>
      </header>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 px-6 py-2 text-xs text-indigo-800 dark:text-indigo-300">
        💡 Каждый раздел — интерактивный SVG-чертёж с реальными размерами + упражнения по подсчёту объёмов для ВОР.
        Начни с котлована и двигайся по циклу строительства.
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Строительный цикл */}
        <div className="mb-4 text-xs font-bold text-slate-500 uppercase tracking-wide">
          Строительный цикл — от котлована до сдачи
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className={`bg-white dark:bg-slate-900 border-2 ${MODULE_COLORS[m.color]} rounded-xl p-4 flex gap-3 items-start transition-all hover:shadow-md dark:border-slate-700 dark:hover:border-indigo-500`}
            >
              <span className="text-3xl shrink-0">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.title}</h2>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_COLORS[m.level]}`}>
                    {m.level}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{m.subtitle}</p>
                <div className="text-[10px] text-slate-400 mt-1">{m.exercises} упражнений</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Быстрый доступ к базовым */}
        <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
            ✅ Базовый курс (рекомендуем начать):
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/smeta-trainer/drawings-practice" className="text-[11px] px-3 py-1.5 bg-emerald-600 text-white rounded-full font-semibold hover:bg-emerald-700">
              📐 Базовый L2 ({progress.basicDone}/5)
            </Link>
            <Link href="/smeta-trainer/drawings-practice/advanced" className="text-[11px] px-3 py-1.5 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700">
              📐 Продвинутый L4 ({progress.advancedDone}/6)
            </Link>
            <Link href="/smeta-trainer/drawings-practice/errors" className="text-[11px] px-3 py-1.5 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700">
              🔍 Найди ошибку ({progress.errorsDone}/3)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
