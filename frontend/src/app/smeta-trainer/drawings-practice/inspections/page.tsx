"use client";

import Link from "next/link";
import { useState } from "react";

type TabId = "hidden" | "acts" | "executive";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "hidden", label: "Скрытые работы (АОСР)", icon: "🔒" },
  { id: "acts", label: "Акты КС-2 / КС-3", icon: "📑" },
  { id: "executive", label: "Исполнительная документация", icon: "📚" },
];

const HIDDEN_WORKS: { stage: string; what: string; attention: string }[] = [
  {
    stage: "Подготовка основания фундаментов",
    what: "Дно котлована, грунт",
    attention: "Соответствие проектной отметке, отсутствие воды/мусора",
  },
  {
    stage: "Установка арматуры фундаментов",
    what: "Каркас перед бетонированием",
    attention: "Сечения, шаг, защитный слой, привязка к опалубке",
  },
  {
    stage: "Гидроизоляция фундаментов",
    what: "До обратной засыпки",
    attention: "Целостность, перехлёсты ≥100 мм, отсутствие пропусков",
  },
  {
    stage: "Обратная засыпка пазух",
    what: "Послойно по 200 мм",
    attention: "Уплотнение, материал (песок/сугл.), Ку≥0.95",
  },
  {
    stage: "Армирование монолитных перекрытий",
    what: "До бетонирования",
    attention: "Сечения, шаг, защитный слой 25 мм, бортики",
  },
  {
    stage: "Гидроизоляция кровли",
    what: "Каждый слой отдельно",
    attention: "Перехлёсты, примыкания, чистота основания",
  },
  {
    stage: "Утепление кровли",
    what: "До устройства гидроизоляции",
    attention: "Толщина по проекту, плотность 35 кг/м³ для XPS",
  },
  {
    stage: "Скрытые электрокабели",
    what: "До штукатурки",
    attention: "Сечения, изоляция, схема разводки, заземление",
  },
  {
    stage: "Прокладка сетей в перекрытиях",
    what: "До бетонирования стяжки",
    attention: "Изоляция труб, привязка, отсутствие повреждений",
  },
  {
    stage: "Засыпка траншей наружных сетей",
    what: "Поэтапно",
    attention: "Песчаные слои, защита, сигнальная лента",
  },
];

const KS2_SECTIONS: { section: string; content: string }[] = [
  { section: "Шапка", content: "Объект, Заказчик, Подрядчик, отчётный период" },
  { section: "Перечень работ", content: "Расценки ЭСН + объёмы за период" },
  { section: "Расчёт стоимости", content: "Прямые затраты + НР + СП + индексы" },
  { section: "Итоги", content: "Стоимость работ за период" },
];

const EXECUTIVE_DOCS: { doc: string; who: string; when: string }[] = [
  { doc: "Акт приёмки геодезической разбивки", who: "Геодезист подрядчика + заказчик", when: "До начала работ" },
  { doc: "Журнал работ (КС-6)", who: "Производитель работ", when: "Ежедневно" },
  { doc: "Журнал бетонных работ", who: "Лаб. + прораб", when: "На каждое бетонирование" },
  { doc: "Журнал авторского надзора", who: "Проектировщик", when: "По вызову" },
  { doc: "Журнал входного контроля материалов", who: "Ответственное лицо", when: "На каждую партию" },
  { doc: "Журнал сварочных работ", who: "Главный сварщик", when: "Каждый сварной шов" },
  { doc: "Журнал АОСР", who: "Прораб", when: "По мере выполнения" },
  { doc: "Паспорта на материалы", who: "Поставщик", when: "На каждую партию" },
  { doc: "Сертификаты соответствия", who: "Поставщик", when: "На все материалы" },
  { doc: "Протоколы испытаний", who: "Лаборатория", when: "По каждой пробе" },
  { doc: "Исполнительные геодезические схемы", who: "Геодезист", when: "После каждого этапа" },
  { doc: "Сводный акт приёмки", who: "Все стороны + ОГК", when: "На сдаче" },
];

const AOSR_TEMPLATE = `АКТ ОСВИДЕТЕЛЬСТВОВАНИЯ СКРЫТЫХ РАБОТ № ___
Объект: Школа №47, г. Алматы
Работа: Армирование ленточного фундамента (оси 1-3)
Дата: __________
Состав комиссии:
  - Представитель заказчика: __________
  - Представитель ген. подрядчика: __________
  - Представитель тех. надзора: __________
Предъявлены к освидетельствованию работы:
  арматурный каркас Ø12 А500С, шаг 200×200 мм
Соответствует проекту: __________ лист __________
Работы выполнены в соответствии с: ГОСТ, СП, проектом
Разрешается приступить к: бетонированию
Подписи: __________`;

