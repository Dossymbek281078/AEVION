"use client";

import Link from "next/link";
import { useState } from "react";

type TabId = "pos" | "ppr";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "pos", label: "ПОС — Проект организации строительства", icon: "📐" },
  { id: "ppr", label: "ППР — Проект производства работ", icon: "🛠" },
];

const POS_SECTIONS: { section: string; content: string; who: string }[] = [
  {
    section: "1. Календарный план",
    content: "График работ помесячно по разделам",
    who: "Проектировщик ОВ или ПОС-специалист",
  },
  {
    section: "2. Стройгенплан",
    content: "План площадки с расположением временных",
    who: "На стадии П — общий, без деталей",
  },
  {
    section: "3. Грузопотоки и транспортная схема",
    content: "Маршруты доставки и техники",
    who: "По расчёту",
  },
  {
    section: "4. Потребность в кадрах",
    content: "Графики по специальностям",
    who: "По выработке СМР/чел/мес",
  },
  {
    section: "5. Потребность в строительных машинах",
    content: "По типам и срокам",
    who: "По нормам потребности",
  },
  {
    section: "6. Потребность в материалах",
    content: "По объёмам и срокам",
    who: "Из ВОР",
  },
  {
    section: "7. Временные здания и сооружения",
    content: "Кол-во и тип",
    who: "По СН РК 8.04",
  },
  {
    section: "8. Геодезические работы",
    content: "Перечень разбивки",
    who: "Геодезист",
  },
  {
    section: "9. Инженерные сети ПОС",
    content: "Электр., вода, канализация на период стр-ва",
    who: "По ТУ",
  },
  {
    section: "10. ТЭП ПОС",
    content: "Технико-экономические показатели",
    who: "По объекту",
  },
];

const PPR_SECTIONS: { section: string; content: string }[] = [
  {
    section: "Пояснительная записка",
    content: "Описание объекта, технологии, обоснование решений",
  },
  {
    section: "Стройгенплан в м-ште 1:200/500",
    content: "Детальный план с размерами, ограждениями, складами",
  },
  {
    section: "Календарный план работ",
    content: "Сетевой график или диаграмма Ганта по неделям",
  },
  {
    section: "Технологические карты на основные работы",
    content: "По одной на каждый вид (земля, бетон, монтаж и т.д.)",
  },
  {
    section: "Схемы строповки грузов",
    content: "Для каждого типового груза с расчётом",
  },
  {
    section: "Решения по охране труда",
    content: "Перечень опасных зон, СИЗ, ограждений",
  },
  {
    section: "Решения по пожарной безопасности",
    content: "Эвак. выходы, огнетушители, противопожарные посты",
  },
  {
    section: "Расчёт временных нагрузок",
    content: "На леса, перекрытия, крановые пути",
  },
  {
    section: "Решения по обеспечению качества",
    content: "Контроль материалов, приёмка скрытых работ",
  },
  {
    section: "Геодезическое обеспечение",
    content: "Реперы, инструменты, журнал",
  },
];

const COMPARE_ROWS: { param: string; pos: string; ppr: string }[] = [
  {
    param: "Когда разрабатывается",
    pos: "На стадии «Проект»",
    ppr: "На стадии Р или перед началом работ",
  },
  {
    param: "Кто разрабатывает",
    pos: "Проектировщик",
    ppr: "Подрядчик (ИТР, техотдел)",
  },
  {
    param: "Кто утверждает",
    pos: "Заказчик в составе проекта",
    ppr: "Главный инженер подрядчика",
  },
  {
    param: "Детализация",
    pos: "Общая (на весь объект)",
    ppr: "Детальная (по операциям)",
  },
  {
    param: "Срок действия",
    pos: "На период строительства",
    ppr: "На период действия договора",
  },
  {
    param: "Где живёт затрат",
    pos: "В лимите ПИР (5-7% от СМР)",
    ppr: "В НР подрядчика (входит в накл.)",
  },
  {
    param: "Изменения",
    pos: "По-проектному, через корректировку",
    ppr: "Может корректироваться оперативно",
  },
];

