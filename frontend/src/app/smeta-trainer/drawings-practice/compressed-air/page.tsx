"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, answers: string[], tol = 0.05) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return answers.some(a => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

type NumExercise = {
  id: string;
  kind: "num";
  title: string;
  question: string;
  answers: string[];
  tol?: number;
  formula: string;
  explanation: string;
};

type ChoiceOption = { key: string; label: string };

type ChoiceExercise = {
  id: string;
  kind: "choice";
  title: string;
  question: string;
  options: ChoiceOption[];
  correct: string;
  formula: string;
  explanation: string;
};

type Exercise = NumExercise | ChoiceExercise;

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    kind: "choice",
    title: "Упражнение 1. Подбор компрессора для покрасочной камеры",
    question:
      "Покрасочная камера на СТО: суммарный расход краскопультов и продувочных пистолетов 800 л/мин при рабочем давлении 7 бар. Резерв на пиковые нагрузки и износ — 30%. Какой компрессор ATLAS COPCO GA выбрать?",
    options: [
      { key: "a", label: "GA-7 (1100 л/мин)" },
      { key: "b", label: "GA-11 (1690 л/мин — стоп, 1100 л/мин при 7 бар)" },
      { key: "c", label: "GA-15 (1320 л/мин при 7 бар)" },
      { key: "d", label: "GA-22 (3400 л/мин)" },
    ],
    correct: "c",
    formula: "Q_расч = Q_потр · 1.30 = 800 · 1.30 = 1040 л/мин ⇒ GA-15 (1320 л/мин)",
    explanation:
      "Считаем требуемую производительность с резервом: 800 · 1.30 = 1040 л/мин. GA-7 даёт всего ~1100 л/мин в идеале, но при износе и в жару падает до 900 — недостаточно. GA-11 на пределе. GA-15 (1320 л/мин при 7 бар) — оптимум: запас ~25% над расчётом. GA-22 — двукратный перерасход бюджета, не нужен. Правило: компрессор должен отрабатывать не более 70-75% времени, иначе перегрев и сокращение ресурса. Допуск по выбору модели — строгий, A/B малы, D избыточен.",
  },
  {
    id: "ex2",
    kind: "choice",
    title: "Упражнение 2. Объём ресивера для винтового компрессора",
    question:
      "Винтовой компрессор 22 кВт, расход 3 м³/мин = 3000 л/мин. По СНиП РК и практике объём ресивера V_рес ≥ 0.4 · Q (л/мин). Какой ресивер из стандартного ряда?",
    options: [
      { key: "a", label: "500 л" },
      { key: "b", label: "1000 л" },
      { key: "c", label: "1500 л" },
      { key: "d", label: "2000 л" },
    ],
    correct: "c",
    formula: "V_рес ≥ 0.4 · Q = 0.4 · 3000 = 1200 л ⇒ ближайший стандарт 1500 л",
    explanation:
      "Эмпирическая формула для винтовых компрессоров: V_рес ≥ 0.4 · Q (л/мин). Для нашего 3000 л/мин получаем 1200 л минимум. Стандартный ряд ресиверов: 270, 500, 900, 1000, 1500, 2000, 3000 л. Берём 1500 л — это и норматив, и снижение пусков компрессора (меньше износ), и буфер на пиковые сбросы. 1000 л — недостаточно (компрессор будет дёргаться), 2000 л — избыточно по бюджету и месту. Все ресиверы свыше 25 л под давлением >0.07 МПа подлежат регистрации в Ростехнадзоре РК.",
  },
  {
    id: "ex3",
    kind: "num",
    title: "Упражнение 3. Длина магистрали Ø32 мм для цеха",
    question:
      "Цех 60×30 м с 8 точками отбора сжатого воздуха по периметру. Магистраль кольцевая по периметру + ответвления к точкам отбора (среднее 3 м). Запас 15% на изгибы, отступы, резерв. Найдите длину трубы Ø32 мм, м.",
    answers: ["220", "220.8", "210", "230"],
    tol: 0.15,
    formula:
      "L = (P_цеха + 8·3) · 1.15 = (2·(60+30) + 24) · 1.15 = (180 + 24) · 1.15 = 204 · 1.15 ≈ 234 м",
    explanation:
      "Периметр цеха: 2·(60+30) = 180 м (кольцевая магистраль). Ответвления к 8 точкам отбора по 3 м = 24 м. Сумма «по геометрии»: 204 м. Запас 15% на изгибы, обходы колонн, резерв на ремонт: 204 · 1.15 ≈ 234 м, на закупку округляем до ~220-235 м. Трубу Ø32 берём оцинкованную по ГОСТ 3262 или нержавеющую по ГОСТ 9941. Допуск ±15% — приёмка и закупка кратны хлыстам по 6 м. Резьбовые соединения с уплотнением, фитинги BSP/NPT.",
  },
  {
    id: "ex4",
    kind: "num",
    title: "Упражнение 4. Стоимость комплектной компрессорной для СТО",
    question:
      "СТО на 4 поста: винтовой компрессор 11 кВт (650 000 тг) + ресивер 500 л (180 000 тг) + рефрижераторный осушитель (220 000 тг) + комплект фильтров грубой/тонкой/угольной очистки (95 000 тг) + 80 м магистрали Ø32 с фитингами (75 м · 2 800 тг + фитинги 35 000) + монтаж и пусконаладка (455 000 тг). Найдите ИТОГО, тг.",
    answers: ["1850000", "1 850 000", "1.85", "1850"],
    tol: 0.15,
    formula:
      "C = 650000 + 180000 + 220000 + 95000 + (80·2800 + 35000) + 455000 = 650 + 180 + 220 + 95 + (224 + 35) + 455 = 1 859 000 тг ≈ 1.85 млн",
    explanation:
      "Винтовой компрессор 11 кВт класса AirPress/Remeza/Atlas — 650 тыс. тг. Вертикальный ресивер 500 л — 180 тыс. тг. Рефрижераторный осушитель (3°C точка росы, ISO 8573 класс 4) — 220 тыс. тг. Комплект фильтров (грубая 5 мкм + тонкая 0.01 мкм + уголь от паров масла) — 95 тыс. тг. Магистраль 80 м · 2800 тг/м + фитинги 35 тыс. = 259 тыс. тг. Монтаж, обвязка, ПНР, обучение персонала — 455 тыс. тг. ИТОГО ~1.85 млн тг — типовой бюджет полнокомплектной пневмосети для СТО на 4 поста. Допуск ±15%.",
  },
];

