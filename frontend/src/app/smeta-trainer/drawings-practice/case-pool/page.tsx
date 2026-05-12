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
    title: "Этап 1. Земляные работы — котлован под чашу бассейна",
    brief:
      "Под монолитную чашу бассейна 25×12 м нужен глубокий котлован с учётом стенок (по 0.3 м с каждой стороны → 25.6×12.6 м), подушки и плиты дна (0.3 м), глубины до 2.2 м. Итоговая расчётная глубина 2.5 м. Грунт — суглинок (II категория), откосы m=0.5.",
    given: [
      "Размеры чаши: 25.0 × 12.0 м",
      "С учётом стенок 0.3 м: 25.6 × 12.6 м (низ котлована)",
      "Глубина max h = 2.5 м (с подушкой и плитой 0.3 м)",
      "Откосы m = 0.5 (суглинок)",
      "Низ: 25.6×12.6 = 322.6 м²; Верх: 28.1×15.1 = 424.3 м²",
    ],
    formula:
      "V = ((S_низа + S_верха)/2) · h = ((25.6·12.6 + 28.1·15.1)/2) · 2.5",
    question: "Рассчитайте объём котлована под чашу, м³",
    unit: "м³",
    accepts: ["935", "933.6", "934", "936"],
    tolerance: 0.02,
    explanation:
      "По низу: 25.6×12.6 = 322.6 м². По верху (с откосами m=0.5 на h=2.5): 28.1×15.1 ≈ 424.3 м². Среднее: (322.6+424.3)/2 = 373.45 м². Объём = 373.45 × 2.5 ≈ 933.6 ≈ 935 м³. Допуск ±2%.",
    norm: "СНиП РК 5.01-03-2002, ЭСН РК Сб.1-01-013",
    hint: "Формула усечённой пирамиды: V = h · (S_низа + S_верха)/2. Откосы m=0.5 означают, что на каждые 1 м глубины стенки расходятся на 0.5 м. На h=2.5 м расширение по 1.25 м с каждой стороны.",
    vor: { work: "Разработка котлована под чашу бассейна", volume: "935 м³", rate: "Сб.1-01-013" },
  },
  {
    id: "pool-bowl",
    num: 2,
    icon: "🏊",
    title: "Этап 2. Монолитная чаша бассейна — гидротехнический бетон",
    brief:
      "Чаша бассейна — монолитная конструкция из ГИДРОТЕХНИЧЕСКОГО бетона B25 W8 (отличается от обычного М300!). Состоит из дна (плита 0.3 м) и стенок (толщ. 0.3 м, средняя высота 1.8 м, периметр 74 м.п.). Класс водонепроницаемости W8 — критичен для удержания воды.",
    given: [
      "Дно (плита): 25 × 12 × 0.3 = 90 м³",
      "Периметр стенок: 2·(25+12) = 74 м.п.",
      "Средняя высота стенок: 1.8 м (от 1.4 до 2.2)",
      "Толщина стенок: 0.3 м",
      "Класс бетона: B25 (~М350), водонепроницаемость W8",
    ],
    formula:
      "V = V_дна + V_стенок = 90 + 74·1.8·0.3 = 90 + 39.96",
    question: "Рассчитайте суммарный объём ж/б чаши B25 W8, м³",
    unit: "м³",
    accepts: ["130", "129.96", "129", "131"],
    tolerance: 0.02,
    explanation:
      "Дно: 25 × 12 × 0.3 = 90 м³. Стенки: 74 × 1.8 × 0.3 = 39.96 м³. ИТОГО: 90 + 39.96 ≈ 130 м³ ж/б B25 W8 (гидротехнический). ВНИМАНИЕ: W8 — это водонепроницаемость на 0.8 МПа, обязательна для бассейнов. Цена B25 W8 на ~30% выше обычного М300 W6.",
    norm: "ЭСН РК Сб.6 §6-01-005, СП РК 5.03-106 (гидротехнический бетон)",
    hint: "Гидротехнический бетон B25 W8 — это специальная марка для бассейнов и резервуаров. W8 = выдерживает напор воды до 0.8 МПа без фильтрации через тело бетона. Считается отдельной позицией ВОР, нельзя путать с обычным М300.",
    vor: { work: "Монолитная чаша бассейна B25 W8", volume: "130 м³", rate: "Сб.6-01-005" },
  },
  {
    id: "waterproofing-bowl",
    num: 3,
    icon: "💧",
    title: "Этап 3. Многослойная гидроизоляция чаши (5 СЛОЁВ!)",
    brief:
      "Самый КРИТИЧНЫЙ этап. Гидроизоляция чаши состоит из 5 слоёв изнутри наружу: (1) грунтовка глубокого проникновения, (2) эластичная полимерная гидроизоляция Mapei AquaFlex, (3) армирующая сетка, (4) цементная гидроизоляция Mapelastic, (5) декоративная плитка с эпоксидной фугой. Площадь = дно + стенки.",
    given: [
      "Площадь дна: 25 × 12 = 300 м²",
      "Площадь стенок: 74 м.п. × 1.8 м = 133.2 м²",
      "Слой 1: грунтовка глубокого проникновения",
      "Слой 2: эластичная полимерная (Mapei AquaFlex)",
      "Слой 3: армирующая сетка",
      "Слой 4: цементная гидроизоляция (Mapelastic)",
      "Слой 5: декоративная плитка + эпоксидная фуга",
    ],
    formula: "S = S_дна + S_стенок = 300 + 133.2",
    question: "Рассчитайте площадь изолируемой поверхности чаши, м²",
    unit: "м²",
    accepts: ["433", "433.2", "432", "434"],
    tolerance: 0.01,
    explanation:
      "S = 300 + 133.2 = 433.2 ≈ 433 м² изолируемой поверхности (по проекту). Каждый из 5 слоёв учитывается ОТДЕЛЬНОЙ позицией ВОР по 433 м². Пропуск хотя бы одного слоя = протечка через год эксплуатации. Это технология Mapei, аналогичные системы Sika, Knauf.",
    norm: "ЭСН РК Сб.8 §8-1-x, СП РК 5.04-101",
    hint: "Площадь = площадь дна + площадь всех 4-х стенок. Каждый слой (грунтовка, полимер, сетка, цементная, плитка) считается отдельной позицией ВОР с одинаковой площадью 433 м². Допуск ±1% — здесь точность важна.",
    vor: { work: "Гидроизоляция чаши 5 слоёв (грунт+полимер+сетка+цемент+плитка)", volume: "433 м²", rate: "Сб.8-1-x" },
  },
  {
    id: "tile-bowl",
    num: 4,
    icon: "🟦",
    title: "Этап 4. Облицовка керамогранитом для бассейнов",
    brief:
      "Спец. керамогранит для бассейнов 200×200 мм — антискользящий, R10-R11, морозостойкий. Эпоксидная фуга (стойкая к хлору и УФ) — это критично, цементная фуга сгниёт за 2 года. С учётом подрезки на стенках и углах коэффициент 1.10. Расход эпокс. фуги: 1.5 кг/м² облицовки.",
    given: [
      "Площадь чаши (как г/и): 433.2 м²",
      "Керамогранит 200×200 антискольз. R11",
      "Коэффициент подрезки: ×1.10",
      "Площадь керамогранита с подрезкой: 433.2 · 1.10 = 476.5 м² (≈ 480)",
      "Эпоксидная фуга: 1.5 кг/м² → 720 кг",
    ],
    formula: "S_плитки = S_чаши · 1.10 = 433.2 · 1.10",
    question: "Рассчитайте площадь керамогранита с учётом подрезки, м² (принимаем также 433 — проектная)",
    unit: "м²",
    accepts: ["480", "476.5", "476", "433", "433.2"],
    tolerance: 0.01,
    explanation:
      "Проектная площадь = 433 м² (как у г/и). С учётом подрезки 1.10: 433.2 × 1.10 = 476.5 ≈ 480 м² керамогранита для бассейнов. Эпоксидной фуги: 480 × 1.5 = 720 кг. Принимаются оба ответа — 433 (проектная) или 480 (с подрезкой). ЦЕНА: спец. керамогранит для бассейнов в 2-3 раза дороже обычного.",
    norm: "ЭСН РК Сб.15 §15-13-x",
    hint: "Двойной ответ: 433 м² — это ПРОЕКТНАЯ площадь облицовки (для расценки), 480 м² — это РАСХОД материала (с подрезкой 10%). Эпоксидная фуга обязательна, цементная не выдержит хлор бассейна.",
    vor: { work: "Керамогранит для бассейнов с эпокс. фугой", volume: "480 м²", rate: "Сб.15-13-x" },
  },
  {
    id: "waterproofing-rooms",
    num: 5,
    icon: "🚿",
    title: "Этап 5. Гидроизоляция помещений (полы и стены до 1.5 м)",
    brief:
      "Помимо чаши, нужна гидроизоляция всех влажных помещений: полы под керамогранит + стены до отметки 1.5 м (защита от брызг и влажной уборки). Площадь полов = общая площадь здания минус площадь чаши и фильтровальной. Стены — по периметру всех помещений за вычетом дверных проёмов.",
    given: [
      "Общая площадь здания: 770 м²",
      "Минус чаша: −300 м²",
      "Минус фильтровальная: −50 м²",
      "Площадь полов: 770 − 300 − 50 = 420 м²",
      "Периметр стен влажных помещений: 124 м (за вычетом дверей)",
      "Высота защиты: 1.5 м",
      "Площадь стен: 124 × 1.5 = 186 м²",
    ],
    formula: "S = S_полов + S_стен = 420 + 186",
    question: "Рассчитайте суммарную площадь гидроизоляции помещений, м²",
    unit: "м²",
    accepts: ["606", "605", "607"],
    tolerance: 0.02,
    explanation:
      "Полы: 770 − 300 (чаша) − 50 (фильтр.) = 420 м². Стены: 124 м × 1.5 м = 186 м². ИТОГО: 420 + 186 = 606 м² обмазочной г/и (Mapelastic, Ceresit CR65). Это ОТДЕЛЬНАЯ позиция от чаши (там 5 слоёв, тут 2 слоя достаточно). Допуск ±2%.",
    norm: "СНиП РК 2.04-01, ЭСН РК Сб.8 §8-1-x",
    hint: "Полы: вычесть из общей площади (770 м²) то, что не нужно изолировать — саму чашу (300 м²) и фильтровальную (50 м², там своя г/и). Стены — только до 1.5 м (зона брызг), выше уже не нужно.",
    vor: { work: "Гидроизоляция помещений (полы + стены до 1.5 м)", volume: "606 м²", rate: "Сб.8-1-x" },
  },
  {
    id: "ventilation",
    num: 6,
    icon: "💨",
    title: "Этап 6. Вентиляция для влажных помещений (8-10 крат/час)",
    brief:
      "Бассейны имеют высочайшую кратность воздухообмена: 8-10 крат/час против 2-3 для жилья. Это нужно для удаления хлорно-влажного воздуха и предотвращения коррозии конструкций. При объёме помещения 5 775 м³ (770 × 7.5) и кратности 9 — производительность вентсистемы 51 975 м³/час. Магистральные воздуховоды 600×400, общая длина 80 м.п.",
    given: [
      "Площадь зала: 770 м²",
      "Высота: 7.5 м (под прыжки)",
      "Объём помещения: 770 × 7.5 = 5 775 м³",
      "Кратность воздухообмена: 9 (среднее из 8-10)",
      "Производительность: 5 775 × 9 = 51 975 м³/час",
      "Воздуховоды магистрали 600×400, длина 80 м.п.",
      "Периметр сечения: 2·(0.6+0.4) = 2.0 м",
    ],
    formula: "S_воздух = P · L = 2·(0.6+0.4) · 80",
    question: "Рассчитайте площадь магистральных воздуховодов 600×400, м²",
    unit: "м²",
    accepts: ["160", "160.0", "158", "162"],
    tolerance: 0.05,
    explanation:
      "Периметр сечения 600×400: 2·(0.6+0.4) = 2.0 м. Площадь = 2.0 м × 80 м = 160 м² оцинкованного воздуховода (магистраль). Производительность системы 51 975 м³/час — это в 3-4 раза больше, чем для офиса той же площади. Допуск ±5% (длина воздуховодов плавает по разводке).",
    norm: "СП РК 4.02-101-2012, СН РК 3.02-25 (бассейны)",
    hint: "Для воздуховодов считается ПЛОЩАДЬ ПОВЕРХНОСТИ (м²), а не объём, т.к. ЭСН Сб.20 нормирует м² оцинковки. Периметр прямоугольного сечения: 2·(a+b). Не забудьте отдельные позиции на ответвления (ещё 40 м.п.) и приточно-вытяжные установки.",
    vor: { work: "Воздуховоды магистральные оцинк. 600×400", volume: "160 м²", rate: "Сб.20-01-001" },
  },
  {
    id: "filter-room",
    num: 7,
    icon: "⚙️",
    title: "Этап 7. Фильтровальная — оборудование и трубопроводы",
    brief:
      "Фильтровальная — технологический комплекс 12 м² с 3 песчаными фильтрами Ø1.5 м, тремя циркуляционными насосами по 5.5 кВт (один резервный) и автоматической системой хлорирования. Подача и обратка ХВС: трубы Ø100 мм общей длиной 65 м.п. Затраты на оборудование по ССЦ РК — учебная цена 4 500 000 тг.",
    given: [
      "Фильтры: 3 шт, диаметр 1.5 м, площадь основания 5.3 м²·3 = 16 м²",
      "Циркуляционные насосы: 3 шт по 5.5 кВт (1 резервный)",
      "Автоматическое хлорирование",
      "Трубы Ø100 мм: подача + обратка",
      "Общая длина трубопроводов: 65 м.п.",
      "Стоимость оборудования: 4 500 000 тг (ССЦ РК учебная)",
    ],
    formula: "L_труб = 65 м.п. (по проекту)",
    question: "Подтвердите длину трубопроводов фильтровальной Ø100 мм, м.п.",
    unit: "м.п.",
    accepts: ["65", "65.0", "63", "67"],
    tolerance: 0.05,
    explanation:
      "L = 65 м.п. труб Ø100 мм нерж. сталь (для бассейнов нельзя сталь — коррозия от хлора). Это подача от чаши к фильтру + обратка от фильтра к чаше. Оборудование 4 500 000 тг учитывается отдельной позицией «По спецификации». Резервный насос обязателен по СП РК 4.01-103. Допуск ±5%.",
    norm: "СП РК 4.01-103 (бассейны), ЭСН РК Сб.16",
    hint: "Просто введите 65 м.п. — это длина по проекту (подача 32 м + обратка 33 м). Главное здесь — не объём, а понимание: трубы должны быть из НЕРЖАВЕЮЩЕЙ стали или ПВХ, обычная сталь сгниёт от хлора за 2 года.",
    vor: { work: "Трубопроводы фильтровальной нерж. Ø100", volume: "65 м.п.", rate: "Сб.16-01-x" },
  },
  {
    id: "finishing",
    num: 8,
    icon: "🎨",
    title: "Этап 8. Финишная отделка раздевалок и душевых",
    brief:
      "Гардеробные (2×35=70 м²) и душевые (2×18=36 м²). Полы везде керамогранит антискольз. Стены гардеробных — штукатурка + плитка (нижняя половина), стены душевых — плитка ПОЛНОСТЬЮ от пола до потолка 2.5 м. Душевая 6×3 м, периметр стен 2·(6+3)=18 м, площадь стен на одну душевую 18·2.5 = 45 м², на две — 90 м².",
    given: [
      "Гардеробные: 2 × 35 = 70 м² пола",
      "Душевые: 2 × 18 = 36 м² пола",
      "Полы (керамогранит антискольз.): 70 + 36 = 106 м²",
      "Душевая 6×3 м, периметр 18 м, высота 2.5 м",
      "Стены 1 душевой: 18 · 2.5 = 45 м²",
      "Стены 2 душевых: 45 · 2 = 90 м² плитки",
    ],
    formula:
      "S_полов = 70 + 36 = 106 м²;   S_стен_душ = 2·(6+3)·2.5·2 = 90 м²",
    question: "Рассчитайте суммарную площадь керамогранита полов, м²",
    unit: "м²",
    accepts: ["106", "106.0", "104", "108"],
    tolerance: 0.02,
    explanation:
      "Полы: 70 (гардеробные) + 36 (душевые) = 106 м² керамогранита антискольз. Стены душевых: 2·(6+3)·2.5·2 = 90 м² плитки полностью. Стены гардеробных (плитка снизу 1.5 м): 2·(7+5)·1.5·2 ≈ 72 м² — отдельной позицией. Допуск ±2%.",
    norm: "ЭСН РК Сб.15 §15-12-x, §15-13-x",
    hint: "Полы = площадь гардеробных (70 м²) + площадь душевых (36 м²) = 106 м². Стены душевых — отдельная позиция (90 м² плитки), считается через периметр × высота × количество душевых.",
    vor: { work: "Керамогранит полов раздевалок и душевых", volume: "106 м²", rate: "Сб.15-12-x" },
  },
];

