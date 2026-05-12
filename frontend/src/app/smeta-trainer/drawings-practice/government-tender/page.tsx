"use client";

import Link from "next/link";
import { useState } from "react";

export default function GovernmentTenderPage() {
  // Упражнение 1: обеспечение заявки (numeric, tolerance ±5%)
  const [ex1Answer, setEx1Answer] = useState("");
  const [ex1Result, setEx1Result] = useState<null | "ok" | "bad">(null);
  const [ex1ShowSolution, setEx1ShowSolution] = useState(false);

  // Упражнение 2: обеспечение исполнения договора (multiple-choice)
  const [ex2Answer, setEx2Answer] = useState<string | null>(null);
  const [ex2Result, setEx2Result] = useState<null | "ok" | "bad">(null);
  const [ex2ShowSolution, setEx2ShowSolution] = useState(false);

  // Упражнение 3: шаг снижения в аукционе (multiple-choice)
  const [ex3Answer, setEx3Answer] = useState<string | null>(null);
  const [ex3Result, setEx3Result] = useState<null | "ok" | "bad">(null);
  const [ex3ShowSolution, setEx3ShowSolution] = useState(false);

  // Упражнение 4: предел снижения без потери рентабельности (multiple-choice)
  const [ex4Answer, setEx4Answer] = useState<string | null>(null);
  const [ex4Result, setEx4Result] = useState<null | "ok" | "bad">(null);
  const [ex4ShowSolution, setEx4ShowSolution] = useState(false);

  // Чек-лист документов
  const [checklist, setChecklist] = useState<boolean[]>(Array(12).fill(false));

  const toggleCheck = (i: number) => {
    setChecklist((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const checkEx1 = () => {
    const target = 500000;
    const val = parseFloat(ex1Answer.replace(/\s/g, "").replace(",", "."));
    if (isNaN(val)) {
      setEx1Result("bad");
      return;
    }
    const tolerance = target * 0.05;
    setEx1Result(Math.abs(val - target) <= tolerance ? "ok" : "bad");
  };

  const checkEx2 = () => setEx2Result(ex2Answer === "b" ? "ok" : "bad");
  const checkEx3 = () => setEx3Result(ex3Answer === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Result(ex4Answer === "b" ? "ok" : "bad");

  const tenderTypes = [
    {
      name: "Конкурс",
      desc: "Открытый одноэтапный — основной вид закупок, отбор по комплексу критериев (цена + квалификация)",
      example: "Строительство школы на 1,2 млрд тг",
    },
    {
      name: "Аукцион",
      desc: "Электронный понижающий — определение поставщика по наименьшей цене, шаг снижения 0,5%",
      example: "Поставка стройматериалов на 200 млн тг",
    },
    {
      name: "Запрос ценовых предложений",
      desc: "Упрощённая процедура для закупок до 4 000 МРП (~15,7 млн тг в 2026 г.)",
      example: "Текущий ремонт офиса на 10 млн тг",
    },
    {
      name: "Из одного источника",
      desc: "Без проведения тендера — по утверждённому списку (естественные монополии, унику)",
      example: "Услуги КазТрансГаз, КЕГОК",
    },
    {
      name: "Особый порядок",
      desc: "Для оборонного заказа и закупок Нацбанка — закрытая процедура, гриф ДСП",
      example: "Военная инфраструктура, спецобъекты",
    },
  ];

  const stages = [
    {
      n: 1,
      title: "Изучение ТЗ + проектной документации",
      detail:
        "Сметчик анализирует техническое задание, чертежи стадии Р, ведомости объёмов, спецификации. Фиксирует объёмы по разделам АР/КЖ/ОВ/ВК/ЭО, выявляет скрытые работы.",
    },
    {
      n: 2,
      title: "Расчёт прямых затрат по ЭСН",
      detail:
        "Применение элементных сметных норм РК 8.04 (ред. 2024), ССЦ материалов на дату объявления тендера, тарифов на эксплуатацию машин. Локальные сметы по форме 4-К.",
    },
    {
      n: 3,
      title: "Прибавление НР + СП + индекс",
      detail:
        "Накладные расходы 90% от ФОТ (для общестроя), сметная прибыль 50% от ФОТ. Индекс перевода в текущие цены РК — на дату подачи. НДС 12% сверху.",
    },
    {
      n: 4,
      title: "Подготовка ТЭП в формате ИСТ Эталон",
      detail:
        "Технико-экономические показатели заявки: сводный сметный расчёт ф. 1, объектные сметы ф. 3, локальные ф. 4. Выгрузка XML по требованиям goszakup.gov.kz.",
    },
    {
      n: 5,
      title: "Подача через ЭКО + банковская гарантия 5%",
      detail:
        "Электронная подача в системе goszakup.gov.kz через ЭЦП первого руководителя. Обеспечение заявки 1% (банк. гарантия или депозит), обеспечение исполнения 3%.",
    },
  ];

  const checklistItems = [
    "ТЭП (технико-экономические показатели) с локальными сметами",
    "Лицензия СРО / квалификация по ОКЭД на профильные работы",
    "Банковская гарантия 1% от суммы лота (обеспечение заявки)",
    "Бухгалтерская отчётность за последние 2-3 года (ф. 1, 2, 3)",
    "Опыт аналогичных работ (договоры + акты ввода за 3-5 лет)",
    "Сертификаты ИСО 9001 (СМК) и ИСО 14001 (экология)",
    "Согласие на обработку персональных данных (ФЗ РК № 94-V)",
    "Выписка ЕНРЛ (Единый национальный реестр юр. лиц)",
    "Свидетельство о государственной регистрации юр. лица",
    "Налоговая справка об отсутствии задолженности (форма 130.00)",
    "Нотариально заверенная доверенность на подписанта",
    "Заявка по форме приложения 1 к Правилам организации закупок",
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500 font-mono">
            AEVION Smeta Trainer / drawings-practice / government-tender
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* TITLE */}
        <section>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent mb-4">
            🏛️ Госзакупки и тендеры — участие сметчика
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Сметчик — ключевая фигура в команде, готовящей тендерную заявку. От
            его расчётов зависит, выиграет ли компания контракт и не уйдёт ли в
            убыток. В этом модуле — полный путь от изучения ТЗ до подачи через
            портал <span className="text-blue-400">goszakup.gov.kz</span>.
          </p>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-blue-900/50 rounded-lg p-4">
              <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">
                Главный закон
              </div>
              <div className="text-sm text-slate-200">
                Закон РК «О государственных закупках» от 4 декабря 2015 г. № 434-V
              </div>
            </div>
            <div className="bg-slate-900 border border-indigo-900/50 rounded-lg p-4">
              <div className="text-xs text-indigo-400 uppercase tracking-wider mb-1">
                Подзаконный акт
              </div>
              <div className="text-sm text-slate-200">
                Правила организации и проведения государственных закупок (Приказ
                МФ РК)
              </div>
            </div>
            <div className="bg-slate-900 border border-blue-900/50 rounded-lg p-4">
              <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">
                Особый порядок
              </div>
              <div className="text-sm text-slate-200">
                Постановление Правительства РК № 1003 — закупки по особому
                порядку (оборонка, спецобъекты)
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: ВИДЫ ТЕНДЕРОВ */}
        <section>
          <h2 className="text-2xl font-bold text-blue-400 mb-4">
            1. Виды тендеров в Республике Казахстан
          </h2>
          <p className="text-slate-300 mb-5">
            Согласно ст. 39 ЗРК «О госзакупках» применяется пять основных
            способов закупок. Сметчик должен понимать различия — от способа
            зависит формат заявки и стратегия снижения цены.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-blue-300 font-semibold">
                    Вид тендера
                  </th>
                  <th className="text-left px-4 py-3 text-blue-300 font-semibold">
                    Описание
                  </th>
                  <th className="text-left px-4 py-3 text-blue-300 font-semibold">
                    Пример лота
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenderTypes.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800 last:border-0 hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3 font-semibold text-indigo-300 align-top">
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

        {/* SECTION 2: 5 ЭТАПОВ */}
        <section>
          <h2 className="text-2xl font-bold text-blue-400 mb-4">
            2. Пять этапов работы сметчика над тендером
          </h2>
          <div className="space-y-4">
            {stages.map((s) => (
              <div
                key={s.n}
                className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-blue-800/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white">
                    {s.n}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-indigo-200 mb-2">
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
          <h2 className="text-2xl font-bold text-blue-400 mb-4">
            3. Интерактивные упражнения
          </h2>
          <p className="text-slate-300 mb-6">
            Проверь, как ты усвоил нормативы по обеспечению заявок и аукционным
            шагам в РК.
          </p>

          {/* УПРАЖНЕНИЕ 1 */}
          <div className="bg-slate-900 border border-blue-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-blue-900/60 text-blue-200 px-2 py-1 rounded font-mono">
                Задача 1
              </span>
              <span className="text-xs text-slate-500">numeric ±5%</span>
            </div>
            <p className="text-slate-200 mb-4">
              Объявлен тендер на строительство сельской амбулатории. Сумма лота
              — <span className="text-blue-300 font-semibold">50 000 000 тг</span>.
              Рассчитай <strong>размер обеспечения заявки</strong> согласно ЗРК
              «О госзакупках» (ст. 24, п. 1).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={ex1Answer}
                onChange={(e) => setEx1Answer(e.target.value)}
                placeholder="введите сумму в тг"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 w-56 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={checkEx1}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1ShowSolution(!ex1ShowSolution)}
                className="text-slate-400 hover:text-blue-300 text-sm underline"
              >
                {ex1ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex1Result === "ok" && (
              <div className="mt-3 text-green-400 text-sm">
                ✓ Верно! 1% от 50 000 000 = 500 000 тг
              </div>
            )}
            {ex1Result === "bad" && (
              <div className="mt-3 text-red-400 text-sm">
                ✗ Не совсем. Подумай ещё или открой решение.
              </div>
            )}
            {ex1ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border-l-2 border-blue-500 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Обеспечение
                заявки на участие в тендере составляет{" "}
                <strong>1% от суммы лота</strong> (ст. 24 ЗРК «О госзакупках»).
                <br />
                50 000 000 × 0,01 = <strong>500 000 тг</strong>.<br />
                Вносится в виде банковской гарантии, депозита или платёжного
                поручения на блок-счёт.
              </div>
            )}
          </div>

          {/* УПРАЖНЕНИЕ 2 */}
          <div className="bg-slate-900 border border-indigo-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-indigo-900/60 text-indigo-200 px-2 py-1 rounded font-mono">
                Задача 2
              </span>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-200 mb-4">
              Компания выиграла тендер. Какой размер{" "}
              <strong>обеспечения исполнения договора</strong> требует
              законодательство РК с победителя?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: "a", label: "1% от суммы договора" },
                { id: "b", label: "3% от суммы договора" },
                { id: "c", label: "5% от суммы договора" },
                { id: "d", label: "10% от суммы договора" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    ex2Answer === opt.id
                      ? "border-indigo-500 bg-indigo-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.id}
                    checked={ex2Answer === opt.id}
                    onChange={(e) => setEx2Answer(e.target.value)}
                    className="accent-indigo-500"
                  />
                  <span className="text-slate-200 text-sm">
                    <strong className="text-indigo-300">{opt.id})</strong>{" "}
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={checkEx2}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2ShowSolution(!ex2ShowSolution)}
                className="text-slate-400 hover:text-indigo-300 text-sm underline"
              >
                {ex2ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex2Result === "ok" && (
              <div className="mt-3 text-green-400 text-sm">
                ✓ Верно! 3% — стандартная норма по ст. 26 ЗРК.
              </div>
            )}
            {ex2Result === "bad" && (
              <div className="mt-3 text-red-400 text-sm">
                ✗ Неверно. Подсказка: 1% — это обеспечение заявки, а исполнения
                договора — больше.
              </div>
            )}
            {ex2ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border-l-2 border-indigo-500 rounded text-sm text-slate-300">
                <strong className="text-indigo-300">Решение:</strong> Согласно
                ст. 26 ЗРК «О госзакупках», обеспечение исполнения договора
                составляет <strong>3% от суммы договора</strong>. Вносится
                победителем до подписания договора. Не путать с обеспечением
                заявки (1%) — это разные платежи!
              </div>
            )}
          </div>

          {/* УПРАЖНЕНИЕ 3 */}
          <div className="bg-slate-900 border border-blue-900/40 rounded-lg p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-blue-900/60 text-blue-200 px-2 py-1 rounded font-mono">
                Задача 3
              </span>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-200 mb-4">
              На электронном аукционе goszakup.gov.kz участники последовательно
              снижают цену. Какой <strong>минимальный шаг снижения</strong>{" "}
              установлен правилами портала?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: "a", label: "0,1% от стартовой цены" },
                { id: "b", label: "0,5% от стартовой цены" },
                { id: "c", label: "1% от стартовой цены" },
                { id: "d", label: "2% от стартовой цены" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    ex3Answer === opt.id
                      ? "border-blue-500 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3"
                    value={opt.id}
                    checked={ex3Answer === opt.id}
                    onChange={(e) => setEx3Answer(e.target.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-slate-200 text-sm">
                    <strong className="text-blue-300">{opt.id})</strong>{" "}
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={checkEx3}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3ShowSolution(!ex3ShowSolution)}
                className="text-slate-400 hover:text-blue-300 text-sm underline"
              >
                {ex3ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Result === "ok" && (
              <div className="mt-3 text-green-400 text-sm">
                ✓ Верно! 0,5% — стандарт аукциона в РК.
              </div>
            )}
            {ex3Result === "bad" && (
              <div className="mt-3 text-red-400 text-sm">
                ✗ Не угадал. Шаг сделан небольшим, чтобы конкуренция была
                плавной.
              </div>
            )}
            {ex3ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border-l-2 border-blue-500 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Минимальный
                шаг снижения в электронном аукционе РК —{" "}
                <strong>0,5% от стартовой (максимальной) цены</strong>. Например,
                при стартовой 100 млн тг шаг = 500 000 тг. Участники могут
                снижать кратно шагу. Длительность аукциона — обычно 30 минут с
                продлением, если ставка сделана в последние 10 минут.
              </div>
            )}
          </div>

          {/* УПРАЖНЕНИЕ 4 */}
          <div className="bg-slate-900 border border-indigo-900/40 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-indigo-900/60 text-indigo-200 px-2 py-1 rounded font-mono">
                Задача 4
              </span>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-200 mb-4">
              Подумай как сметчик. На сколько <strong>максимум</strong> можно
              снизить цену на аукционе{" "}
              <strong>без потери рентабельности</strong>, если в смете заложены
              стандартные нормы СП 50% и НР 90% от ФОТ?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: "a", label: "5% — слишком осторожно, есть запас" },
                {
                  id: "b",
                  label:
                    "15-20% — оптимально, расход идёт за счёт прибыли и части НР",
                },
                {
                  id: "c",
                  label: "30% — рискованно, придётся резать качество",
                },
                { id: "d", label: "45% — однозначно в убыток" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    ex4Answer === opt.id
                      ? "border-indigo-500 bg-indigo-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.id}
                    checked={ex4Answer === opt.id}
                    onChange={(e) => setEx4Answer(e.target.value)}
                    className="accent-indigo-500 mt-1"
                  />
                  <span className="text-slate-200 text-sm">
                    <strong className="text-indigo-300">{opt.id})</strong>{" "}
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={checkEx4}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4ShowSolution(!ex4ShowSolution)}
                className="text-slate-400 hover:text-indigo-300 text-sm underline"
              >
                {ex4ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex4Result === "ok" && (
              <div className="mt-3 text-green-400 text-sm">
                ✓ Верно! 15-20% — рабочий коридор без перехода в убыток.
              </div>
            )}
            {ex4Result === "bad" && (
              <div className="mt-3 text-red-400 text-sm">
                ✗ Подумай: 5% — мало для конкуренции, 30%+ — почти всегда убыток.
              </div>
            )}
            {ex4ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border-l-2 border-indigo-500 rounded text-sm text-slate-300">
                <strong className="text-indigo-300">Решение:</strong> Структура
                сметы общестроя:{" "}
                <strong>прямые затраты ≈ 70%, НР+СП ≈ 25%, НДС ≈ 5%</strong>{" "}
                (округлённо). Сметная прибыль 50% от ФОТ — это и есть «подушка»,
                которую можно срезать. На практике компании в РК идут на скидку{" "}
                <strong>15-20%</strong>, жертвуя СП и частью НР. Снижение более
                25% — почти гарантированный демпинг и недопоставка по качеству,
                что ведёт к штрафам и попаданию в реестр недобросовестных
                поставщиков.
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: ЧЕК-ЛИСТ */}
        <section>
          <h2 className="text-2xl font-bold text-blue-400 mb-4">
            4. Чек-лист документов для подачи заявки
          </h2>
          <p className="text-slate-300 mb-5">
            Все 12 позиций должны быть загружены через ЭЦП первого руководителя
            в систему goszakup.gov.kz до окончания срока приёма заявок. Отметь,
            что уже готово:
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-2">
            {checklistItems.map((item, i) => (
              <label
                key={i}
                className="flex items-start gap-3 p-2 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checklist[i]}
                  onChange={() => toggleCheck(i)}
                  className="mt-1 accent-blue-500 w-4 h-4"
                />
                <span
                  className={`text-sm ${
                    checklist[i]
                      ? "text-slate-500 line-through"
                      : "text-slate-200"
                  }`}
                >
                  <span className="text-blue-400 font-mono mr-2">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  {item}
                </span>
              </label>
            ))}
            <div className="pt-3 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
              <span>
                Отмечено: {checklist.filter(Boolean).length} / {checklist.length}
              </span>
              <span className="font-mono">
                {Math.round(
                  (checklist.filter(Boolean).length / checklist.length) * 100,
                )}
                %
              </span>
            </div>
          </div>
        </section>

        {/* РАСЦЕНКИ + FACTOID */}
        <section className="grid md:grid-cols-2 gap-5">
          <div className="bg-slate-900 border border-blue-900/40 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-300 mb-3">
              💰 Расценки услуг сметчика по тендерам
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span>Подготовка ТЭП до 50 млн тг</span>
                <span className="text-blue-300 font-mono">150-250 тыс. тг</span>
              </li>
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span>Подготовка ТЭП 50-500 млн тг</span>
                <span className="text-blue-300 font-mono">400-800 тыс. тг</span>
              </li>
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span>Крупные лоты {">"} 1 млрд тг</span>
                <span className="text-blue-300 font-mono">от 1,5 млн тг</span>
              </li>
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span>Сопровождение аукциона</span>
                <span className="text-blue-300 font-mono">50-100 тыс. тг</span>
              </li>
              <li className="flex justify-between">
                <span>Защита заявки + апелляция</span>
                <span className="text-blue-300 font-mono">от 200 тыс. тг</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-950/60 to-indigo-950/60 border border-blue-700/50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-blue-200">
                Reality check: Реестр недобросовестных поставщиков
              </h3>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mb-3">
              Компании, попавшие в <strong>реестр недобросовестных
              поставщиков РК</strong>{" "}
              (РНП), <strong>2 года не могут участвовать в гостендерах</strong>{" "}
              ни напрямую, ни через аффилированные структуры.
            </p>
            <div className="text-xs text-slate-300 space-y-1">
              <div>
                <span className="text-blue-300">Причины попадания:</span>{" "}
                расторжение договора по вине поставщика, нарушение сроков,
                поставка некачественных работ, отказ от подписания после победы.
              </div>
              <div className="pt-2">
                <span className="text-blue-300">Где проверить:</span>{" "}
                goszakup.gov.kz / раздел «Реестр недобросовестных поставщиков»
                — открытая база, обновляется ежедневно.
              </div>
              <div className="pt-2 italic text-slate-400">
                Сметчик обязан проверять РНП перед каждой подачей — иначе вся
                работа уйдёт в корзину при автоматическом отклонении заявки.
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500 flex flex-wrap justify-between gap-3">
          <span>
            Модуль 34 / AEVION Smeta Trainer · drawings-practice ·
            government-tender
          </span>
          <span className="font-mono">
            Источники: ЗРК № 434-V от 04.12.2015, Правила МФ РК, ПП РК № 1003
          </span>
        </footer>
      </main>
    </div>
  );
}
