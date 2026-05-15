"use client";

import Link from "next/link";
import { useState } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────

function check(input: string, accepts: string[], tolerance = 0.025): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  if (isNaN(v)) return false;
  return accepts.some((a) => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(e) && Math.abs((v - e) / e) <= tolerance;
  });
}

// ── Этапы кейса ───────────────────────────────────────────────────────────────

interface Stage {
  id: string;
  num: number;
  icon: string;
  title: string;
  brief: string;
  given: string[];
  formula: string;
  question: string;
  unit: string;
  accepts: string[];
  tolerance?: number;
  explanation: string;
  norm: string;
  hint: string;
  vor: { work: string; volume: string; rate: string };
}

const STAGES: Stage[] = [
  {
    id: "excavation",
    num: 1,
    icon: "🔶",
    title: "Этап 1. Земляные работы — котлован под цокольный паркинг",
    brief:
      "Под 9-этажный дом с цокольным паркингом нужен глубокий котлован. Размеры в плане здания 16×24 м, глубина паркинга 3.5 м (2.4 м для авто + 1.1 м перекрытие/защ. слой). Откосы m=0.5 (грунт II категории — суглинок), рабочее пространство по периметру 0.5 м.",
    given: [
      "Размеры здания в плане: 16 × 24 м",
      "Глубина котлована h = 3.5 м",
      "Откосы m = 0.5 (суглинок)",
      "Рабочее пространство = 0.5 м с каждой стороны",
    ],
    formula:
      "V = ((a₁·b₁) + (a₂·b₂))/2 · h, где a₁=16+1=17, b₁=24+1=25 (по низу), a₂=17+2·m·h=20.5, b₂=25+2·m·h=28.5",
    question: "Рассчитайте объём котлована, м³",
    unit: "м³",
    accepts: ["1760", "1759.6", "1759", "1761"],
    tolerance: 0.02,
    explanation:
      "По низу: 17×25 = 425 м². По верху: 20.5×28.5 ≈ 580.5 м². Среднее: (425+580.5)/2 = 502.75 м². Объём = 502.75 × 3.5 ≈ 1760 м³. Допуск ±2%.",
    norm: "СНиП РК 5.01-03-2002, ЭСН РК Сб.1-01-013",
    hint: "Формула усечённой пирамиды: V = h · (S_низа + S_верха)/2. Не забывайте: к размерам здания добавляется по 0.5 м рабочего пространства с каждой стороны (получается +1 м к каждой стороне по низу).",
    vor: { work: "Разработка котлована экскаватором", volume: "1760 м³", rate: "Сб.1-01-013" },
  },
  {
    id: "foundation",
    num: 2,
    icon: "🏗",
    title: "Этап 2. Фундаментная плита монолитная (плитный фундамент)",
    brief:
      "Для 9-этажного дома применяется ПЛИТНЫЙ фундамент (а не ленточный — нагрузка слишком велика). Площадь по плану 17×25 = 425 м² (включая защ. слой 0.5 м с каждой стороны от осей). Толщина плиты 0.6 м (для 9 этажей и плитного перекрытия паркинга).",
    given: [
      "Площадь плиты в плане: 17 × 25 = 425 м²",
      "Толщина плиты: 0.6 м",
      "Класс бетона: М300, водонепроницаемость W6",
    ],
    formula: "V = S × t = 425 × 0.6",
    question: "Рассчитайте объём ж/б плиты, м³",
    unit: "м³",
    accepts: ["255", "255.0"],
    explanation:
      "V = 425 м² × 0.6 м = 255 м³ ж/б М300 W6. ВНИМАНИЕ: для 9-этажки толщина плиты обычно 0.6-0.8 м (для 5-этажки достаточно 0.4 м, для коттеджа — 0.25 м).",
    norm: "ЭСН РК Сб.6 §6-01-001, СП РК 5.03-106",
    hint: "Простая формула: площадь × толщина. Главное — взять площадь именно фундаментной плиты (с защитным слоем), а не голого здания.",
    vor: { work: "Фундаментная плита ж/б М300 W6", volume: "255 м³", rate: "Сб.6-01-001" },
  },
  {
    id: "frame",
    num: 3,
    icon: "🏛",
    title: "Этап 3. Монолитный ж/б каркас (колонны + диафрагмы + перекрытия)",
    brief:
      "Это САМЫЙ объёмный этап для многоэтажки. Каркас состоит из 3-х частей: (1) колонны 0.5×0.5 м — 12 шт на этаж, (2) диафрагмы жёсткости (стены лестничной клетки и лифтовой шахты) толщиной 0.20 м, (3) перекрытия толщиной 0.20 м. Считаем каждый элемент отдельно и суммируем по 9 этажам (для перекрытий — 10, т.к. крыша тоже плита).",
    given: [
      "Колонны: 12 шт × 0.5×0.5 м, h=3.0 м, 9 этажей",
      "Диафрагмы (лестница+лифт): 4 стены × 4×3 м × t=0.20 м, 9 этажей",
      "Перекрытия: (16·24 − обвязка по периметру) ≈ 352 м² × t=0.20 м × 10 шт (9 этажей + крыша)",
    ],
    formula:
      "V = V_колонн + V_диафрагм + V_перекрытий = 12·0.5·0.5·3·9 + 4·4·3·0.2·9 + 352·0.2·10",
    question: "Рассчитайте суммарный объём ж/б каркаса, м³",
    unit: "м³",
    accepts: ["870", "871.4", "871", "869", "872"],
    tolerance: 0.05,
    explanation:
      "Колонны: 12 × 0.5 × 0.5 × 3 × 9 = 81 м³. Диафрагмы: 4 × 4 × 3 × 0.2 × 9 = 86.4 м³. Перекрытия: 352 × 0.20 × 10 = 704 м³. ИТОГО: 81 + 86.4 + 704 = 871.4 ≈ 870 м³. Допуск ±5% (геометрия каркаса плавает в пределах проекта).",
    norm: "ЭСН РК Сб.6 §6-04-001 (монолитные ж/б конструкции)",
    hint: "Перекрытия дают самый большой вклад (~80% от каркаса). 352 м² — это 16×24=384 м² минус обвязка по периметру (контурные балки/обвязки шириной 0.4 м). 10 перекрытий, т.к. кровля — это тоже монолитная плита.",
    vor: { work: "Монолитный ж/б каркас (колонны+диафрагмы+перекрытия)", volume: "870 м³", rate: "Сб.6-04-001" },
  },
  {
    id: "walls",
    num: 4,
    icon: "🧱",
    title: "Этап 4. Стены наружные — кладка пустотного кирпича 380 мм",
    brief:
      "Наружные стены (заполнение каркаса) — кладка пустотного кирпича толщиной 380 мм на 9 этажах. Цокольный этаж не считаем (там монолитные ж/б стены). ВАЖНО для жилья: вычитаем оконные и балконные проёмы — в типовом жилом доме они занимают ~30% площади фасада.",
    given: [
      "Периметр здания: 2·(16+24) = 80 м",
      "Высота стен: 3.0 × 9 = 27 м (без цоколя)",
      "Площадь брутто: 80 × 27 = 2160 м²",
      "Доля проёмов: 30%",
      "Толщина кладки: 380 мм (0.38 м)",
    ],
    formula: "V = (S_брутто − S_проёмов) × t = (2160 − 0.30·2160) × 0.38 = 1512 × 0.38",
    question: "Рассчитайте объём кладки наружных стен, м³",
    unit: "м³",
    accepts: ["575", "574.6", "574", "576"],
    tolerance: 0.02,
    explanation:
      "Брутто: 80 × 27 = 2160 м². Минус 30% проёмов: 2160 × 0.7 = 1512 м² (нетто). Объём кладки: 1512 × 0.38 = 574.56 ≈ 575 м³ пустотного кирпича. Площадь нетто (1512 м²) пригодится позже для фасадной СФТК.",
    norm: "ЭСН РК Сб.8 §8-2-008, ГОСТ 530-2012 (пустотный керамический кирпич)",
    hint: "Главная ловушка жилого дома: 30% оконных и балконных проёмов. Если их не вычесть — переплата на 30% (≈170 м³ кирпича впустую). Сравните: в школе проёмы ~20%, в офисе — до 50%.",
    vor: { work: "Кладка наружных стен — кирпич пустотный 380 мм", volume: "575 м³", rate: "Сб.8-2-008" },
  },
  {
    id: "roof",
    num: 5,
    icon: "🏠",
    title: "Этап 5. Кровля плоская с парапетом",
    brief:
      "Плоская эксплуатируемая кровля 9-этажного дома. Слои сверху вниз: наплавляемая гидроизоляция (2 слоя) + наклонная стяжка 100-150 мм (для уклона к воронкам) + утеплитель XPS 200 мм + пароизоляция + ж/б плита (уже посчитана в каркасе). Парапет высотой 0.6 м идёт по периметру 80 м.",
    given: [
      "Площадь кровли: 16 × 24 = 384 м²",
      "Толщина утеплителя XPS: 200 мм (0.20 м)",
      "Периметр парапета: 80 м.п.",
      "4 водосточные воронки",
    ],
    formula: "V_утепл = S × t = 384 × 0.20",
    question: "Рассчитайте объём утеплителя XPS на кровле, м³",
    unit: "м³",
    accepts: ["76.8", "76,8", "77"],
    tolerance: 0.02,
    explanation:
      "V = 384 × 0.20 = 76.8 м³ экструдированного пенополистирола XPS-35. Для плоских кровель используется именно XPS (не ППС): он не боится влаги и держит нагрузку. Кровельный ковёр 384 м² (наплавляемая, 2 слоя) и парапет 80 м.п. идут отдельными позициями ВОР.",
    norm: "ЭСН РК Сб.12, СН РК 3.02-22 (кровли)",
    hint: "Площадь утеплителя = площадь кровли × толщина. Не путайте: площадь — для наплавляемой и пароизоляции (м²), объём — для утеплителя (м³, т.к. он толстый).",
    vor: { work: "Утеплитель кровли XPS-35, t=200 мм", volume: "76.8 м³", rate: "Сб.19-01-005" },
  },
  {
    id: "facade",
    num: 6,
    icon: "🏢",
    title: "Этап 6. Фасад СФТК + штукатурка короед",
    brief:
      "Система фасадной теплоизоляции с тонким штукатурным слоем (СФТК / «мокрый фасад»). Слои: пенополистирол ППС-25 толщиной 100 мм + дюбель-«грибок» (6 шт/м²) + базовый штукатурный слой со стеклосеткой + грунт + декоративная штукатурка короед. Площадь фасада равна нетто-площади кладки из этапа 4.",
    given: [
      "Площадь фасада (нетто): 1512 м²",
      "Толщина утеплителя ППС-25: 100 мм (0.10 м)",
      "Расход дюбелей: 6 шт/м²",
    ],
    formula: "V_утепл = S × t = 1512 × 0.10;   N_дюбелей = 1512 × 6",
    question: "Рассчитайте объём утеплителя ППС-25 на фасаде, м³",
    unit: "м³",
    accepts: ["151.2", "151,2", "151", "152"],
    tolerance: 0.02,
    explanation:
      "V = 1512 × 0.10 = 151.2 м³ пенополистирола ППС-25 (для фасада можно ППС, а не XPS — он легче и дешевле). Дюбелей: 1512 × 6 = 9072 шт. Площадь декоративной штукатурки 1512 м² — отдельная позиция ВОР.",
    norm: "ЭСН РК Сб.26-01-001 (СФТК), СТ РК ISO 15686 (фасадные системы)",
    hint: "Площадь фасада = площадь кладки нетто (этап 4). Толщина 100 мм для жилья в Алматы достаточна (Rтр=2.5 (м²·К)/Вт). На севере РК ставят 150-200 мм.",
    vor: { work: "Утеплитель фасада ППС-25, t=100 мм", volume: "151.2 м³", rate: "Сб.26-01-001" },
  },
  {
    id: "windows",
    num: 7,
    icon: "🪟",
    title: "Этап 7. Окна и двери",
    brief:
      "Окна ПВХ 5-камерные с двухкамерным стеклопакетом. Типовая 2-комнатная квартира — 5 окон + 1 балконный блок. Этажей 9, по 4 квартиры на этаже. Двери: 1 входная на квартиру (металлическая) + 4 межкомнатные.",
    given: [
      "Окон на этаже: 5 × 4 = 20 шт",
      "Балконных блоков на этаже: 1 × 4 = 4 шт",
      "Этажей: 9",
      "Площадь 1 окна: 1.8 м²; 1 балконного блока: 3.0 м²",
    ],
    formula:
      "S_окон = 9·20·1.8 + 9·4·3.0 = 324 + 108",
    question: "Рассчитайте суммарную площадь оконных и балконных блоков ПВХ, м²",
    unit: "м²",
    accepts: ["432", "432.0"],
    explanation:
      "Окна: 9 эт × 20 шт × 1.8 м² = 324 м². Балконные блоки: 9 эт × 4 шт × 3.0 м² = 108 м². ИТОГО: 324 + 108 = 432 м² монтаж ПВХ-конструкций. Дверей: 36 входных + 144 межкомнатных = 180 шт.",
    norm: "ЭСН РК Сб.10 (заполнение проёмов)",
    hint: "Считаем ПЛОЩАДЬ заполнения, а не штуки — ЭСН Сб.10 нормирует м² для ПВХ. Двери считаются штуками (отдельная позиция). 9 этажей × 4 квартиры = 36 квартир — это базовая единица для жилого дома.",
    vor: { work: "Окна и балконные блоки ПВХ", volume: "432 м²", rate: "Сб.10-1-001" },
  },
  {
    id: "finishing",
    num: 8,
    icon: "🎨",
    title: "Этап 8. Внутренняя отделка квартир (черновая)",
    brief:
      "Черновая отделка под передачу квартир дольщикам. По действующим нормам РК для жилья — это штукатурка стен, стяжка пола, шпатлёвка потолка под покраску. Чистовая отделка (обои, плитка, ламинат) — за счёт дольщика. Считаем штукатурку стен по 36 квартирам (9 эт × 4 кв).",
    given: [
      "Квартир: 36 (9 эт × 4 кв)",
      "Средняя площадь штукатурки внутр. стен на квартиру: 100 м²",
    ],
    formula: "S_штук = 36 × 100",
    question: "Рассчитайте площадь внутренней штукатурки стен, м²",
    unit: "м²",
    accepts: ["3600", "3600.0"],
    explanation:
      "S = 36 кв × 100 м² = 3600 м² штукатурки внутренних стен. Дополнительно: стяжка пола 36×75 = 2700 м², шпатлёвка потолков 36×75 = 2700 м², подключение санузлов к стоякам — отдельные позиции ВОР.",
    norm: "ЭСН РК Сб.15 (штукатурные работы)",
    hint: "100 м² штукатурки — это типовое значение для 2-комнатной квартиры 60-65 м² (стены выше пола в 2 раза, плюс перегородки). Для квартир-студий — 50-60 м², для 3-комнатных — 130-140 м².",
    vor: { work: "Штукатурка внутренних стен квартир", volume: "3600 м²", rate: "Сб.15-1-001" },
  },
];