const ESN_ITEMS = [
  { code: "ЭСН РК Сб.6", title: "Компрессорные станции — монтаж агрегатов и обвязки", unit: "компл./шт." },
  { code: "ЭСН РК Сб.16", title: "Трубопроводы воздушные — стальные/нержавеющие магистрали и отводы", unit: "м.п." },
  { code: "ЭСН РК Сб.61", title: "Электромонтажные работы — щит управления, кабели, заземление", unit: "м/шт" },
  { code: "ЭСН РК Сб.20", title: "Технологическое оборудование — осушители, фильтры, ресиверы", unit: "шт./компл." },
  { code: "ЭСН РК Сб.26", title: "Тепловая и шумовая изоляция компрессорной", unit: "м²/м³" },
];

const COMPRESSOR_TYPES = [
  {
    type: "Поршневой 4-15 кВт",
    use: "Гаражи, мастерские, малые СТО, бытовое применение",
    notes: "Простой, ремонтопригоден. Высокий шум 80-95 дБ. Масло в воздухе.",
    perf: "300-1500 л/мин при 8-10 бар",
    cost: "180-650 тыс. тг",
  },
  {
    type: "Винтовой ATLAS COPCO GA-22 22-90 кВт",
    use: "Промышленные цеха, производство, средние СТО",
    notes: "Тихий 65-75 дБ, ресурс 50 000 ч. Маслонаполненный, ISO 8573 кл. 5",
    perf: "2400-13 500 л/мин при 7-13 бар",
    cost: "2.8-12 млн тг",
  },
  {
    type: "Винтовой с инвертором VSD",
    use: "Производства с переменным потреблением, экономия 25-35% энергии",
    notes: "Частотное регулирование, плавный пуск, без перегрева",
    perf: "1500-15 000 л/мин (плавно)",
    cost: "+30-40% к стандартному винтовому",
  },
  {
    type: "Центробежный безмасляный для дата-центров",
    use: "Фарма, электроника, ЦОД, медицина — класс ISO 8573-1 кл. 0",
    notes: "Воздух без масла полностью. Высокая стоимость, длинный ресурс",
    perf: "5000-50 000 л/мин при 6-9 бар",
    cost: "от 18 млн тг",
  },
  {
    type: "Бустер высокого давления для PET",
    use: "Производство ПЭТ-бутылок, выдув преформ при 30-40 бар",
    notes: "Двухступенчатый, обязательное межступенчатое охлаждение",
    perf: "500-4000 л/мин при 30-40 бар",
    cost: "4.5-22 млн тг",
  },
];