const SGP_OBJECTS: { object: string; symbol: string; norm: string }[] = [
  { object: "Существующие здания", symbol: "Сплошной контур", norm: "СН РК 1.03-00" },
  { object: "Проектируемое здание", symbol: "Заштрихованный контур", norm: "СН РК 1.03-00" },
  { object: "Башенный кран", symbol: "Окружность с радиусом действия", norm: "СНиП РК 1.03-05 п. 6.1" },
  { object: "Зона действия крана", symbol: "Пунктирная окружность", norm: "СНиП РК 1.03-05 п. 6.2" },
  { object: "Опасная зона крана", symbol: "Толстая пунктирная окружность", norm: "СНиП РК 1.03-05 п. 6.4" },
  { object: "Бытовой городок", symbol: "Прямоугольник с числом мест", norm: "По нормам ВЗ-СС" },
  { object: "Открытый склад", symbol: "Штрихованный прямоугольник", norm: "По спецификации" },
  { object: "Закрытый склад", symbol: "Прямоугольник с диагоналями", norm: "По СН РК 8.04" },
  { object: "Временные дороги", symbol: "Двойная линия с обозначением ширины", norm: "СН РК 1.03-04" },
  { object: "Площадка для отдыха", symbol: "Кружок с надписью", norm: "По нормам" },
  { object: "Пожарные гидранты", symbol: "Условное обозначение Ø", norm: "СНиП РК 2.02-05" },
  { object: "Электрощит", symbol: "Прямоугольник Э", norm: "По схеме энергопитания" },
  { object: "Светильник прожекторный", symbol: "⊙", norm: "По расчёту освещённости" },
];