// ── Полная ВОР объекта ─────────────────────────────────────────────────────────

const FULL_VOR: { stage: number; work: string; volume: string; rate: string }[] = [
  { stage: 1, work: "Разработка котлована экскаватором", volume: "1760 м³", rate: "Сб.1-01-013" },
  { stage: 2, work: "Фундаментная плита ж/б М300 W6", volume: "255 м³", rate: "Сб.6-01-001" },
  { stage: 3, work: "Каркас монолитный ж/б (колонны+диафрагмы+перекрытия)", volume: "870 м³", rate: "Сб.6-04-001" },
  { stage: 4, work: "Кладка наружных стен — кирпич пустотный 380 мм", volume: "575 м³", rate: "Сб.8-2-008" },
  { stage: 5, work: "Утеплитель кровли XPS-35, t=200 мм", volume: "76.8 м³", rate: "Сб.19-01-005" },
  { stage: 5, work: "Кровля наплавляемая, 2 слоя", volume: "384 м²", rate: "Сб.12-01-002" },
  { stage: 6, work: "СФТК — пенополистирол ППС-25, t=100 мм", volume: "151.2 м³", rate: "Сб.26-01-001" },
  { stage: 6, work: "Дюбель-«грибок» фасадный", volume: "9072 шт", rate: "Сб.26-01-001" },
  { stage: 7, work: "Окна и балконные блоки ПВХ", volume: "432 м²", rate: "Сб.10-1-001" },
  { stage: 7, work: "Двери (входные металл. + межкомнатные)", volume: "180 шт", rate: "Сб.10-2-001" },
  { stage: 8, work: "Штукатурка внутренних стен квартир", volume: "3600 м²", rate: "Сб.15-1-001" },
];