const AIR_PREP = [
  {
    name: "Циклонный/масляный сепаратор",
    purpose: "Отделение крупного конденсата и капельного масла после компрессора",
    spec: "ΔP ~0.05 бар, эффективность 99% по каплям ≥10 мкм",
    cost: "35-180 тыс. тг",
  },
  {
    name: "Рефрижераторный осушитель",
    purpose: "Точка росы +3°C — стандарт для общего пневмопривода (ISO 8573 кл. 4)",
    spec: "Удаляет до 60% влаги, потребление 0.3-0.7 кВт",
    cost: "180-650 тыс. тг (по производительности)",
  },
  {
    name: "Адсорбционный осушитель (для класса ISO 1)",
    purpose: "Точка росы −40…−70°C — фарма, электроника, пневмоавтоматика",
    spec: "Силикагель/цеолит, регенерация холодная или с подогревом",
    cost: "750 тыс. - 3.5 млн тг",
  },
  {
    name: "Фильтры предв. (P) / тонкие (M) / угольные (S)",
    purpose: "Каскад: 5 мкм → 1 мкм → 0.01 мкм + уголь (пары масла)",
    spec: "Замена картриджей 1 раз в 6-12 мес.",
    cost: "12-95 тыс. тг/шт., комплект ~95 тыс. тг",
  },
];