// ── Полная ВОР объекта ─────────────────────────────────────────────────────────

const FULL_VOR: { stage: number; work: string; volume: string; rate: string }[] = [
  { stage: 1, work: "Котлован под чашу бассейна", volume: "935 м³", rate: "Сб.1-01-013" },
  { stage: 2, work: "Монолитная чаша B25 W8 (гидротехнический)", volume: "130 м³", rate: "Сб.6-01-005" },
  { stage: 3, work: "Гидроизоляция чаши 5 слоёв (грунт+полимер+сетка+цемент+плитка)", volume: "433 м²", rate: "Сб.8-1-x" },
  { stage: 4, work: "Керамогранит чаши с эпоксидной фугой", volume: "480 м²", rate: "Сб.15-13-x" },
  { stage: 5, work: "Гидроизоляция помещений (полы + стены до 1.5 м)", volume: "606 м²", rate: "Сб.8-1-x" },
  { stage: 6, work: "Воздуховоды магистральные оцинк. 600×400", volume: "160 м²", rate: "Сб.20-01-001" },
  { stage: 7, work: "Трубопроводы фильтровальной нерж. Ø100", volume: "65 м.п.", rate: "Сб.16-01-x" },
  { stage: 7, work: "Оборудование фильтровальной (фильтры+насосы+хлорирование)", volume: "компл.", rate: "По спецификации" },
  { stage: 8, work: "Керамогранит полов раздевалок и душевых", volume: "106 м²", rate: "Сб.15-12-x" },
  { stage: 8, work: "Плитка стен душевых полностью", volume: "90 м²", rate: "Сб.15-13-x" },
];

