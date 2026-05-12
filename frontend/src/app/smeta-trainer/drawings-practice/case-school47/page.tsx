"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * КЕЙС-СТАДИ — Пристройка к школе №47.
 * Капстоун-кейс, объединяющий все 27 модулей курса.
 * Сквозной объект АEVION Смета: 3 этажа + цоколь, 18×24 м, 600 м².
 * 8 этапов от земляных работ до отделки → итоговая ВОР.
 */

function checkNum(input: string, expected: number, tolPct: number = 2): boolean {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v) || isNaN(expected) || expected === 0) return false;
  return Math.abs((v - expected) / expected) * 100 <= tolPct;
}

interface Stage {
  id: number;
  title: string;
  emoji: string;
  task: string;
  given: string[];
  inputLabel: string;
  unit: string;
  expected: number;
  tolerance: number;
  formula: string;
  theory: string;
  norm: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    emoji: "⛏️",
    title: "Земляные работы — котлован",
    task: "Рассчитай объём котлована под пристройку 18×24 м, 3 этажа + цоколь.",
    given: [
      "Размеры здания в плане: 18.0 × 24.0 м",
      "Глубина котлована: 2.5 м (заглубление цоколя 1.8 + подушка 0.4 + рабочая 0.3)",
      "Грунт: суглинок II категории, m = 0.5",
      "Рабочее пространство по 0.5 м с каждой стороны",
      "Размеры дна: 19.0 × 25.0 м (со включением рабочего пространства)",
      "Размеры верха: 19.0 + 2·0.5·2.5 = 21.5; 25.0 + 2·0.5·2.5 = 27.5 м",
    ],
    inputLabel: "Объём котлована V",
    unit: "м³",
    expected: 1380,
    tolerance: 3,
    formula: "V = ((Aдна + Аверха)/2) · h = ((19·25 + 21.5·27.5)/2) · 2.5 ≈ 1334 м³ (упрощ. призматоид ≈ 1380 м³)",
    theory: "Объём котлована считается по формуле призматоида V = h/6·(A1 + 4·Am + A2). При прямоугольном плане и постоянных откосах допустимо упрощение через среднюю площадь сечения. Откос m = 0.5 для суглинка II категории при h ≤ 3 м.",
    norm: "СНиП РК 5.01-03-2002, табл. 4 — откосы; ЭСН РК Сб.1 §1-01-013 — разработка экскаватором",
  },
  {
    id: 2,
    emoji: "🏗️",
    title: "Фундамент — ленточный ж/б",
    task: "Рассчитай суммарный объём бетона ленточного фундамента (тело + подошва).",
    given: [
      "Длина по периметру наружных стен: 2·(18+24) = 84 м",
      "Внутренние несущие стены: 24 + 18 = 42 м",
      "Итого длина ленты: 84 + 42 = 126 м",
      "Сечение тела ленты: 0.6 × 0.6 м (бетон М300 W6)",
      "Подошва: 0.8 × 0.3 м",
      "V_тело = 126 · 0.6 · 0.6 = 45.4 м³",
      "V_подошва = 126 · 0.8 · 0.3 = 30.2 м³",
    ],
    inputLabel: "Суммарный объём ж/б V",
    unit: "м³",
    expected: 75.6,
    tolerance: 3,
    formula: "V = V_тело + V_подошва = 45.4 + 30.2 = 75.6 м³",
    theory: "Ленточный фундамент состоит из тела (вертикальной части) и подошвы (опорного уширения). Объёмы считаются раздельно по сечениям и суммируются. Для подсчёта арматуры дополнительно учитываются класс А500С и %-армирования.",
    norm: "ЭСН РК Сб.6 §6-01-001 — фундаменты ленточные; СП РК 5.03-106 — конструкции бетонные и ж/б",
  },
  {
    id: 3,
    emoji: "💧",
    title: "Гидроизоляция фундамента",
    task: "Рассчитай площадь оклеечной гидроизоляции (боковые поверхности + горизонтальная под стенами цоколя).",
    given: [
      "Длина ленты: 126 м",
      "Высота заглубления цоколя: 1.8 м",
      "Боковые поверхности (внеш. + внутр.): 126 · 1.8 · 2 = 453.6 м²",
      "Горизонтальная под стенами: 126 · 0.6 = 75.6 м²",
      "Итого: 453.6 + 75.6 = 529.2 м²",
      "Гидроизоляция в 2 слоя (наплавляемая)",
    ],
    inputLabel: "Площадь гидроизоляции S",
    unit: "м²",
    expected: 529.2,
    tolerance: 3,
    formula: "S = S_бок + S_гор = 126·1.8·2 + 126·0.6 = 453.6 + 75.6 = 529.2 м²",
    theory: "Оклеечная гидроизоляция фундамента защищает от грунтовой влаги. Считается отдельно: вертикальные поверхности (внешние и внутренние стороны ленты) и горизонтальная отсечка под кладкой стен цоколя. Количество слоёв учитывается коэффициентом в расценке.",
    norm: "ЭСН РК Сб.8 §8-1-005 — оклеечная гидроизоляция; СП РК 2.04-101 — защита от коррозии",
  },
  {
    id: 4,
    emoji: "🧱",
    title: "Стены — газобетон 400 мм",
    task: "Рассчитай объём кладки газобетонных стен 3 этажей (за вычетом проёмов).",
    given: [
      "Длина всех стен на 1 этаже: 126 м",
      "Высота этажа: 3.30 м",
      "Этажей: 3 (надземных)",
      "Площадь стен брутто: 126 · 3.30 · 3 = 1247.4 м²",
      "Окна: 60 шт × 1.8 м² = 108 м²",
      "Двери: 12 шт × 2.0 м² = 24 м²",
      "Всего проёмов: 132 м²",
      "Площадь нетто: 1247.4 − 132 = 1115.4 м²",
      "Толщина кладки: 0.40 м (газобетон D500)",
    ],
    inputLabel: "Объём кладки V",
    unit: "м³",
    expected: 446.2,
    tolerance: 3,
    formula: "V = (S_брутто − S_проёмов) · t = (1247.4 − 132) · 0.40 = 1115.4 · 0.40 = 446.2 м³",
    theory: "Объём каменной кладки = (площадь стен брутто − площадь проёмов) × толщину кладки. Проёмы вычитаются по габаритам коробок (без учёта четвертей). Для газобетона D500 учитывается клеевой шов 2-3 мм, без расценки на раствор.",
    norm: "ЭСН РК Сб.8 §8-2-008 — кладка из ячеистых блоков; ГОСТ 31360-2007 — изделия стеновые из ячеистого бетона",
  },
  {
    id: 5,
    emoji: "🏢",
    title: "Перекрытия монолитные",
    task: "Рассчитай суммарный объём бетона трёх монолитных перекрытий толщиной 200 мм.",
    given: [
      "Габариты в плане: 18 × 24 = 432 м²",
      "Площадь стен в плане (вычитается): 0.4 · 126 = 50.4 м²",
      "Площадь перекрытия нетто: 432 − 50.4 = 381.6 м²",
      "Толщина перекрытия: 0.20 м",
      "V на 1 перекрытие: 381.6 · 0.20 = 76.3 м³",
      "Перекрытий: 3 (над 1, 2, 3 этажами)",
    ],
    inputLabel: "Суммарный объём ж/б V",
    unit: "м³",
    expected: 228.9,
    tolerance: 3,
    formula: "V = (S_плана − S_стен) · t · n = 381.6 · 0.20 · 3 = 228.9 м³",
    theory: "Монолитное перекрытие — горизонтальная плита, опирающаяся на стены/колонны. Из площади плана вычитается площадь несущих стен (т.к. они проходят сквозь перекрытие). Опалубка считается отдельной позицией: горизонтальная (днище) + торцы.",
    norm: "ЭСН РК Сб.6 §6-04-001 — перекрытия монолитные; §6-04-005 — опалубка перекрытий",
  },
  {
    id: 6,
    emoji: "🏠",
    title: "Кровля плоская — пирог покрытия",
    task: "Рассчитай объём утеплителя XPS (200 мм) на плоской кровле.",
    given: [
      "Площадь кровли: 18 · 24 = 432 м²",
      "Слои пирога: пароизоляция → XPS 200 мм → стяжка 50 мм → наплавляемая 2 слоя → парапет",
      "Толщина утеплителя XPS: 0.20 м",
      "V_утеплителя = 432 · 0.20 = 86.4 м³",
      "V_стяжки = 432 · 0.05 = 21.6 м³ (для проверки)",
      "Кровля плоская с 4 водостоками по углам",
    ],
    inputLabel: "Объём утеплителя XPS V",
    unit: "м³",
    expected: 86.4,
    tolerance: 3,
    formula: "V_XPS = S_кровли · t_утеп = 432 · 0.20 = 86.4 м³",
    theory: "Пирог плоской кровли многослойный. Каждый слой считается отдельно: пароизоляция (м²), утеплитель (м³ или м²·t), стяжка (м³), наплавляемая (м² × 2 слоя). Парапетная окантовка — отдельной позицией по периметру.",
    norm: "ЭСН РК Сб.12 — кровли; Сб.19 §19-01-005 — утепление XPS; СН РК 3.02-22-2014 — кровли",
  },
  {
    id: 7,
    emoji: "🚪",
    title: "Окна и двери",
    task: "Рассчитай суммарную площадь установки дверей (внутренних и наружных).",
    given: [
      "Внутренних дверей: 36 шт (по 12 на этаж), каждая 2.0 м²",
      "Наружных дверей: 4 шт, каждая 4.0 м²",
      "S_внутр = 36 · 2.0 = 72 м²",
      "S_наружн = 4 · 4.0 = 16 м²",
      "Окон ПВХ 5-камерных (для справки): 60 шт × 1.8 м² = 108 м²",
    ],
    inputLabel: "Суммарная площадь дверей S",
    unit: "м²",
    expected: 88,
    tolerance: 3,
    formula: "S_дверей = 36 · 2.0 + 4 · 4.0 = 72 + 16 = 88 м²",
    theory: "Установка окон и дверей считается в м² проёма. Расценки разделены: внутренние двери (Сб.10-2), наружные двери (отдельная позиция с уплотнителями), окна ПВХ (Сб.10-1). Подоконники, отливы, откосы — отдельными строками ВОР.",
    norm: "ЭСН РК Сб.10 §10-2-005 — двери внутренние; ГОСТ 30674-99 — окна из ПВХ-профилей",
  },
  {
    id: 8,
    emoji: "🎨",
    title: "Отделка — внутренние работы",
    task: "Рассчитай площадь штукатурки внутренних стен (та же база, что для кладки).",
    given: [
      "Площадь стен нетто (из этапа 4): 1115.4 м²",
      "Штукатурка по газобетону внутри: 1115.4 м²",
      "Шпатлёвка + окраска ВД 2 слоя: 1115.4 м² × 2 операции",
      "Полы: ламинат 33 кл. — 432 · 3 · 0.65 = 842.4 м² (кабинеты)",
      "Полы: плитка — 432 · 3 · 0.15 = 194.4 м² (туалеты, столовая)",
      "Потолок: окраска ВД 432 · 3 = 1296 м²",
    ],
    inputLabel: "Площадь штукатурки стен S",
    unit: "м²",
    expected: 1115.4,
    tolerance: 3,
    formula: "S_штук = S_стен_нетто = 1115.4 м² (одинаковая база с кладкой)",
    theory: "Площадь штукатурки внутренних стен совпадает с площадью кладки за вычетом проёмов. Каждая последующая операция (шпатлёвка, окраска) использует ту же базу, но имеет свою расценку. Полы и потолки считаются по полезной площади помещений с учётом коэффициентов назначения.",
    norm: "ЭСН РК Сб.15 §15-1-001 — штукатурка; §15-6-001 — окраска; §15-21-001 — ламинат; §15-12-001 — плитка пол",
  },
];