export default function CompressedAirPage() {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});

  function setInp(id: string, v: string) {
    setInputs(p => ({ ...p, [id]: v }));
  }
  function reveal(id: string) {
    setRevealed(r => ({ ...r, [id]: true }));
  }
  function reset(id: string) {
    setInputs(p => ({ ...p, [id]: "" }));
    setChoices(p => ({ ...p, [id]: "" }));
    setRevealed(r => ({ ...r, [id]: false }));
  }
  function pickChoice(id: string, key: string) {
    setChoices(p => ({ ...p, [id]: key }));
  }

  const isExerciseDone = (ex: Exercise) => {
    if (!revealed[ex.id]) return false;
    if (ex.kind === "num") return checkNum(inputs[ex.id] ?? "", ex.answers, ex.tol ?? 0.05);
    return choices[ex.id] === ex.correct;
  };

  const doneCount = EXERCISES.filter(isExerciseDone).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-zinc-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-zinc-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🌬 Компрессорные и пневмосети — сжатый воздух для производства
            </h1>
            <p className="text-[10px] text-zinc-300">
              {doneCount}/{EXERCISES.length} упражнений решено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Левая колонка: контент */}
        <div className="lg:col-span-2 space-y-4">
          {/* Intro */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Компрессорные станции и пневмосети
            </h2>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Сжатый воздух — «четвёртая утилита» производства после электричества,
              воды и тепла. Применяется в покрасочных камерах, пневмоинструменте,
              автоматике, упаковке, пищевой промышленности и медицине. Грамотно
              спроектированная пневмосеть экономит до <b>30% электроэнергии</b>
              {" "}на компрессоре. Бюджет компрессорной для среднего цеха —{" "}
              <b>800 тыс. - 8 млн тг</b> в зависимости от класса воздуха,
              производительности и резервирования.
            </p>
          </div>

          {/* Норматив */}
          <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📖</span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-200">
                Нормативная база
              </h2>
            </div>
            <ul className="text-xs text-zinc-900 dark:text-zinc-200 space-y-1.5 leading-relaxed list-disc pl-5">
              <li>
                <b>СНиП РК 4.02-42-2006</b> «Компрессорные установки» — основной
                норматив по проектированию компрессорных станций РК.
              </li>
              <li>
                <b>ГОСТ ISO 8573-1</b> «Сжатый воздух — классы чистоты»: классы
                0 (фарма) → 5 (общий пневмопривод) по содержанию частиц, влаги и
                масла.
              </li>
              <li>
                <b>ПБ 03-576-03</b> «Правила устройства и безопасной эксплуатации
                сосудов под давлением» — регистрация ресиверов в Ростехнадзоре РК.
              </li>
              <li>
                <b>ТР ТС 010/2011</b> и <b>ТР ТС 032/2013</b> — сертификация
                компрессоров и оборудования под давлением (ЕАЭС/РК).
              </li>
            </ul>
          </div>

          {/* Раздел 1: Типы компрессоров */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              📐 Раздел 1. Типы компрессоров
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-zinc-200 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-200">
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Тип
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Применение
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Особенности
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Производительность
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Стоимость 2025
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPRESSOR_TYPES.map((row, i) => (
                    <tr
                      key={i}
                      className="text-slate-800 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-semibold">
                        {row.type}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.use}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.notes}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {row.perf}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {row.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Раздел 2: Подготовка воздуха */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              💧 Раздел 2. Подготовка воздуха (осушка и очистка)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-zinc-200 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-200">
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Узел
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Назначение
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Параметры
                    </th>
                    <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-left font-semibold">
                      Стоимость
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {AIR_PREP.map((row, i) => (
                    <tr
                      key={i}
                      className="text-slate-800 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-semibold">
                        {row.name}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.purpose}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.spec}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {row.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 italic">
              Каскад «сепаратор → осушитель → фильтры» обязателен для пневмоавтоматики
              и пищёвки. Для гаража достаточно влагоотделителя на ресивере.
            </p>
          </div>

          {/* Формулы */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              🧮 Ключевые формулы
            </h2>
            <div className="space-y-3">
              <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 mb-1">
                  Подбор компрессора:
                </p>
                <code className="block text-xs font-mono text-zinc-800 dark:text-zinc-100 my-1">
                  Q_расч = Σ Q_потр · k_спрос · 1.30 (резерв)
                </code>
                <p className="text-[11px] text-zinc-900 dark:text-zinc-200 leading-relaxed">
                  Суммируем потребление всех потребителей, умножаем на коэффициент
                  одновременности (0.5-0.8 для большинства цехов) и на запас 30%.
                  Компрессор должен работать не более <b>70% времени</b>.
                </p>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 mb-1">
                  Объём ресивера:
                </p>
                <code className="block text-xs font-mono text-zinc-800 dark:text-zinc-100 my-1">
                  V_рес ≥ 0.4 · Q (л/мин) для винтовых; ≥ 0.25 · Q для поршневых
                </code>
                <p className="text-[11px] text-zinc-900 dark:text-zinc-200 leading-relaxed">
                  Большой ресивер = меньше пусков компрессора, меньше износ, лучше
                  сглаживание пиков. Стандартный ряд: 270 / 500 / 900 / 1500 / 2000 / 3000 л.
                </p>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 mb-1">
                  Длина магистрали:
                </p>
                <code className="block text-xs font-mono text-zinc-800 dark:text-zinc-100 my-1">
                  L = (P_кольца + Σ L_отв) · 1.15
                </code>
                <p className="text-[11px] text-zinc-900 dark:text-zinc-200 leading-relaxed">
                  Кольцевая разводка по периметру цеха + ответвления к точкам отбора.
                  Запас 15% на изгибы, обходы, резерв. Уклон 1-2% в сторону
                  конденсатоотводчиков.
                </p>
              </div>
            </div>
          </div>

          {/* Factoid */}
          <div className="bg-slate-200 dark:bg-slate-800/60 border-l-4 border-zinc-600 dark:border-zinc-500 rounded-r-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none">⚠️</span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Факт-якорь: ресивер &gt;25 л — это сосуд под давлением
                </h3>
                <p className="text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed">
                  По <b>ПБ 03-576-03</b> и <b>ТР ТС 032/2013</b> любой ресивер
                  объёмом более <b>25 литров</b> при рабочем давлении выше 0.07 МПа
                  (0.7 бар) считается <b>сосудом под давлением</b> и подлежит
                  обязательной регистрации в Ростехнадзоре РК. Требуется ежегодное{" "}
                  <b>техосвидетельствование</b> (внешний и внутренний осмотр) и
                  гидравлические испытания каждые 8 лет. Без паспорта и регистрации
                  эксплуатация запрещена — штраф до 1 млн тг + остановка
                  производства. В смете обязательно учитывать стоимость регистрации
                  (35-80 тыс. тг) и первичной экспертизы.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка: упражнения + ЭСН */}
        <div className="space-y-3">
          <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3">
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
              🧮 Раздел 3. Упражнения
            </h2>
            <p className="text-[10px] text-zinc-800 dark:text-zinc-300 mt-0.5">
              Закрепление: выбор оборудования и расчёт пневмосети
            </p>
          </div>

          {EXERCISES.map((ex, idx) => {
            const id = ex.id;
            const r = !!revealed[id];
            const ok =
              r &&
              (ex.kind === "num"
                ? checkNum(inputs[id] ?? "", ex.answers, ex.tol ?? 0.05)
                : choices[id] === ex.correct);
            const err = r && !ok;

            return (
              <div
                key={id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3 ${
                  ok
                    ? "border-emerald-300 dark:border-emerald-700"
                    : err
                    ? "border-red-400 dark:border-red-600"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ex.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    #{idx + 1}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {ex.question}
                </p>

                {ex.kind === "num" ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputs[id] ?? ""}
                      onChange={e => setInp(id, e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !r && reveal(id)}
                      disabled={r && ok}
                      placeholder="Ответ (число)..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!r && (
                      <button
                        onClick={() => reveal(id)}
                        disabled={!(inputs[id] ?? "").trim()}
                        className="px-3 py-1.5 bg-zinc-700 text-white text-xs font-semibold rounded hover:bg-zinc-800 disabled:opacity-40"
                      >
                        Проверить
                      </button>
                    )}
                    {err && (
                      <button
                        onClick={() => reset(id)}
                        className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded text-slate-700 dark:text-slate-200"
                      >
                        ↻
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {ex.options.map(opt => {
                      const selected = choices[id] === opt.key;
                      const isCorrect = opt.key === ex.correct;
                      const showColor =
                        r &&
                        (selected || isCorrect) &&
                        (isCorrect
                          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700"
                          : "border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700");
                      return (
                        <button
                          key={opt.key}
                          onClick={() => !r && pickChoice(id, opt.key)}
                          disabled={r}
                          className={`w-full text-left px-2 py-1.5 text-[11px] rounded border transition ${
                            showColor ||
                            (selected
                              ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-500 text-slate-900 dark:text-slate-100"
                              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40")
                          }`}
                        >
                          <span className="font-mono font-bold mr-1.5">{opt.key})</span>
                          {opt.label}
                        </button>
                      );
                    })}
                    <div className="flex gap-2 pt-1">
                      {!r && (
                        <button
                          onClick={() => reveal(id)}
                          disabled={!choices[id]}
                          className="flex-1 px-3 py-1.5 bg-zinc-700 text-white text-xs font-semibold rounded hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Проверить
                        </button>
                      )}
                      {err && (
                        <button
                          onClick={() => reset(id)}
                          className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded text-slate-700 dark:text-slate-200"
                        >
                          ↻ Сброс
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {r && !ok && (
                  <button
                    onClick={() => reveal(id)}
                    className="mt-2 w-full px-2 py-1 text-[10px] font-semibold rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300"
                  >
                    Показать решение
                  </button>
                )}

                {r && (
                  <div
                    className={`mt-2 text-[11px] leading-relaxed rounded p-2 ${
                      ok
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700"
                    }`}
                  >
                    <div className="font-semibold mb-1">
                      {ok
                        ? "✓ Верно"
                        : `✗ Правильный ответ: ${
                            ex.kind === "num"
                              ? ex.answers[0]
                              : `${ex.correct}) ${
                                  ex.options.find(o => o.key === ex.correct)?.label ?? ""
                                }`
                          }`}
                    </div>
                    <code className="block text-[10px] font-mono mb-1 opacity-90">
                      {ex.formula}
                    </code>
                    <div>{ex.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Расценки ЭСН */}
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📋</span>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Расценки ЭСН для компрессорных
              </h2>
            </div>
            <ul className="space-y-1.5">
              {ESN_ITEMS.map(it => (
                <li
                  key={it.code}
                  className="text-[10px] leading-snug border-l-2 border-zinc-500 dark:border-zinc-600 pl-2"
                >
                  <code className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                    {it.code}
                  </code>
                  <div className="text-slate-600 dark:text-slate-400">
                    {it.title}{" "}
                    <span className="text-slate-400 dark:text-slate-500">[{it.unit}]</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Эксплуатация */}
          <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-1.5">
              🔧 Эксплуатация и ТО
            </h3>
            <ul className="text-[10px] text-zinc-900 dark:text-zinc-200 space-y-1 list-disc pl-4 leading-relaxed">
              <li>
                Замена масла винтового компрессора — каждые{" "}
                <b>4000-8000 ч</b> работы.
              </li>
              <li>
                Замена воздушного фильтра — каждые <b>2000 ч</b>, маслоотделителя — 4000 ч.
              </li>
              <li>
                Слив конденсата из ресивера и осушителя — <b>ежедневно</b>{" "}
                (или автоматический конденсатоотводчик).
              </li>
              <li>
                Регенерация адсорбционного осушителя — по программе автоматики
                (1-4 ч/цикл).
              </li>
              <li>
                Замер потерь на утечки — <b>1 раз в год</b>; норма не более 5-7%
                (типично без обслуживания 20-30%).
              </li>
              <li>
                Поверка манометров и предохранительных клапанов — <b>1 раз в год</b>.
              </li>
              <li>
                Регистрация и техосвидетельствование ресиверов в Ростехнадзоре РК —{" "}
                <b>ежегодно</b>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