// ── Компонент ─────────────────────────────────────────────────────────────────

export default function CasePoolPage() {
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
              🏊 КЕЙС-СТАДИ №3: Крытый бассейн (25×12 м, фильтровальная)
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
                  ? "bg-cyan-500"
                  : i === currentStep
                  ? "bg-cyan-300"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
              title={`Этап ${s.num}: ${s.title}`}
            />
          ))}
        </div>
      </header>

      {/* Описание объекта */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-500 dark:border-cyan-700 rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wide mb-2">
            🏊 Об объекте
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-cyan-900 dark:text-cyan-200 leading-relaxed">
            <div><b>ОБЪЕКТ:</b> Крытый плавательный бассейн с фильтровальной</div>
            <div><b>АДРЕС:</b> г. Алматы, мкр. Самал-2 (учебный)</div>
            <div><b>ЗАКАЗЧИК:</b> ТОО «Спортивные сооружения»</div>
            <div><b>СРОК:</b> 14 месяцев</div>
            <div className="md:col-span-2 border-t border-cyan-300 dark:border-cyan-700 pt-1 mt-1">
              <b>ХАРАКТЕРИСТИКА:</b>
            </div>
            <div>• 1-этажное здание, цоколь + надземный</div>
            <div>• Размеры в плане: 35.0 × 22.0 м (770 м²)</div>
            <div>• Чаша бассейна: 25.0 × 12.0 м, h=1.4-2.2 м</div>
            <div>• Высота помещения: 7.5 м (для прыжков)</div>
            <div>• Конструктив: монолитный ж/б каркас</div>
            <div>• Чаша: монолитный гидротехнический бетон</div>
            <div>• Кровля: скатная с уклоном 8%</div>
            <div>• Фильтровальная: технологический комплекс 12 м²</div>
            <div>• Гардеробные: 2 (М/Ж) по 35 м²</div>
            <div>• Душевые: 2 по 18 м²</div>
            <div className="md:col-span-2 border-t border-cyan-300 dark:border-cyan-700 pt-1 mt-1">
              <b>ОСОБЕННОСТИ:</b>
            </div>
            <div>• Многослойная гидроизоляция чаши (5 слоёв!)</div>
            <div>• Облицовка керамогранитом со спец. эпокс. фугой</div>
            <div>• Усиленная вентиляция влажных помещений (9 крат/ч)</div>
            <div>• Антикоррозионная защита всех металлоконструкций</div>
            <div className="md:col-span-2 italic text-cyan-700 dark:text-cyan-300 mt-1">
              ИСТОЧНИК: типовой проект 264-1-145с
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      {allDone ? (
        // ── Финальный экран с ВОР ──
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <div className="bg-white dark:bg-slate-900 border-2 border-cyan-500 dark:border-cyan-700 rounded-xl p-6 mb-4">
            <div className="text-center mb-6">
              <div className="text-6xl mb-2">🏊</div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                Кейс пройден!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Крытый бассейн, мкр. Самал-2 — все 8 этапов завершены
              </p>
            </div>

            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
              📋 Финальная ВОР объекта (учебная)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-200">
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">Этап</th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">Работа</th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-right">Объём</th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">Расценка ЭСН</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_VOR.map((row, i) => (
                    <tr
                      key={i}
                      className="bg-white dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono text-slate-600 dark:text-slate-400">
                        {row.stage}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-slate-800 dark:text-slate-200">
                        {row.work}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold text-cyan-800 dark:text-cyan-300">
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
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-500 dark:border-cyan-700 rounded-xl p-5 mb-4">
            <div className="text-sm font-bold text-cyan-900 dark:text-cyan-200 mb-3">
              🏊 ЗАВЕРШИВ ЭТОТ КЕЙС, СТУДЕНТ ОВЛАДЕЛ:
            </div>
            <ul className="space-y-1.5 text-xs text-cyan-900 dark:text-cyan-200 leading-relaxed">
              <li>• Расчётом гидротехнического бетона B25 W8 (отличается от обычного М300)</li>
              <li>• Многослойной гидроизоляцией чаши (5 слоёв технология)</li>
              <li>• Спец. керамогранитом для бассейнов (антискольз. + эпоксидная фуга)</li>
              <li>• Расчётом вентиляции для влажных помещений (8-10 крат/час)</li>
              <li>• Учётом технологического оборудования (фильтры, насосы, хлорирование)</li>
            </ul>
            <div className="mt-4 pt-3 border-t border-cyan-300 dark:border-cyan-700 text-xs italic text-cyan-800 dark:text-cyan-300 leading-relaxed">
              💡 Сравните со школой №47 и жилым 9-этажным домом — здесь основные затраты НЕ
              в каркасе, а в спец. отделке (гидроизоляция, керамогранит) и вентиляции.
              Это типичный «спецобъект» в РК — стоимость 1 м² в 1.8-2.5 раза выше типового жилья.
              Бассейн учит студента работать с НЕТИПОВЫМИ позициями ВОР, которые редко встречаются
              в массовом гражданском строительстве.
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
              href="/smeta-trainer/drawings-practice/case-house"
              className="px-4 py-2 bg-purple-700 text-white text-sm font-semibold rounded-lg hover:bg-purple-800"
            >
              🏘 К кейсу жилого дома
            </Link>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="px-4 py-2 bg-cyan-700 text-white text-sm font-semibold rounded-lg hover:bg-cyan-800"
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
                      ? "bg-cyan-600 text-white"
                      : isDone
                      ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 hover:bg-cyan-200"
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
          <div className="bg-white dark:bg-slate-900 border-2 border-cyan-500 dark:border-cyan-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-cyan-50 dark:bg-cyan-900/30 border-b-2 border-cyan-500 dark:border-cyan-700 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{stage.icon}</div>
                <div className="flex-1">
                  <div className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 uppercase tracking-wider mb-0.5">
                    Этап {stage.num} из 8 · {stage.norm}
                  </div>
                  <h2 className="text-base font-bold text-cyan-900 dark:text-cyan-200 leading-tight">
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
                  className="flex-1 border-2 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 border-slate-300"
                />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 min-w-[28px]">
                  {stage.unit}
                </span>
                {!(revealed[stageId] && isCorrect) && (
                  <button
                    onClick={handleCheck}
                    disabled={!answers[stageId]?.trim()}
                    className="px-4 py-2 bg-cyan-600 text-white text-xs font-semibold rounded-lg hover:bg-cyan-700 disabled:opacity-40"
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
              <div className="px-4 py-3 bg-cyan-50 dark:bg-cyan-900/30">
                <div className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wide mb-2">
                  📋 Запись в ВОР
                </div>
                <code className="block text-[11px] font-mono text-cyan-900 dark:text-cyan-200 bg-white dark:bg-slate-800 border border-cyan-200 dark:border-cyan-700 rounded p-2 mb-3 leading-relaxed">
                  Этап {stage.num}: {stage.vor.work} — <b>{stage.vor.volume}</b> ({stage.vor.rate})
                </code>
                {currentStep + 1 < STAGES.length ? (
                  <button
                    onClick={handleNext}
                    className="w-full py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700"
                  >
                    Следующий этап →
                  </button>
                ) : (
                  <div className="text-center py-2 text-sm font-bold text-cyan-800 dark:text-cyan-200">
                    🎉 Все 8 этапов пройдены — финальная ВОР открыта выше!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mini status */}
          <div className="mt-4 text-center text-[10px] text-slate-500 dark:text-slate-400 italic">
            Капстоун L5 · Крытый бассейн 25×12 м · Учебный объект 264-1-145с · Алматы, мкр. Самал-2
          </div>
        </div>
      )}
    </div>
  );
}