export default function PosPprPage() {
  const [tab, setTab] = useState<TabId>("pos");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📋 ПОС и ППР — проект организации стр-ва и производства работ
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Состав, разработчики, утверждение, затраты, стройгенплан, технологические карты
            </p>
          </div>
        </div>
      </header>

      {/* Info bar */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 px-6 py-2 text-xs text-indigo-800 dark:text-indigo-300">
        💡 ПОС — для получения разрешения на стр-во. ППР — для безопасного выполнения работ. Без них — нельзя.
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-indigo-600 text-indigo-700 dark:text-indigo-300 dark:border-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: ПОС */}
        {tab === "pos" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                📐 ПОС — Проект Организации Строительства
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Разрабатывается на стадии <b>«Проект» (П)</b>.<br />
                Часть проектной документации — <b>раздел 6 по ПП РК № 1018</b>.<br />
                Утверждается <b className="text-indigo-700 dark:text-indigo-300">ВМЕСТЕ С ПРОЕКТОМ</b>.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Норматив: <b>СН РК 1.03-00-2011</b> «Состав и порядок разработки проектной документации»;{" "}
                <b>ПП РК № 1018 от 19.07.2017</b>.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Состав ПОС</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-1/4">Раздел ПОС</th>
                      <th className="px-3 py-2 text-left font-semibold w-2/5">Содержание</th>
                      <th className="px-3 py-2 text-left font-semibold">Кто разрабатывает</th>
                    </tr>
                  </thead>
                  <tbody>
                    {POS_SECTIONS.map((row, i) => (
                      <tr
                        key={row.section}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          {row.section}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.content}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.who}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
              <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                💰 Затраты на ПОС в смете
              </div>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>ПОС <b>не включается отдельной строкой</b> в смету (входит в стоимость ПИР)</li>
                <li>Лимит ПИР для нового стр-ва: <b>5-7% от СМР</b> (МДС 81-25 Прил. №2)</li>
                <li>Для реконструкции: <b>7-10%</b></li>
                <li>Соотношение: <b>ПОС ≈ 15-20% от ПИР</b>, остальное — рабочая документация</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: ППР */}
        {tab === "ppr" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                🛠 ППР — Проект Производства Работ
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Разрабатывается на стадии <b>«Рабочая документация» (РД)</b> или подрядчиком{" "}
                <b>ПЕРЕД</b> началом работ.
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-2">
                <b className="text-red-600 dark:text-red-400">ОБЯЗАТЕЛЕН</b> для:
              </p>
              <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc list-inside ml-2 mt-1 space-y-0.5">
                <li>Зданий <b>выше 2 этажей</b></li>
                <li>Работ с применением <b>кранов</b></li>
                <li>Работ в <b>стеснённых условиях</b></li>
                <li>Работ <b>повышенной опасности</b></li>
              </ul>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                Норматив: <b>СНиП РК 1.03-05-2001</b>, <b>ПР РК 218-19</b>.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Состав ППР</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-2/5">Раздел ППР</th>
                      <th className="px-3 py-2 text-left font-semibold">Содержание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PPR_SECTIONS.map((row, i) => (
                      <tr
                        key={row.section}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          {row.section}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
              <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                💰 Затраты на ППР
              </div>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>ППР включается в <b>накладные расходы подрядчика</b> (не отдельной строкой)</li>
                <li>Стоимость разработки: <b>0.5-1.5% от стоимости СМР</b> объекта</li>
                <li>Готовится: <b>техотделом подрядчика</b> или специализированной фирмой</li>
              </ul>
            </div>
          </div>
        )}

        {/* Сравнение ПОС vs ППР */}
        <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
            <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
              ⚖ Сравнение ПОС vs ППР
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold w-1/4">Параметр</th>
                  <th className="px-3 py-2 text-left font-semibold">ПОС</th>
                  <th className="px-3 py-2 text-left font-semibold">ППР</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr
                    key={row.param}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                      {row.param}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.pos}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.ppr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Технологические карты */}
        <div className="mt-6 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
            🗂 Технологические карты
          </h3>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <b>Технологическая карта</b> — главный исполнительный документ ППР
            </li>
            <li>
              Содержит: схему производства работ, расчёт ресурсов, контроль качества, охрану труда
            </li>
            <li>
              Стандарт: <b>СН РК 1.03-04</b> «Технологические карты в строительстве»
            </li>
          </ul>
          <div className="mt-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="font-semibold mb-1.5 text-slate-800 dark:text-slate-200">Виды:</div>
            <ul className="space-y-1.5 ml-2">
              <li>
                <b className="text-indigo-700 dark:text-indigo-300">Типовая</b> — на массовые работы
                (бетонирование колонн, кладка стен)
              </li>
              <li>
                <b className="text-indigo-700 dark:text-indigo-300">Привязанная</b> — типовая,
                адаптированная к конкретному объекту
              </li>
              <li>
                <b className="text-indigo-700 dark:text-indigo-300">Индивидуальная</b> — на уникальные
                работы (пересадка дерева &gt;5 м, демонтаж в стеснён. условиях)
              </li>
            </ul>
          </div>
        </div>

        {/* Стройгенплан — что показывается */}
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
            <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
              🗺 Стройгенплан — что показывается
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold w-1/3">Объект на СГП</th>
                  <th className="px-3 py-2 text-left font-semibold w-1/3">Условное обозначение</th>
                  <th className="px-3 py-2 text-left font-semibold">Норматив</th>
                </tr>
              </thead>
              <tbody>
                {SGP_OBJECTS.map((row, i) => (
                  <tr
                    key={row.object}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                      {row.object}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.symbol}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.norm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Финальный фактоид */}
        <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700 rounded-xl p-5">
          <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2">
            💡 ВАЖНО
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Без утверждённого <b>ПОС</b> в составе проектной документации объект{" "}
            <b className="text-red-600 dark:text-red-400">НЕ ПОЛУЧИТ</b> разрешение на строительство.
            Без <b>ППР</b> подрядчик{" "}
            <b className="text-red-600 dark:text-red-400">НЕ ИМЕЕТ ПРАВА</b> начинать работы (
            <b>ст. 142 КоАП РК</b> — штраф до <b>500 МРП</b>).
          </p>
        </div>
      </div>
    </div>
  );
}