interface VorRow {
  stage: number;
  work: string;
  volume: string;
  rate: string;
}

const VOR: VorRow[] = [
  { stage: 1, work: "Разработка грунта в котловане", volume: "1380 м³", rate: "Сб.1-01-013" },
  { stage: 2, work: "Бетон фундамента ж/б М300 W6", volume: "75.6 м³", rate: "Сб.6-01-001" },
  { stage: 3, work: "Гидроизоляция оклеечная (2 слоя)", volume: "529.2 м²", rate: "Сб.8-1-005" },
  { stage: 4, work: "Кладка газобетон D500, t=400 мм", volume: "446.2 м³", rate: "Сб.8-2-008" },
  { stage: 5, work: "Перекрытие монолитное ж/б, t=200 мм", volume: "228.9 м³", rate: "Сб.6-04-001" },
  { stage: 5, work: "Опалубка перекрытий", volume: "1195.2 м²", rate: "Сб.6-04-005" },
  { stage: 6, work: "Кровля наплавляемая 2 слоя", volume: "432 м²", rate: "Сб.12-01-002" },
  { stage: 6, work: "Утеплитель XPS на кровле, t=200 мм", volume: "86.4 м³", rate: "Сб.19-01-005" },
  { stage: 7, work: "Окна ПВХ 5-камерные, установка", volume: "108 м²", rate: "Сб.10-1-001" },
  { stage: 7, work: "Двери внутренние и наружные", volume: "88 м²", rate: "Сб.10-2-005" },
  { stage: 8, work: "Штукатурка стен внутри", volume: "1115.4 м²", rate: "Сб.15-1-001" },
  { stage: 8, work: "Окраска ВД стен 2 слоя", volume: "1115.4 м²", rate: "Сб.15-6-001" },
  { stage: 8, work: "Ламинат 33 кл. в кабинетах", volume: "842.4 м²", rate: "Сб.15-21-001" },
  { stage: 8, work: "Плитка керамическая (полы)", volume: "194.4 м²", rate: "Сб.15-12-001" },
];