const KS2_EXAMPLE = `№ | Шифр расценки    | Наименование работ        | Ед. | Кол-во | Цена 2001 г. | Сумма 2001 г. | Индекс | Сумма текущ.
1 | ЭСН 6-01-001-1   | Бетонирование фундамента  | м³  | 12.5   | 854.30 тг    | 10678.75 тг   | 11.42  | 121951 тг`;

export default function InspectionsPage() {
  const [tab, setTab] = useState<TabId>("hidden");

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
              ✅ Приёмка работ — акты, скрытые работы, исполнительная документация
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              АОСР · КС-2 / КС-3 · полный комплект исполнительной документации для сдачи объекта
            </p>
          </div>
        </div>
      </header>

      {/* Info bar */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 px-6 py-2 text-xs text-indigo-800 dark:text-indigo-300">
        💡 Без правильно оформленной приёмки работ объект не примут на госкомиссию. Это финальная защита сметчика и прораба.
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

        {/* TAB 1: Скрытые работы (АОСР) */}
        {tab === "hidden" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                🔒 Что такое скрытые работы
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <b>Скрытые работы</b> — те, что после следующих этапов уже не видны. Без АОСР следующий этап
                начинать <b className="text-red-600 dark:text-red-400">НЕЛЬЗЯ</b>.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Норматив: <b>СНиП РК 1.03-05-2001</b>, <b>ПР РК 218-21-05</b>.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  Перечень обязательных АОСР
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-1/4">Этап</th>
                      <th className="px-3 py-2 text-left font-semibold w-1/4">Что осматривают</th>
                      <th className="px-3 py-2 text-left font-semibold">На что обращать внимание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HIDDEN_WORKS.map((row, i) => (
                      <tr
                        key={row.stage}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          {row.stage}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.what}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.attention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">
                📝 Пример заполнения акта АОСР
              </div>
              <pre className="text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono leading-relaxed">
{AOSR_TEMPLATE}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: Акты КС-2 / КС-3 */}
        {tab === "acts" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                📑 Акты КС-2 и КС-3
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <b>КС-2</b> — Акт о приёмке выполненных работ (помесячный).<br />
                <b>КС-3</b> — Справка о стоимости выполненных работ и затрат.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                По <b>МДС 81-25.2004</b>, формы постановления Госкомстата.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  Что включает КС-2
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-1/3">Раздел</th>
                      <th className="px-3 py-2 text-left font-semibold">Содержание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KS2_SECTIONS.map((row, i) => (
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

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">
                🔢 Пример строки в КС-2
              </div>
              <pre className="text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono leading-relaxed">
{KS2_EXAMPLE}
              </pre>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                📊 КС-3 — Справка о стоимости
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Включает: основные работы по КС-2 + НР + СП + НДС</li>
                <li>Содержит итог по объекту нарастающим итогом и за отчётный период</li>
                <li>
                  Подписывается заказчиком <b>до перевода средств</b>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: Исполнительная документация */}
        {tab === "executive" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                📚 Исполнительная документация
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <b>Исполнительная документация</b> — комплект документов о фактически выполненных работах.
                Без неё объект на госкомиссию <b className="text-red-600 dark:text-red-400">НЕ передаётся</b>.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Норматив: <b>СН РК 1.03-00-2011 «Приёмка объектов в эксплуатацию»</b>.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  Состав исполнительной документации
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Документ</th>
                      <th className="px-3 py-2 text-left font-semibold">Кто оформляет</th>
                      <th className="px-3 py-2 text-left font-semibold">Когда</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXECUTIVE_DOCS.map((row, i) => (
                      <tr
                        key={row.doc}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          {row.doc}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.who}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl p-5">
              <div className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
                ⚠ ТИПИЧНЫЕ НАРУШЕНИЯ
              </div>
              <ul className="text-xs text-red-900 dark:text-red-200 space-y-1.5 list-disc list-inside">
                <li>
                  <b>Отсутствие АОСР</b> на скрытые работы → объект не примут
                </li>
                <li>
                  <b>Отсутствие протоколов испытаний бетона</b> → не подтверждена прочность
                </li>
                <li>
                  <b>Отсутствие журнала входного контроля</b> → нельзя подтвердить применение материалов
                </li>
                <li>
                  <b>Несоответствие исполнительных схем проекту</b> → требуется проектное решение
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Фактоид внизу страницы */}
        <div className="mt-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-800 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">📌</span>
            <div>
              <div className="text-xs font-bold text-purple-800 dark:text-purple-300 mb-1">
                МДС 81-25.2004 п.2.10
              </div>
              <p className="text-xs text-purple-900 dark:text-purple-200 leading-relaxed italic">
                «Стоимость работ по составлению актов и ведению исполнительной документации учтена в накладных
                расходах. Отдельно <b>НЕ оплачивается</b>.»
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
