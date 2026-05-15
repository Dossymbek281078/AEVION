"use client";

import Link from "next/link";
import { useState } from "react";

type TabId = "gov" | "private";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "gov", label: "Госзакупки (zakup.sk.kz)", icon: "🏛" },
  { id: "private", label: "Частные тендеры", icon: "🤝" },
];

const PROCUREMENT_METHODS: { method: string; scope: string; term: string }[] = [
  { method: "Из одного источника", scope: "До 6 000 МРП (~36 млн тг 2025) для услуг", term: "5-15 дней" },
  { method: "Запрос ценовых предложений", scope: "До 8 000 МРП (~48 млн тг) для товаров", term: "7-14 дней" },
  { method: "Открытый конкурс", scope: "Свыше 8 000 МРП", term: "30-45 дней" },
  { method: "Двухэтапный конкурс", scope: "Сложные объекты, инновации", term: "60-90 дней" },
  { method: "Конкурс с предварительным отбором", scope: "По проектным организациям", term: "45-60 дней" },
  { method: "Аукцион (на понижение)", scope: "Стандартизированные товары", term: "5-7 дней" },
];

const BID_DOCUMENTS: { num: number; title: string; details?: string }[] = [
  { num: 1, title: "Заявление об участии (стандартная форма)" },
  { num: 2, title: "Учредительные документы (копии)" },
  { num: 3, title: "Лицензия СМР (1, 2 или 3 категория)" },
  { num: 4, title: "Сертификат СТ-РК ИСО 9001 (система менеджмента качества)" },
  { num: 5, title: "Опыт работы — список выполненных объектов (3-5 за последние 3 года)" },
  { num: 6, title: "Финансовая отчётность (баланс за 2-3 года)" },
  { num: 7, title: "Справка о платежеспособности от банка" },
  { num: 8, title: "Справка об отсутствии долгов перед бюджетом (Налоговый комитет)" },
  {
    num: 9,
    title: "СМЕТНАЯ ДОКУМЕНТАЦИЯ:",
    details: "Сводный сметный расчёт (Ф-3) на бланке заказчика; Локальные сметы (Ф-2 / ЛСР) по разделам; Ведомость объёмов работ (ВОР); График производства работ; Расчёт стоимости материалов",
  },
  { num: 10, title: "Технические предложения (методы выполнения, оборудование)" },
  { num: 11, title: "Гарантийное обеспечение конкурсной заявки (1-3% от стоимости)" },
  { num: 12, title: "Предложение в стоимостном выражении (запечатанный конверт или электронно)" },
];

const STEPS_GOV: string[] = [
  "Поиск конкурса на zakup.sk.kz по ОКЭД и региону",
  "Скачивание тендерной документации",
  "Изучение требований и сметы заказчика",
  "Подготовка собственной сметы (с учётом своих расценок)",
  "Сбор и оформление документов (см. список)",
  "Внесение обеспечения заявки (1-3% от стоимости на эскроу)",
  "Подача заявки в установленный срок",
  "Участие в комиссии (открытое вскрытие)",
  "Ожидание решения комиссии (5-15 дней)",
  "Заключение договора (при выигрыше)",
  "Подписание ДКА (договорной коммерческой документации) — приложения к договору",
];

const PRIVATE_PLATFORMS: { platform: string; type: string; audience: string }[] = [
  { platform: "Pro Zakupki", type: "Открытая", audience: "Малый-средний бизнес РК" },
  { platform: "Tenderer", type: "Платная подписка", audience: "Частные строительные подряды" },
  { platform: "Bigfish (Kaspi)", type: "B2B-площадка", audience: "Розничный сегмент" },
  { platform: "LinkedIn / Telegram-каналы", type: "Неформальные", audience: "Прямые приглашения от заказчиков" },
  { platform: "Связи и репутация", type: "Самое эффективное", audience: "Опытные подрядчики" },
];

const CHECKLIST_ITEMS: string[] = [
  "Уставные документы актуальны",
  "Лицензия СМР действующая (срок не истёк)",
  "СТ-РК ИСО 9001 сертификат действующий",
  "Финансовая отчётность за 2 года готова",
  "Справка из банка о платежеспособности",
  "Справка из налогового комитета об отсутствии долгов",
  "Опыт работы документирован (5 объектов)",
  "Свободные средства для обеспечения заявки (1-3%)",
  "Расчёт сметы готов с учётом наших расценок",
  "График производства работ согласован",
];