// ── Компонент ─────────────────────────────────────────────────────────────────

export default function CaseHousePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hintShown, setHintShown] = useState<Record<string, boolean>>({});

  const allDone = completed.size === STAGES.length;
  const stage = STAGES[currentStep];
  const stageId = stage?.id;
  const isCorrect = stage && revealed[stageId] && check(answers[stageId] ?? "", stage.accepts, stage.tolerance);
  const isWrong = stage && revealed[stageId] && !isCorrect;

  function handleCheck() {
    if (!stage) return;
    setRevealed((r) => ({ ...r, [stageId]: true }));
    if (check(answers[stageId] ?? "", stage.accepts, stage.tolerance)) {
      setCompleted((c) => new Set([...c, stageId]));
    }
  }

  function handleNext() {
    if (currentStep + 1 < STAGES.length) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handleRetry() {
    if (!stage) return;
    setAnswers((a) => ({ ...a, [stageId]: "" }));
    setRevealed((r) => ({ ...r, [stageId]: false }));
  }

  function handleReset() {
    setCurrentStep(0);
    setAnswers({});
    setRevealed({});
    setCompleted(new Set());
    setHintShown({});
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              🏘 КЕЙС-СТАДИ №2: 9-этажный жилой дом (1 секция, 2300 м²)
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Сквозной капстоун L5 · 8 этапов от котлована до отделки · {completed.size}/{STAGES.length} пройдено
            </p>
          </div>
        </div>

        {/* Progress bar — 8 stages */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-1">
          {STAGES.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                completed.has(s.id)
                  ? "bg-purple-500"
                  : i === currentStep
                  ? "bg-purple-300"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
              title={`Этап ${s.num}: ${s.title}`}
            />
          ))}
        </div>
      </header>

      {/* Описание объекта */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 dark:border-purple-700 rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide mb-2">
            🏘 Об объекте
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
            <div><b>ОБЪЕКТ:</b> 9-этажный многоквартирный жилой дом</div>
            <div><b>АДРЕС:</b> г. Алматы, мкр. Жетысу-2 (учебный)</div>
            <div><b>ЗАКАЗЧИК:</b> ТОО «Гражданстрой»</div>
            <div><b>СРОК:</b> 16 месяцев</div>
            <div className="md:col-span-2 border-t border-purple-300 dark:border-purple-700 pt-1 mt-1">
              <b>ХАРАКТЕРИСТИКА:</b>
            </div>
            <div>• 9 этажей + цокольный (паркинг) + кровля плоская</div>
            <div>• 1 секция, размеры в плане: 16.0 × 24.0 м</div>
            <div>• Высота этажа: 3.0 м (общая высота 31.0 м)</div>
            <div>• Количество квартир: 36 (по 4 на этаже)</div>
            <div>• Полезная площадь: 2 300 м²</div>
            <div>• Общая площадь: 3 500 м² (с лестницей)</div>
            <div className="md:col-span-2">• Конструктив: монолитный ж/б каркас + кладка пустотного кирпича 380 мм + СФТК</div>
            <div>• Кровля: плоская с парапетом 600 мм</div>
            <div>• Водосточных воронок: 4</div>
            <div>• Лифт: 1 пассажирский (грузопасс. 630 кг)</div>
            <div>• Эл. снабжение: ВРУ + 9 этажных щитов</div>
            <div className="md:col-span-2 italic text-purple-700 dark:text-purple-300 mt-1">
              ИСТОЧНИК: типовой проект 134-1-189с
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      {allDone ? (
        // ── Финальный экран с ВОР ──
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <div className="bg-white dark:bg-slate-900 border-2 border-purple-500 dark:border-purple-700 rounded-xl p-6 mb-4">
            <div className="text-center mb-6">
              <div className="text-6xl mb-2">🎓</div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                Кейс пройден!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                9-этажный дом, мкр. Жетысу-2 — все 8 этапов завершены
              </p>
            </div>

            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
              📋 Финальная ВОР объекта (учебная)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200">
                    <th className="border border-purple-300 dark:border-purple-700 px-2 py-1.5 text-left">Этап</th>
                    <th className="border border-purple-300 dark:border-purple-700 px-2 py-1.5 text-left">Работа</th>
                    <th className="border border-purple-300 dark:border-purple-700 px-2 py-1.5 text-right">Объём</th>
                    <th className="border border-purple-300 dark:border-purple-700 px-2 py-1.5 text-left">Расценка ЭСН</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_VOR.map((row, i) => (
                    <tr
                      key={i}
                      className="bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono text-slate-600 dark:text-slate-400">
                        {row.stage}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-slate-800 dark:text-slate-200">
                        {row.work}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold text-purple-800 dark:text-purple-300">
                        {row.volume}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                        {row.rate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Финальный фактоид */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 dark:border-purple-700 rounded-xl p-5 mb-4">
            <div className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-3">
              🎓 ЗАВЕРШИВ КЕЙС, СТУДЕНТ ОВЛАДЕЛ:
            </div>
            <ul className="space-y-1.5 text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
              <li>• Расчётом многоэтажного жилого дома (отличается от низкоэтажного больше в каркасе)</li>
              <li>• Учётом монолитного каркаса (колонны + диафрагмы + перекрытия отдельно)</li>
              <li>• Расчётом фасадной системы СФТК на большой высоте</li>
              <li>• Учётом проёмов в наружных стенах (30% типично для жилья)</li>
              <li>• Подсчётом окон/дверей в типовых квартирах</li>
            </ul>
            <div className="mt-4 pt-3 border-t border-purple-300 dark:border-purple-700 text-xs italic text-purple-800 dark:text-purple-300 leading-relaxed">
              💡 Сравните с школой №47 — где основная масса объёма приходится на стены
              (низкоэтажное), а здесь — на каркас и перекрытия (высотное).
              Это ключевое различие в стратегии оценки бюджета: для жилого высотного
              дома самая дорогая статья — это монолитный ж/б каркас (≈870 м³ против ≈575 м³ кладки).
            </div>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              🔄 Пройти кейс снова
            </button>
            <Link
              href="/smeta-trainer/drawings-practice/case-school47"
              className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700"
            >
              🎓 К кейсу школы №47
            </Link>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="px-4 py-2 bg-purple-700 text-white text-sm font-semibold rounded-lg hover:bg-purple-800"
            >
              ← К разделам
            </Link>
          </div>
        </div>
      ) : (
        // ── Активный этап ──
        <div className="max-w-5xl mx-auto px-4 pb-12">
          {/* Tabs (1..8) */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {STAGES.map((s, i) => {
              const isCurrent = i === currentStep;
              const isDone = completed.has(s.id);
              const isLocked = i > currentStep && !isDone;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (!isLocked || completed.has(STAGES[i - 1]?.id ?? "")) {
                      setCurrentStep(i);
                    }
                  }}
                  disabled={isLocked && !completed.has(STAGES[i - 1]?.id ?? "")}
                  className={`shrink-0 text-[11px] px-2.5 py-1.5 rounded font-semibold transition-colors ${
                    isCurrent
                      ? "bg-purple-600 text-white"
                      : isDone
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 hover:bg-purple-200"
                      : isLocked
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300"
                  }`}
                  title={s.title}
                >
                  {isDone ? "✓ " : isLocked ? "🔒 " : ""}
                  {s.num}
                </button>
              );
            })}
          </div>

          {/* Stage card */}
          <div className="bg-white dark:bg-slate-900 border-2 border-purple-500 dark:border-purple-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-purple-50 dark:bg-purple-900/30 border-b-2 border-purple-500 dark:border-purple-700 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{stage.icon}</div>
                <div className="flex-1">
                  <div className="text-[10px] font-mono text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-0.5">
                    Этап {stage.num} из 8 · {stage.norm}
                  </div>
                  <h2 className="text-base font-bold text-purple-900 dark:text-purple-200 leading-tight">
                    {stage.title}
                  </h2>
                </div>
              </div>
            </div>

            {/* Brief */}
            <div className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border-b border-slate-200 dark:border-slate-700">
              {stage.brief}
            </div>

            {/* Given */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                📐 Дано:
              </div>
              <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                {stage.given.map((g, i) => (
                  <li key={i} className="font-mono">• {g}</li>
                ))}
              </ul>
              <div className="mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                <b className="text-slate-800 dark:text-slate-200">Формула:</b> {stage.formula}
              </div>
            </div>

            {/* Hint */}
            {hintShown[stageId] && (
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                💡 <b>Подсказка:</b> {stage.hint}
              </div>
            )}

            {/* Question + input */}
            <div
              className={`px-4 py-4 border-b border-slate-200 dark:border-slate-700 ${
                isCorrect
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : isWrong
                  ? "bg-red-50 dark:bg-red-900/20"
                  : ""
              }`}
            >
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                ❓ {stage.question}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={answers[stageId] ?? ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [stageId]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && !revealed[stageId] && handleCheck()}
                  disabled={revealed[stageId] && isCorrect}
                  placeholder="Введите число..."
                  className="flex-1 border-2 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 border-slate-300"
                />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 min-w-[28px]">
                  {stage.unit}
                </span>
                {!(revealed[stageId] && isCorrect) && (
                  <button
                    onClick={handleCheck}
                    disabled={!answers[stageId]?.trim()}
                    className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40"
                  >
                    Проверить
                  </button>
                )}
                <button
                  onClick={() =>
                    setHintShown((h) => ({ ...h, [stageId]: !h[stageId] }))
                  }
                  className="px-3 py-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-semibold rounded-lg hover:bg-amber-200"
                >
                  {hintShown[stageId] ? "🔼" : "💡"}
                </button>
              </div>

              {revealed[stageId] && (
                <div
                  className={`mt-3 text-xs leading-relaxed p-3 rounded-lg ${
                    isCorrect
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700"
                      : "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700"
                  }`}
                >
                  <div className="font-semibold mb-1">
                    {isCorrect ? "✓ Верно!" : "✗ Неверно"}
                  </div>
                  <div>{stage.explanation}</div>
                </div>
              )}

              {isWrong && (
                <button
                  onClick={handleRetry}
                  className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 underline hover:text-amber-900"
                >
                  Попробовать снова
                </button>
              )}
            </div>

            {/* Result + next */}
            {completed.has(stageId) && (
              <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/30">
                <div className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide mb-2">
                  📋 Запись в ВОР
                </div>
                <code className="block text-[11px] font-mono text-purple-900 dark:text-purple-200 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded p-2 mb-3 leading-relaxed">
                  Этап {stage.num}: {stage.vor.work} — <b>{stage.vor.volume}</b> ({stage.vor.rate})
                </code>
                {currentStep + 1 < STAGES.length ? (
                  <button
                    onClick={handleNext}
                    className="w-full py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700"
                  >
                    Следующий этап →
                  </button>
                ) : (
                  <div className="text-center py-2 text-sm font-bold text-purple-800 dark:text-purple-200">
                    🎉 Все 8 этапов пройдены — финальная ВОР открыта выше!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mini status */}
          <div className="mt-4 text-center text-[10px] text-slate-500 dark:text-slate-400 italic">
            Капстоун L5 · Жилой 9-этажный дом · Учебный объект 134-1-189с · Алматы, мкр. Жетысу-2
          </div>
        </div>
      )}
    </div>
  );
}