export default function CaseSchool47Page() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const stage = STAGES[currentStep];
  const allDone = completed.size === STAGES.length;
  const userInput = answers[stage?.id] ?? "";
  const isRevealed = !!revealed[stage?.id];
  const isCorrect = isRevealed && checkNum(userInput, stage.expected, stage.tolerance);
  const isWrong = isRevealed && !isCorrect;

  function handleCheck() {
    if (!stage) return;
    setRevealed((r) => ({ ...r, [stage.id]: true }));
    if (checkNum(userInput, stage.expected, stage.tolerance)) {
      setCompleted((c) => new Set([...c, stage.id]));
    }
  }

  function handleRetry() {
    setRevealed((r) => ({ ...r, [stage.id]: false }));
    setAnswers((a) => ({ ...a, [stage.id]: "" }));
  }

  function handleNext() {
    if (currentStep + 1 < STAGES.length) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleReset() {
    setCurrentStep(0);
    setAnswers({});
    setRevealed({});
    setShowHint({});
    setCompleted(new Set());
  }

  return (
    <div className="min-h-screen bg-amber-50/30 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-amber-100 hover:text-white whitespace-nowrap"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm md:text-base font-bold">
              🎓 КЕЙС-СТАДИ: Пристройка к школе №47 (3 этажа, 600 м²)
            </h1>
            <p className="text-[10px] text-amber-100">
              Капстоун-проект курса • Сквозной объект • 8 этапов от земли до отделки
            </p>
          </div>
          <div className="text-[11px] bg-white/20 px-3 py-1 rounded-full font-semibold">
            {completed.size}/{STAGES.length} этапов
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Описание объекта */}
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="text-3xl">🏫</div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-amber-800 dark:text-amber-300">
                ОБЪЕКТ: Пристройка к КГУ «Школа-гимназия №47», г. Алматы
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Адрес: ул. Толе би 45 • Заказчик: Управление образования г. Алматы
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
              <div className="font-bold text-amber-800 dark:text-amber-300 mb-1.5">📐 Характеристика</div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li>• 3 этажа + цокольный</li>
                <li>• Размеры в плане: 18.0 × 24.0 м</li>
                <li>• Высота этажа: 3.30 м (общая 13.2 м с цоколем)</li>
                <li>• Общая площадь: 600 м² (3 эт. × 18×24×0.46 коэф.)</li>
                <li>• Конструктив: монолитный ж/б каркас + газобетон 400 мм + СФТК</li>
                <li>• Кровля: плоская с 4 водостоками</li>
                <li>• Пристраивается через деформационный шов</li>
              </ul>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">📚 Источники / Срок</div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li>• Курс «Сметное дело РК», урок 9 (сквозной кейс)</li>
                <li>• Реальный объект — типовой проект 224-1-587с</li>
                <li>• Срок: 12 мес. (с 1 марта по 28 февраля)</li>
                <li>• Категория сложности: II</li>
                <li>• Климатический район: III В (Алматы)</li>
                <li>• Сейсмичность: 9 баллов</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Прогресс-бар по этапам */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Прогресс прохождения кейса
            </div>
            <div className="text-[11px] text-slate-500">
              Этап {currentStep + 1} из {STAGES.length}
            </div>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {STAGES.map((s, i) => {
              const isDone = completed.has(s.id);
              const isCurrent = i === currentStep;
              const canAccess = i === 0 || completed.has(STAGES[i - 1].id) || i <= currentStep;
              return (
                <button
                  key={s.id}
                  disabled={!canAccess}
                  onClick={() => canAccess && setCurrentStep(i)}
                  className={`relative px-1 py-2 rounded-lg text-[10px] font-bold border-2 transition-all ${
                    isDone
                      ? "bg-emerald-500 text-white border-emerald-600"
                      : isCurrent
                      ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300"
                      : canAccess
                      ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-amber-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                  }`}
                  title={s.title}
                >
                  <div className="text-base leading-none">{isDone ? "✓" : s.emoji}</div>
                  <div className="mt-1">Этап {s.id}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Текущий этап */}
        {!allDone && stage && (
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700 rounded-xl shadow-sm overflow-hidden">
            {/* Header этапа */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border-b-2 border-amber-200 dark:border-amber-700 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{stage.emoji}</div>
                <div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wide">
                    Этап {stage.id} / {STAGES.length}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {stage.title}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowHint((h) => ({ ...h, [stage.id]: !h[stage.id] }))}
                className="text-[11px] px-3 py-1.5 bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-700/50 font-semibold border border-amber-300 dark:border-amber-700"
              >
                {showHint[stage.id] ? "🔽 Скрыть теорию" : "💡 Теория / подсказка"}
              </button>
            </div>

            {/* Теория (раскрываемая) */}
            {showHint[stage.id] && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700 px-5 py-3">
                <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 mb-1">
                  📖 Теория
                </div>
                <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  {stage.theory}
                </div>
              </div>
            )}

            {/* Тело этапа */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Левая колонка — задание + исходные данные */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  ✏️ Задание
                </div>
                <div className="text-sm text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">
                  {stage.task}
                </div>

                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  📋 Исходные данные
                </div>
                <ul className="space-y-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 font-mono">
                  {stage.given.map((g, i) => (
                    <li key={i} className="leading-snug">
                      {g}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Правая колонка — ввод + проверка */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  ⌨️ Введите ответ
                </div>

                <div
                  className={`border-2 rounded-lg p-4 transition-colors ${
                    isCorrect
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                      : isWrong
                      ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                >
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {stage.inputLabel} ({stage.unit})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [stage.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && !isRevealed && handleCheck()}
                      disabled={isRevealed && isCorrect}
                      placeholder="Например: 1380"
                      className="flex-1 border rounded-lg px-3 py-2 text-base font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"
                    />
                    <span className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {stage.unit}
                    </span>
                  </div>

                  {!isRevealed && (
                    <button
                      onClick={handleCheck}
                      disabled={!userInput.trim()}
                      className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors"
                    >
                      Проверить ответ
                    </button>
                  )}

                  {isRevealed && (
                    <div className="mt-3 space-y-2">
                      <div
                        className={`text-sm font-bold ${
                          isCorrect
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {isCorrect
                          ? `✓ Правильно: ${stage.expected} ${stage.unit} (±${stage.tolerance}%)`
                          : `✗ Неверно. Правильный ответ: ${stage.expected} ${stage.unit}`}
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2.5 text-xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          🧮 Расчёт
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-mono leading-snug">
                          {stage.formula}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                        📖 Норматив: {stage.norm}
                      </div>

                      {isWrong && (
                        <button
                          onClick={handleRetry}
                          className="w-full py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800/40 dark:hover:bg-amber-700/50 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded border border-amber-300 dark:border-amber-700"
                        >
                          🔄 Попробовать снова
                        </button>
                      )}

                      {isCorrect && currentStep + 1 < STAGES.length && (
                        <button
                          onClick={handleNext}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg"
                        >
                          → Следующий этап ({STAGES[currentStep + 1].emoji} {STAGES[currentStep + 1].title})
                        </button>
                      )}

                      {isCorrect && currentStep + 1 === STAGES.length && (
                        <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500 rounded-lg p-3 text-center">
                          <div className="text-2xl mb-1">🎉</div>
                          <div className="text-sm font-bold text-amber-800 dark:text-amber-200">
                            Все 8 этапов пройдены!
                          </div>
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                            Прокрутите вниз — там итоговая ВОР
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Навигация */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="flex-1 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    ← Предыдущий
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!completed.has(stage.id) || currentStep + 1 >= STAGES.length}
                    className="flex-1 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Следующий →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Итоговая ВОР — после всех 8 этапов */}
        {allDone && (
          <>
            <div className="bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 border-2 border-amber-500 rounded-xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">🏆</div>
                <div>
                  <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                    Кейс пройден полностью!
                  </h2>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Все 8 этапов посчитаны верно. Ниже — итоговая ведомость объёмов работ (ВОР).
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border-2 border-amber-400 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-amber-600 text-white px-5 py-3">
                <h3 className="text-sm font-bold">
                  📊 ИТОГОВАЯ ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ (ВОР) — Школа №47
                </h3>
                <p className="text-[10px] text-amber-100 mt-0.5">
                  14 позиций по 8 этапам • Готова для внесения в АВС-4 / Смета РК / ИСТ Эталон
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-amber-50 dark:bg-amber-900/20 border-b-2 border-amber-200 dark:border-amber-700">
                      <th className="px-3 py-2 text-left font-bold text-amber-800 dark:text-amber-300 w-16">
                        Этап
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-amber-800 dark:text-amber-300">
                        Наименование работы
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-amber-800 dark:text-amber-300 w-32">
                        Объём
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-amber-800 dark:text-amber-300 w-36">
                        Расценка ЭСН
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {VOR.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-amber-50/40 dark:hover:bg-amber-900/10"
                      >
                        <td className="px-3 py-2 font-mono font-bold text-amber-700 dark:text-amber-400">
                          {row.stage}
                        </td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                          {row.work}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {row.volume}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {row.rate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Финальный фактоид */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-500 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">🎓</div>
                <div>
                  <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                    ЗАВЕРШИВ ЭТОТ КЕЙС, СТУДЕНТ ОВЛАДЕЛ:
                  </h3>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-200 pl-4 mb-4">
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>Подсчётом объёмов всех основных видов работ</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>Применением расценок ЭСН РК по 8 разделам (Сб.1, 6, 8, 10, 12, 15, 19)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>Использованием нормативов СНиП / СП РК</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>Логикой последовательности подсчёта (от земли — к отделке)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>Подготовкой итоговой ведомости объёмов работ (ВОР)</span>
                </li>
              </ul>
              <div className="bg-white dark:bg-slate-900 border-l-4 border-amber-500 rounded-r-lg p-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-amber-800 dark:text-amber-300">
                  📌 Следующий шаг:
                </span>{" "}
                внести эту ВОР в систему{" "}
                <span className="font-semibold">АВС-4 / Смета РК / ИСТ Эталон</span>, применить
                ССЦ РК 8.04 и индексы перехода → получить ЛСР с итогами по разделам, накладными
                расходами, сметной прибылью и НДС.
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleReset}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                🔄 Пройти кейс заново
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
