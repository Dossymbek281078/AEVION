"use client";

/**
 * Карта тренажёра — sitemap всего, что есть в /smeta-trainer.
 * Группировка по логическим разделам: обучение, инструменты, справочники, экзамены.
 */

import Link from "next/link";
import { EXAM_TASKS } from "../lib/examTasks";

type LinkItem = { href: string; title: string; description: string; icon: string };
type Section = { title: string; subtitle: string; color: string; items: LinkItem[] };

const SECTIONS: Section[] = [
  {
    title: "🎓 Обучение",
    subtitle: "Учебные материалы и сквозной кейс",
    color: "blue",
    items: [
      { href: "/smeta-trainer", title: "Главная", description: "5 уровней + прогресс студента", icon: "🏠" },
      { href: "/smeta-trainer/all-lessons", title: "Все уроки", description: "Список лекций и упражнений", icon: "📚" },
      { href: "/smeta-trainer/lessons-search", title: "Поиск по урокам", description: "Найти теорию по теме", icon: "🔎" },
      { href: "/smeta-trainer/methodology", title: "Методика ССЦ", description: "206 пунктов + 225 таблиц", icon: "📖" },
      { href: "/smeta-trainer/cheatsheet", title: "Шпаргалка", description: "Быстрые формулы", icon: "📝" },
      { href: "/smeta-trainer/glossary", title: "Глоссарий", description: "Термины сметного дела РК", icon: "🧠" },
      { href: "/smeta-trainer/practice", title: "Практика", description: "Учебные упражнения", icon: "✍️" },
      { href: "/smeta-trainer/drawings-practice", title: "Практика по чертежам", description: "323 модуля × 9 категорий", icon: "📐" },
      { href: "/smeta-trainer/notes", title: "Заметки", description: "Личные пометки студента", icon: "🗒" },
      { href: "/smeta-trainer/favorites", title: "Избранное", description: "Закладки уроков и расценок", icon: "⭐" },
    ],
  },
  {
    title: "🔧 Инструменты",
    subtitle: "Рабочие инструменты сметчика",
    color: "emerald",
    items: [
      { href: "/smeta-trainer/dashboard", title: "Дашборд", description: "Сводка работ и метрик", icon: "📊" },
      { href: "/smeta-trainer/review", title: "AI-ревью", description: "Анализ ЛСР по 15 сценариям", icon: "🤖" },
      { href: "/smeta-trainer/import-check", title: "Импорт ЛСР", description: "Проверка внешнего ЛСР на ошибки", icon: "📥" },
      { href: "/smeta-trainer/documents", title: "Учебные документы", description: "КС-2, КС-3, Ф-2 РК, АОСР", icon: "📄" },
      { href: "/smeta-trainer/capstone", title: "Capstone", description: "Сквозной кейс школы №47", icon: "🏫" },
      { href: "/smeta-trainer/labor-machines", title: "Труд и машины", description: "СЦЗТ + СЦЭМ ставки", icon: "💼🚜" },
    ],
  },
  {
    title: "📚 Справочники",
    subtitle: "Нормативный корпус РК",
    color: "amber",
    items: [
      { href: "/smeta-trainer/ssc", title: "Справочник ССЦ", description: "189 493 материала, 21 регион РК", icon: "📚" },
      { href: "/smeta-trainer/ssc-search", title: "Глобальный поиск ССЦ", description: "По всем книгам сразу", icon: "🔍" },
      { href: "/smeta-trainer/ssc-stats", title: "Статистика ССЦ", description: "Дашборд покрытия", icon: "📈" },
      { href: "/smeta-trainer/indexes", title: "Индексы НДЦС", description: "15 годовых + 26 квартальных", icon: "📈" },
    ],
  },
  {
    title: "🎯 Экзамены и сертификат",
    subtitle: "Автоматическая проверка и выдача сертификатов",
    color: "rose",
    items: [
      { href: "/smeta-trainer/exam", title: "Банк экзаменов", description: `${EXAM_TASKS.length} заданий разной сложности`, icon: "🎓" },
      { href: "/smeta-trainer/exam-journal", title: "Журнал попыток", description: "История + статистика + CSV", icon: "📔" },
      { href: "/smeta-trainer/achievements", title: "Достижения", description: "Бейджи прогресса", icon: "🏆" },
      { href: "/smeta-trainer/certificate", title: "Сертификат уровней", description: "Базовый сертификат курса", icon: "📜" },
    ],
  },
  {
    title: "⚙️ Прочее",
    subtitle: "Служебные страницы",
    color: "slate",
    items: [
      { href: "/smeta-trainer/admin", title: "Админ", description: "Управление корпусом (служебно)", icon: "🛠" },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  blue: "border-blue-300 bg-blue-50",
  emerald: "border-emerald-300 bg-emerald-50",
  amber: "border-amber-300 bg-amber-50",
  rose: "border-rose-300 bg-rose-50",
  slate: "border-slate-300 bg-slate-50",
};

const HEADER_COLOR: Record<string, string> = {
  blue: "text-blue-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
  slate: "text-slate-700",
};

export default function SitemapPage() {
  const totalLinks = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
            ← Главная
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">🗺 Карта тренажёра</h1>
          <p className="text-sm text-slate-600 mt-1">
            Все {totalLinks} страниц на одном экране — по логическим разделам. Используйте как
            оглавление платформы.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className={`border-2 rounded-lg p-4 ${COLOR_MAP[section.color] ?? "border-slate-200"}`}
            >
              <h2 className={`text-base font-bold mb-1 ${HEADER_COLOR[section.color] ?? "text-slate-700"}`}>
                {section.title}
              </h2>
              <p className="text-[11px] text-slate-600 mb-3 italic">{section.subtitle}</p>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-2 group hover:bg-white rounded p-1.5 transition-colors"
                    >
                      <span className="text-lg leading-none">{item.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-slate-800 group-hover:underline">
                          {item.title}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Прямые ссылки на экзамены (для быстрого доступа) */}
        <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-base font-bold text-slate-800 mb-3">
            🎓 Прямые ссылки на все {EXAM_TASKS.length} экзаменов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {EXAM_TASKS.map((t) => (
              <Link
                key={t.id}
                href={`/smeta-trainer/exam/${t.id}`}
                className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded hover:bg-slate-50 text-xs"
              >
                <span className="text-base">{t.icon}</span>
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-[10px] text-slate-400">{t.difficulty}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 text-[11px] text-slate-500 italic text-center">
          AEVION Smeta Trainer · НДЦС РК 8.01-08-2022 · 399 расценок ЭСН · 189 493 материала ССЦ ·
          15 AI-сценариев · {EXAM_TASKS.length} экзаменационных кейсов
        </div>
      </div>
    </div>
  );
}