interface Exercise {
  id: string;
  title: string;
  question: string;
  hint: string;
  validate: (input: string) => { ok: boolean; message: string };
  explanation: string;
}

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упражнение 1. Размер обеспечения конкурсной заявки",
    question: "Стоимость работ по тендеру: 80 000 000 тг. Обеспечение 2% (типовое значение). Сколько составит сумма обеспечения, тг?",
    hint: "Введи число в тенге без пробелов (допуск ±1%)",
    validate: (input) => {
      const num = parseFloat(input.replace(/[\s,]/g, "").replace(",", "."));
      if (Number.isNaN(num)) return { ok: false, message: "Введи число" };
      const correct = 1_600_000;
      const diff = Math.abs(num - correct) / correct;
      if (diff <= 0.01) return { ok: true, message: `Верно! 80 000 000 · 0.02 = ${correct.toLocaleString("ru-RU")} тг` };
      return { ok: false, message: `Неверно. Правильно: ${correct.toLocaleString("ru-RU")} тг` };
    },
    explanation: "Обеспечение конкурсной заявки = стоимость · % обеспечения. Стандарт по госзакупкам РК — 1-3% от цены.",
  },
  {
    id: "ex2",
    title: "Упражнение 2. Категория лицензии СМР для жилого 9-этажного дома",
    question: "9 этажей × ~2.5 млн тг/м² ≈ 5 млрд тг (для 2300 м²). Какая категория лицензии СМР подойдёт? Введи: «1» или «2»",
    hint: "1 — без ограничений, 2 — до 100 млрд, 3 — до 5 млрд",
    validate: (input) => {
      const v = input.trim();
      if (v === "1" || v === "2") {
        return { ok: true, message: `Верно! Для крупных объектов (~5 млрд тг и выше) подходит ${v} категория` };
      }
      return { ok: false, message: "Неверно. Правильный: 1 или 2 категория. 3 категория — только до 5 млрд тг" };
    },
    explanation: "3 категория — для работ до 5 млрд (примерно одно здание). Для крупных объектов нужна 2 (до 100 млрд) или 1 (без ограничений).",
  },
  {
    id: "ex3",
    title: "Упражнение 3. Признаки демпинга — определи лишнее",
    question: "Какой из этих признаков НЕ является демпингом? Введи букву: a, b, c или d",
    hint: "a) Цена ниже сметы на 35%; b) НР=80%, СП=40%; c) Нет позиций ВЗС; d) Поставщик материалов ниже рынка на 5%",
    validate: (input) => {
      const v = input.trim().toLowerCase();
      if (v === "d") return { ok: true, message: "Верно! 5% — нормальный дисконт от поставщика по объёму. Демпинг начинается с 10%+" };
      return { ok: false, message: "Неверно. Правильный ответ: d. 5% от поставщика — это норма, не демпинг" };
    },
    explanation: "Цена -35% от сметы, НР+СП=120% (мало), отсутствие ВЗС — все три признаки демпинга. А вот 5% скидка от поставщика — обычная коммерческая практика.",
  },
  {
    id: "ex4",
    title: "Упражнение 4. Сроки участия в открытом конкурсе на госзакупках",
    question: "Сколько дней (примерно) длится весь процесс: размещение → подача → решение → договор? Введи число дней (диапазон 65-90, допуск ±15%)",
    hint: "Подача заявок: 30-45 дн + Решение: 5-15 дн + Договор: до 30 дн",
    validate: (input) => {
      const num = parseFloat(input.replace(/[\s,]/g, "").replace(",", "."));
      if (Number.isNaN(num)) return { ok: false, message: "Введи число" };
      const min = 65 * 0.85;
      const max = 90 * 1.15;
      if (num >= min && num <= max) {
        return { ok: true, message: `Верно! Полный цикл — 65-90 дней (с допуском ±15%)` };
      }
      return { ok: false, message: `Неверно. Правильный диапазон: 65-90 дней` };
    },
    explanation: "Размещение → подача заявок: 30-45 дней. Подача → решение: 5-15 дней. Подписание договора: до 30 дней. Итого: 65-90 дней.",
  },
];

