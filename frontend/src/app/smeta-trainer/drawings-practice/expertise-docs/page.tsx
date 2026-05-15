"use client";

import Link from "next/link";
import { useState } from "react";

export default function ExpertiseDocsPage() {
  // Упражнение 1: стоимость госэкспертизы (numeric ±20%)
  const [ex1Answer, setEx1Answer] = useState("");
  const [ex1Result, setEx1Result] = useState<null | "ok" | "bad">(null);
  const [ex1ShowSolution, setEx1ShowSolution] = useState(false);

  // Упражнение 2: срок проведения госэкспертизы (multiple-choice)
  const [ex2Answer, setEx2Answer] = useState<string | null>(null);
  const [ex2Result, setEx2Result] = useState<null | "ok" | "bad">(null);
  const [ex2ShowSolution, setEx2ShowSolution] = useState(false);

  // Упражнение 3: когда обязательна госэкспертиза (multiple-choice)
  const [ex3Answer, setEx3Answer] = useState<string | null>(null);
  const [ex3Result, setEx3Result] = useState<null | "ok" | "bad">(null);
  const [ex3ShowSolution, setEx3ShowSolution] = useState(false);

  // Упражнение 4: типичные замечания в сметной части (multiple-choice)
  const [ex4Answer, setEx4Answer] = useState<string | null>(null);
  const [ex4Result, setEx4Result] = useState<null | "ok" | "bad">(null);
  const [ex4ShowSolution, setEx4ShowSolution] = useState(false);

  // Чек-лист документов в ГосЭкспертизу
  const [checklist, setChecklist] = useState<boolean[]>(Array(8).fill(false));

  const toggleCheck = (i: number) => {
    setChecklist((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const checkEx1 = () => {
    const target = 250000; // 0.5% от 50 млн тг
    const val = parseFloat(ex1Answer.replace(/\s/g, "").replace(",", "."));
    if (isNaN(val)) {
      setEx1Result("bad");
      return;
    }
    const tolerance = target * 0.2;
    setEx1Result(Math.abs(val - target) <= tolerance ? "ok" : "bad");
  };

  const checkEx2 = () => setEx2Result(ex2Answer === "b" ? "ok" : "bad");
  const checkEx3 = () => setEx3Result(ex3Answer === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Result(ex4Answer === "c" ? "ok" : "bad");

  const expertiseTypes = [
    {
      name: "Государственная (ГосЭкспертиза РК)",
      desc: "Проводится РГП «Госэкспертиза» под эгидой Комитета по делам строительства МИИР. Обязательна для бюджетных объектов и жилых домов от 24 квартир и выше.",
      example: "Школа на 1200 учеников, многоэтажка 9 этажей",
    },
    {
      name: "Негосударственная (СРО-экспертные организации)",
      desc: "Аккредитованные коммерческие экспертные организации, входящие в СРО. Применяется для частных объектов, небольшого жилья, коммерческой недвижимости.",
      example: "Частный коттедж 350 м², небольшой ТРЦ",
    },
    {
      name: "Тематическая (по спец. вопросам)",
      desc: "Узкоспециализированная экспертиза отдельных разделов: пожарная безопасность (Госпожнадзор), экология (МЭГПР), санэпид (СЭС), инженерные изыскания.",
      example: "Раздел ПБ для здания с массовым пребыванием",
    },
    {
      name: "Авторская (проверка сметчиком)",
      desc: "Внутренняя проверка сметчиком расчётов проектировщика до подачи в ГосЭкспертизу. Выявляет ошибки заранее, экономит время и деньги на устранение замечаний.",
      example: "Сверка ВОР АР с локальной сметой ф. 4-К",
    },
  ];

  const stages = [
    {
      n: 1,
      title: "Подача документов через ЦОН (eGov.kz)",
      detail:
        "Заказчик или его представитель подаёт пакет проектной и сметной документации через портал eGov.kz или физически в ЦОНе. Оплачивается госпошлина по утверждённой шкале.",
    },
    {
      n: 2,
      title: "Назначение экспертов (24 часа)",
      detail:
        "В течение одних суток с момента регистрации заявления начальник филиала назначает группу экспертов: главный, по архитектуре, по конструкциям, по сметной части, по инженерным сетям.",
    },
    {
      n: 3,
      title: "Анализ проектной части (15-30 дней)",
      detail:
        "Эксперты проверяют соответствие проекта СН РК, СП РК, ГОСТам. Оценивают архитектурные, конструктивные и инженерные решения, расчёты на нагрузки, сейсмику. Срок зависит от категории сложности.",
    },
    {
      n: 4,
      title: "Анализ сметной части (10-20 дней)",
      detail:
        "Проверка сметной документации: применение актуальных ЭСН, ССЦ, индексов перевода, обоснованность материалов по СНБ, корректность расчёта НР и СП. Поиск двойного счёта и арифметических ошибок.",
    },
    {
      n: 5,
      title: "Выдача заключения (положительное / отрицательное / с замечаниями)",
      detail:
        "По итогам — комплексное заключение: положительное (можно строить), отрицательное (полная переработка), либо с замечаниями (срок устранения 30 дней). Без положительного заключения нельзя получить разрешение на строительство.",
    },
  ];

  const checklistItems = [
    "Заявление установленного образца на проведение экспертизы",
    "Проектная документация в полном объёме (стадия П или РП): АР, КЖ, КМ, ОВ, ВК, ЭО, СС, ПОС",
    "Сметная документация: сводный сметный расчёт, объектные и локальные сметы по формам РК",
    "Архитектурно-планировочное задание (АПЗ) от уполномоченного органа",
    "Технические условия (ТУ) на подключение к инженерным сетям (вода, газ, электроэнергия, канализация)",
    "Инженерно-геологические и геодезические изыскания на участок строительства",
    "Правоустанавливающие документы на земельный участок (акт на землю, договор аренды)",
    "Платёжное поручение об оплате услуг ГосЭкспертизы согласно утверждённой шкале тарифов",
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500 font-mono">
            AEVION Smeta Trainer / drawings-practice / expertise-docs
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* TITLE */}
        <section>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-purple-500 bg-clip-text text-transparent mb-4">
            🔬 Экспертиза проектной документации
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Экспертиза — обязательный этап перед началом строительства. Эксперты
            проверяют как проектные решения (архитектура, конструкции, инженерные
            сети), так и{" "}
            <span className="text-purple-400">сметную часть</span>: применение
            актуальных ЭСН, ССЦ и индексов, обоснованность материалов, расчёт НР
            и СП. Для бюджетных объектов и жилых домов от 24 квартир{" "}
            <span className="text-violet-300 font-semibold">
              госэкспертиза обязательна
            </span>
            .
          </p>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-purple-900/50 rounded-lg p-4">
              <div className="text-xs text-purple-400 uppercase tracking-wider mb-1">
                Главный закон
              </div>
              <div className="text-sm text-slate-200">
                Закон РК «О градостроительной деятельности» от 16.07.2001 № 242
              </div>
            </div>
            <div className="bg-slate-900 border border-violet-900/50 rounded-lg p-4">
              <div className="text-xs text-violet-400 uppercase tracking-wider mb-1">
                Норматив РК
              </div>
              <div className="text-sm text-slate-200">
                СН РК 1.02-19 «Порядок разработки, согласования, утверждения и
                состав проектной документации»
              </div>
            </div>
            <div className="bg-slate-900 border border-purple-900/50 rounded-lg p-4">
              <div className="text-xs text-purple-400 uppercase tracking-wider mb-1">
                Уполномоченный орган
              </div>
              <div className="text-sm text-slate-200">
                РГП «Госэкспертиза» при Комитете по делам строительства МИИР РК
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: ВИДЫ ЭКСПЕРТИЗ */}
        <section>
          <h2 className="text-2xl font-bold text-purple-400 mb-4">
            1. Виды экспертиз проектной документации
          </h2>
          <p className="text-slate-300 mb-5">
            В Республике Казахстан различают четыре основных вида экспертизы.
            Сметчик должен понимать, в каком случае какая экспертиза обязательна
            и как готовить под неё сметную часть.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-purple-300 font-semibold">
                    Вид экспертизы
                  </th>
                  <th className="text-left px-4 py-3 text-purple-300 font-semibold">
                    Описание
                  </th>
                  <th className="text-left px-4 py-3 text-purple-300 font-semibold">
                    Пример объекта
                  </th>
                </tr>
              </thead>
              <tbody>
                {expertiseTypes.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800 last:border-0 hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3 font-semibold text-violet-300 align-top">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-slate-300 align-top">
                      {t.desc}
                    </td>
                    <td className="px-4 py-3 text-slate-400 align-top text-xs italic">
                      {t.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 2: ЭТАПЫ ЭКСПЕРТИЗЫ */}
        <section>
          <h2 className="text-2xl font-bold text-purple-400 mb-4">
            2. Пять этапов проведения экспертизы
          </h2>
          <div className="space-y-4">
            {stages.map((s) => (
              <div
                key={s.n}
                className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-purple-800/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center font-bold text-white">
                    {s.n}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-violet-200 mb-2">
                      {s.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {s.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: УПРАЖНЕНИЯ */}
        <section>
          <h2 className="text-2xl font-bold text-purple-400 mb-4">
            3. Интерактивные упражнения
          </h2>
          <p className="text-slate-300 mb-6">
            Проверь, как ты усвоил правила прохождения экспертизы в РК — стоимость,
            сроки, обязательность и типовые ошибки в сметной части.
          </p>

          {/* УПРАЖНЕНИЕ 1 */}
          <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-purple-900/60 text-purple-200 px-2 py-1 rounded font-mono">
                Задача 1
              </span>
              <span className="text-xs text-slate-500">numeric ±20%</span>
            </div>
            <p className="text-slate-200 mb-4">
              Рассчитай стоимость государственной экспертизы для объекта с общей
              стоимостью СМР <span className="text-purple-300">50 000 000 тг</span>.
              По действующим ставкам 2025 года тариф ГосЭкспертизы РК составляет
              0,4–0,7% от стоимости СМР. Возьми среднее значение 0,5%.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex1Answer}
                onChange={(e) => setEx1Answer(e.target.value)}
                placeholder="например, 250000"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              />
              <span className="text-sm text-slate-400">тг</span>
              <button
                onClick={checkEx1}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1ShowSolution((v) => !v)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {ex1ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex1Result === "ok" && (
              <div className="mt-3 text-sm text-emerald-400">
                ✅ Верно! Допуск ±20% соблюдён.
              </div>
            )}
            {ex1Result === "bad" && (
              <div className="mt-3 text-sm text-rose-400">
                ❌ Не сходится. Проверь: стоимость СМР × 0,5%.
              </div>
            )}
            {ex1ShowSolution && (
              <div className="mt-4 bg-slate-950/60 border border-purple-900/40 rounded p-4 text-sm text-slate-300 space-y-1">
                <div>
                  <span className="text-purple-300">Формула:</span> 50 000 000 ×
                  0,005 = <span className="text-emerald-400">250 000 тг</span>
                </div>
                <div className="text-xs text-slate-500">
                  Точная ставка зависит от категории сложности (I-V) и размера
                  объекта. Для крупных объектов от 1 млрд тг применяется
                  понижающий коэффициент по утверждённой шкале МИИР РК.
                </div>
              </div>
            )}
          </div>

          {/* УПРАЖНЕНИЕ 2 */}
          <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-purple-900/60 text-purple-200 px-2 py-1 rounded font-mono">
                Задача 2
              </span>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-200 mb-4">
              Какой нормативный срок проведения государственной экспертизы для
              объекта <span className="text-purple-300">средней сложности</span>{" "}
              (2 категория) согласно действующим правилам РК?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "15 рабочих дней" },
                { id: "b", label: "30 рабочих дней" },
                { id: "c", label: "45 рабочих дней" },
                { id: "d", label: "60 рабочих дней" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${
                    ex2Answer === opt.id
                      ? "border-purple-600 bg-purple-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.id}
                    checked={ex2Answer === opt.id}
                    onChange={() => setEx2Answer(opt.id)}
                    className="accent-purple-500"
                  />
                  <span className="text-sm text-slate-200">
                    <span className="text-slate-500 mr-2 font-mono">
                      {opt.id})
                    </span>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={checkEx2}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2ShowSolution((v) => !v)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {ex2ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex2Result === "ok" && (
              <div className="mt-3 text-sm text-emerald-400">
                ✅ Верно! 30 рабочих дней — стандарт для средней сложности.
              </div>
            )}
            {ex2Result === "bad" && (
              <div className="mt-3 text-sm text-rose-400">
                ❌ Неверно. Подсказка: для 2 категории действует базовый срок.
              </div>
            )}
            {ex2ShowSolution && (
              <div className="mt-4 bg-slate-950/60 border border-purple-900/40 rounded p-4 text-sm text-slate-300 space-y-1">
                <div>
                  <span className="text-purple-300">Ответ:</span> b) 30 рабочих
                  дней
                </div>
                <div className="text-xs text-slate-500">
                  Для объектов 1-2 категории сложности — 30 рабочих дней. Для 3
                  категории — 45 дней, для технически сложных и особо опасных
                  (4-5 категория) — до 60 дней. Срок может быть продлён на 15
                  дней при необходимости дополнительной проверки.
                </div>
              </div>
            )}
          </div>

          {/* УПРАЖНЕНИЕ 3 */}
          <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-purple-900/60 text-purple-200 px-2 py-1 rounded font-mono">
                Задача 3
              </span>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-200 mb-4">
              Когда государственная экспертиза проектной документации обязательна
              согласно ЗРК «О градостроительной деятельности»?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Всегда, для любых объектов строительства" },
                {
                  id: "b",
                  label:
                    "Для бюджетных объектов и крупных жилых домов (от 24 квартир)",
                },
                {
                  id: "c",
                  label: "Только для государственных зданий и сооружений",
                },
                {
                  id: "d",
                  label: "По желанию заказчика, как платная услуга",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${
                    ex3Answer === opt.id
                      ? "border-purple-600 bg-purple-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3"
                    value={opt.id}
                    checked={ex3Answer === opt.id}
                    onChange={() => setEx3Answer(opt.id)}
                    className="accent-purple-500"
                  />
                  <span className="text-sm text-slate-200">
                    <span className="text-slate-500 mr-2 font-mono">
                      {opt.id})
                    </span>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={checkEx3}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3ShowSolution((v) => !v)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {ex3ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Result === "ok" && (
              <div className="mt-3 text-sm text-emerald-400">
                ✅ Верно! Бюджет + крупное жильё — главные триггеры.
              </div>
            )}
            {ex3Result === "bad" && (
              <div className="mt-3 text-sm text-rose-400">
                ❌ Неверно. Закон чётко определяет круг обязательных объектов.
              </div>
            )}
            {ex3ShowSolution && (
              <div className="mt-4 bg-slate-950/60 border border-purple-900/40 rounded p-4 text-sm text-slate-300 space-y-1">
                <div>
                  <span className="text-purple-300">Ответ:</span> b) Для
                  бюджетных объектов и крупных жилых домов (от 24 квартир)
                </div>
                <div className="text-xs text-slate-500">
                  Согласно ст. 64 ЗРК «О градостроительной деятельности»,
                  госэкспертиза обязательна для: (1) объектов, финансируемых из
                  республиканского или местного бюджета; (2) технически сложных
                  и особо опасных объектов; (3) жилых зданий от 24 квартир
                  и/или 4 этажей и выше; (4) объектов с массовым пребыванием
                  людей. Для прочих — допускается негосударственная экспертиза.
                </div>
              </div>
            )}
          </div>

          {/* УПРАЖНЕНИЕ 4 */}
          <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-purple-900/60 text-purple-200 px-2 py-1 rounded font-mono">
                Задача 4
              </span>
              <span className="text-xs text-slate-500">
                multiple-choice — выбери лишнее
              </span>
            </div>
            <p className="text-slate-200 mb-4">
              Перечислены типичные замечания экспертов в сметной части. Какое из
              них <span className="text-purple-300">НЕ относится</span> к
              существенным замечаниям по сути сметы (это формальность, а не
              содержательная критика)?
            </p>
            <div className="space-y-2">
              {[
                {
                  id: "a",
                  label:
                    "Применение неактуальных индексов перевода в текущие цены",
                },
                {
                  id: "b",
                  label:
                    "Двойной счёт расценок (одна и та же работа учтена дважды)",
                },
                {
                  id: "c",
                  label: "Неправильный шрифт титульного листа сметы",
                },
                {
                  id: "d",
                  label:
                    "Отсутствие обоснования индивидуальных цен материалов по СНБ РК",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${
                    ex4Answer === opt.id
                      ? "border-purple-600 bg-purple-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.id}
                    checked={ex4Answer === opt.id}
                    onChange={() => setEx4Answer(opt.id)}
                    className="accent-purple-500"
                  />
                  <span className="text-sm text-slate-200">
                    <span className="text-slate-500 mr-2 font-mono">
                      {opt.id})
                    </span>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={checkEx4}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4ShowSolution((v) => !v)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {ex4ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex4Result === "ok" && (
              <div className="mt-3 text-sm text-emerald-400">
                ✅ Верно! Шрифт титульника — формальность, не критика по сути.
              </div>
            )}
            {ex4Result === "bad" && (
              <div className="mt-3 text-sm text-rose-400">
                ❌ Неверно. Подумай, что реально влияет на стоимость объекта, а
                что — чисто оформление.
              </div>
            )}
            {ex4ShowSolution && (
              <div className="mt-4 bg-slate-950/60 border border-purple-900/40 rounded p-4 text-sm text-slate-300 space-y-1">
                <div>
                  <span className="text-purple-300">Ответ:</span> c) Неправильный
                  шрифт титульного листа сметы
                </div>
                <div className="text-xs text-slate-500">
                  Пункты a, b, d — содержательные замечания, которые напрямую
                  влияют на корректность сметной стоимости и могут привести к
                  отрицательному заключению. Шрифт титульника — это
                  формальность, эксперт может указать в качестве примечания, но
                  это не блокирующее замечание. Реальные блокеры: устаревшие
                  индексы, двойной счёт, отсутствие обоснования материалов,
                  неверные коэффициенты НР/СП, ошибки в применении ЭСН.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: ЧЕК-ЛИСТ ДОКУМЕНТОВ */}
        <section>
          <h2 className="text-2xl font-bold text-purple-400 mb-4">
            4. Чек-лист документов для подачи в ГосЭкспертизу
          </h2>
          <p className="text-slate-300 mb-5">
            Базовый комплект документов, без которого заявление не примут.
            Отметь, что у тебя готово — это поможет понять степень готовности
            проекта к экспертизе.
          </p>
          <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-5">
            <ul className="space-y-3">
              {checklistItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checklist[i]}
                    onChange={() => toggleCheck(i)}
                    className="mt-1 accent-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <span
                    className={`text-sm leading-relaxed ${
                      checklist[i]
                        ? "text-slate-500 line-through"
                        : "text-slate-200"
                    }`}
                  >
                    <span className="text-purple-400 font-mono mr-2">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-500">
              Готово: {checklist.filter(Boolean).length} из {checklistItems.length}
            </div>
          </div>
        </section>

        {/* РАСЦЕНКИ + FACTOID */}
        <section>
          <h2 className="text-2xl font-bold text-purple-400 mb-4">
            5. Расценки и сроки устранения замечаний
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-violet-200 mb-3">
                Тарифы ГосЭкспертизы РК (2025)
              </h3>
              <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
                <li>
                  <span className="text-purple-300">До 100 млн тг:</span> 0,5–0,7%
                  от стоимости СМР
                </li>
                <li>
                  <span className="text-purple-300">100–500 млн тг:</span>{" "}
                  0,4–0,5% от стоимости СМР
                </li>
                <li>
                  <span className="text-purple-300">500 млн – 1 млрд тг:</span>{" "}
                  0,3–0,4% от стоимости СМР
                </li>
                <li>
                  <span className="text-purple-300">Свыше 1 млрд тг:</span>{" "}
                  0,2–0,3% + понижающий коэффициент
                </li>
                <li className="pt-2 text-xs text-slate-500">
                  Минимальный тариф — 50 МРП. НДС 12% сверху. Тарифы утверждаются
                  приказом МИИР РК и пересматриваются ежегодно.
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-950/40 to-violet-950/40 border border-purple-700/50 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <div className="text-3xl">⚠️</div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-2">
                    Срок устранения замечаний — 30 дней
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed mb-3">
                    Если экспертиза выдала заключение{" "}
                    <span className="text-violet-300">«с замечаниями»</span>,
                    заказчик обязан устранить их в течение{" "}
                    <span className="text-purple-300 font-semibold">
                      30 календарных дней
                    </span>{" "}
                    с даты получения заключения и подать доработанную
                    документацию повторно.
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Если срок пропущен — требуется{" "}
                    <span className="text-rose-300 font-semibold">
                      повторная подача с нуля
                    </span>{" "}
                    и оплата{" "}
                    <span className="text-purple-300 font-semibold">
                      50% от первоначальной стоимости
                    </span>{" "}
                    экспертизы. Поэтому грамотная авторская проверка{" "}
                    <span className="text-violet-300">до</span> подачи —
                    экономит деньги и время.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ИТОГОВЫЙ ВЫВОД */}
        <section className="bg-slate-900/60 border border-purple-900/40 rounded-lg p-6">
          <h2 className="text-xl font-bold text-purple-300 mb-3">
            💡 Главное про экспертизу для сметчика
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed list-disc list-inside">
            <li>
              <span className="text-purple-300">Авторская проверка</span> сметы
              своими силами — самый дешёвый способ избежать замечаний.
            </li>
            <li>
              <span className="text-purple-300">Актуальность индексов и ССЦ</span>{" "}
              — проверяй на дату подачи в экспертизу, а не на дату начала
              проектирования.
            </li>
            <li>
              <span className="text-purple-300">Обоснование материалов</span> —
              для каждой индивидуальной цены нужна выписка из СНБ РК или
              коммерческое предложение поставщика.
            </li>
            <li>
              <span className="text-purple-300">Двойной счёт</span> — самая частая
              причина замечаний в сметной части. Сверяй ВОР с локальной сметой
              построчно.
            </li>
            <li>
              <span className="text-purple-300">30 дней на устранение</span>{" "}
              замечаний — иначе повторная подача и +50% к стоимости экспертизы.
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-800 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-slate-500">
          <div>
            AEVION Smeta Trainer · Экспертиза проектной документации · Норматив:
            СН РК 1.02-19, ЗРК «О градостроительной деятельности»
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← К разделам
          </Link>
        </div>
      </footer>
    </div>
  );
}