export default function BiddingPage() {
  const [tab, setTab] = useState<TabId>("gov");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [checklist, setChecklist] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));

  const checkExercise = (ex: Exercise) => {
    const result = ex.validate(answers[ex.id] ?? "");
    setResults((prev) => ({ ...prev, [ex.id]: result }));
    if (result.ok) setRevealed((prev) => ({ ...prev, [ex.id]: true }));
  };

  const toggleChecklist = (i: number) => {
    setChecklist((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const checklistDone = checklist.filter(Boolean).length;

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
              🏆 Тендеры и госзакупки РК — состав конкурсной заявки
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Госзакупки · частные тендеры · документы · демпинг · 4 упражнения + чек-лист готовности
            </p>
          </div>
        </div>
      </header>

      {/* Info bar */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-6 py-2 text-xs text-emerald-800 dark:text-emerald-300">
        💡 Сметчик — ключевая фигура в подготовке конкурсной заявки. Без грамотной сметы и расчётов выиграть тендер невозможно.
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Описание */}
        <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-700 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3">
            📌 Кратко о тендерах РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                🏛 ГОСЗАКУПКИ
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Обязательны для всех закупок госорганов и нацкомпаний.<br />
                <b>Платформа:</b> zakup.sk.kz (Государственные закупки).<br />
                <b>Регулирование:</b> Закон РК «О государственных закупках» № 434-V (2015)
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                🤝 ЧАСТНЫЕ ТЕНДЕРЫ
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Добровольные, у бизнес-заказчиков.<br />
                <b>Платформы:</b> Pro Zakupki, Tenderer, прямые приглашения.<br />
                <b>Регулирование:</b> Гражданский кодекс РК (статья 916).
              </p>
            </div>
          </div>
        </div>

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
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-300 dark:border-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: Госзакупки */}
        {tab === "gov" && (
          <div className="space-y-5">
            {/* Способы закупа */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 border-b border-emerald-200 dark:border-emerald-800">
                <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Способы закупа
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-1/3">Способ</th>
                      <th className="px-3 py-2 text-left font-semibold">Для каких закупок</th>
                      <th className="px-3 py-2 text-left font-semibold w-32">Сроки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROCUREMENT_METHODS.map((row, i) => (
                      <tr
                        key={row.method}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          {row.method}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.scope}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.term}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Состав конкурсной заявки */}
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3">
                📦 Состав конкурсной заявки на СМР
              </h3>
              <ol className="space-y-2 text-xs">
                {BID_DOCUMENTS.map((doc) => (
                  <li key={doc.num} className="flex gap-2">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0 min-w-[1.5rem]">
                      {doc.num}.
                    </span>
                    <div className="flex-1">
                      <span className={`text-slate-800 dark:text-slate-200 ${doc.details ? "font-bold" : ""}`}>
                        {doc.title}
                      </span>
                      {doc.details && (
                        <ul className="mt-1 ml-3 space-y-0.5 list-disc list-inside text-slate-600 dark:text-slate-400">
                          {doc.details.split("; ").map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Шаги участия */}
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3">
                🚶 Шаги участия в открытом конкурсе
              </h3>
              <ol className="space-y-1.5 text-xs">
                {STEPS_GOV.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* TAB 2: Частные тендеры */}
        {tab === "private" && (
          <div className="space-y-5">
            {/* Отличия */}
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3">
                🤝 Отличия от госзакупок
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2 list-disc list-inside">
                <li><b>Меньше формализма</b> — всё на договорной основе</li>
                <li><b>Цена не главный критерий</b> — учитываются репутация, опыт</li>
                <li><b>Можно вести переговоры</b> (в госзакупках жёсткая процедура)</li>
                <li><b>Меньше документов</b> (часто хватает портфолио и сметы)</li>
                <li><b>Более частые повторные обсуждения цены</b></li>
              </ul>
            </div>

            {/* Платформы */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 border-b border-emerald-200 dark:border-emerald-800">
                <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Где искать частные тендеры
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Платформа</th>
                      <th className="px-3 py-2 text-left font-semibold">Тип</th>
                      <th className="px-3 py-2 text-left font-semibold">Аудитория</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRIVATE_PLATFORMS.map((row, i) => (
                      <tr
                        key={row.platform}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          i % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          {row.platform}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.type}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.audience}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Раздел 3: Демпинг */}
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-5">
          <div className="text-sm font-bold text-red-800 dark:text-red-300 mb-3">
            ⚠ ДЕМПИНГ — снижение цены ниже себестоимости работ
          </div>
          <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed mb-3">
            Цель — выиграть тендер. Это убыточная тактика, ведущая к:
          </p>
          <ul className="text-xs text-red-900 dark:text-red-200 space-y-1 list-disc list-inside mb-4">
            <li>Невыполнению обязательств подрядчиком</li>
            <li>Браку из-за экономии на материалах</li>
            <li>Срыву сроков</li>
            <li>Конфликтам и судебным спорам</li>
          </ul>

          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
            <div className="text-xs font-bold text-red-800 dark:text-red-300 mb-2">
              🚨 ПРИЗНАКИ ДЕМПИНГА
            </div>
            <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1 list-disc list-inside">
              <li>Цена ниже сметы заказчика на &gt;30% (норма ±5-10%)</li>
              <li>НР+СП меньше 100% от ФОТ (нормально 145-180%)</li>
              <li>Стоимость материалов ниже ССЦ РК на 10%+</li>
              <li>Отсутствие в смете ВЗС, ПИР, резерва (типично 5-10% общая)</li>
              <li>Срок выполнения нереально короткий</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="text-xs font-bold text-red-800 dark:text-red-300 mb-2">
              ⚖ ПОСЛЕДСТВИЯ
            </div>
            <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1 list-disc list-inside">
              <li>По ст. 19 Закона о госзакупках — отклонение заявки если цена «необоснованно низкая»</li>
              <li>Подрядчик обязан представить экономическое обоснование низкой цены</li>
              <li>Госкомиссия может отклонить демпинговую заявку</li>
            </ul>
          </div>
        </div>

        {/* Раздел 4: Упражнения */}
        <div className="mt-6">
          <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3 uppercase tracking-wide border-b border-emerald-200 dark:border-emerald-800 pb-1.5">
            🎯 4 интерактивных упражнения
          </h2>
          <div className="space-y-4">
            {EXERCISES.map((ex) => {
              const result = results[ex.id];
              const reveal = revealed[ex.id];
              return (
                <div
                  key={ex.id}
                  className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4"
                >
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                    {ex.title}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                    {ex.question}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 italic">
                    Подсказка: {ex.hint}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answers[ex.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [ex.id]: e.target.value }))
                      }
                      placeholder="Твой ответ"
                      className="flex-1 text-xs px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => checkExercise(ex)}
                      className="text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
                    >
                      Проверить
                    </button>
                  </div>
                  {result && (
                    <div
                      className={`mt-3 text-xs px-3 py-2 rounded-lg ${
                        result.ok
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      {result.ok ? "✓ " : "✗ "} {result.message}
                    </div>
                  )}
                  {reveal && (
                    <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      💡 <b>Пояснение:</b> {ex.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Чек-лист */}
        <div className="mt-6 bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              ✅ Чек-лист «Готовность к участию в тендере»
            </h2>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {checklistDone}/{CHECKLIST_ITEMS.length}
            </span>
          </div>
          <ul className="space-y-2">
            {CHECKLIST_ITEMS.map((item, i) => (
              <li key={i}>
                <label className="flex items-start gap-3 cursor-pointer text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/10 px-2 py-1.5 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist[i]}
                    onChange={() => toggleChecklist(i)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 shrink-0"
                  />
                  <span
                    className={`leading-relaxed ${
                      checklist[i]
                        ? "text-emerald-700 dark:text-emerald-400 line-through"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {item}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Фактоид */}
        <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-800 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">💡</span>
            <div>
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                Главный инсайт по тендерам
              </div>
              <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed italic">
                Выигранный тендер — только начало. Самое сложное впереди — выполнение в срок и в смету.
                <b> 60% подрядчиков теряют деньги на госзаказах</b> из-за плохого учёта рисков.
                Используй модули «риск-регистр» и «лучшие практики» перед подписанием договора.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
