"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type Category =
  | "volumes"
  | "rates"
  | "coef"
  | "overhead"
  | "materials"
  | "docs"
  | "legal";

type Severity = "low" | "medium" | "high" | "critical";

interface Mistake {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  example: string;
  howToAvoid: string;
  normRef: string;
  loss: string;
}

// ── База ошибок ──────────────────────────────────────────────────────────────

const MISTAKES: Mistake[] = [
  // ─── ОБЪЁМЫ (volumes) ────────────────────────────────────────────────
  {
    id: "v1",
    category: "volumes",
    severity: "high",
    title: "Двойной счёт штукатурки и плитки на одной стене",
    description:
      "Стена считается под штукатурку (м²), затем под плитку (м²) без вычета общей площади.",
    example:
      "Туалет 8 м² пола + 24 м² стен. Если плитка только на 18 м² стен (нижняя зона), штукатурки должно быть только 6 м² (верхняя зона), а не 24 м².",
    howToAvoid:
      "На каждой стене разделять зоны отделки по высотам. Штукатурка под плитку — НЕ нужна (плитка клеится прямо на основание).",
    normRef: "ЭСН РК Сб.15 общая часть п. 1.4",
    loss: "0.5–2% сметы",
  },
  {
    id: "v2",
    category: "volumes",
    severity: "high",
    title: "Не вычтены оконные и дверные проёмы из штукатурки",
    description:
      "Площадь стен брутто не уменьшается на проёмы > 0.5 м².",
    example:
      "Стена 12×3 = 36 м², окно 1.5×1.8 = 2.7 м². Должно быть 33.3 м², а считают 36.",
    howToAvoid:
      "ВСЕГДА вычитать проёмы > 0.5 м². Меньше — можно не вычитать (по СНиП РК).",
    normRef: "ЭСН РК Сб.15 общ. часть п. 2.3",
    loss: "5–10% штукатурки на этаж",
  },
  {
    id: "v3",
    category: "volumes",
    severity: "medium",
    title: "Неправильный расчёт объёма призматоида (откосы)",
    description:
      "Объём котлована считают как параллелепипед без учёта откосов.",
    example:
      "18×24×3 = 1296 м³, а с откосами m=0.5: V = ((18·24 + 21·27)/2)·3 = 1499 м³ (на 16% больше).",
    howToAvoid:
      "Формула призматоида: V = ((F1 + F2)/2 + 2·Fmid) · h / 3 или средне-арифметическая упрощённо.",
    normRef: "СНиП РК 5.01-03-2002 п. 4.2",
    loss: "5–15% объёма земляных работ",
  },
  {
    id: "v4",
    category: "volumes",
    severity: "medium",
    title: "Неучтённый Кр (коэффициент разрыхления)",
    description:
      "Объём грунта в проекте умножают на Кр для расчёта вывоза.",
    example:
      "Котлован 1000 м³, грунт суглинок Кр=1.20. Грунт навалом = 1200 м³ (на 200 м³ больше — это +33 рейса самосвала).",
    howToAvoid:
      "ВСЕГДА для перевозки и хранения учитывать Кр. Для обратной засыпки — обратный коэффициент Ку.",
    normRef: "ЭСН РК Сб.1 общая часть, ГОСТ 25100",
    loss: "10–20% затрат на вывоз",
  },
  {
    id: "v5",
    category: "volumes",
    severity: "medium",
    title: "Неучтённое рабочее пространство в траншеях",
    description:
      "Объём траншеи считают по диаметру трубы без +0.5–0.8 м.",
    example:
      "Труба Ø160, считают траншею 0.16 м. По норме нужно Ø + 0.5 = 0.66 м (СНиП РК 3.05.04).",
    howToAvoid: "По таблице СНиП РК 3.05.04-2002 п. 4.3.",
    normRef: "СНиП РК 3.05.04, табл. 6",
    loss: "25–40% объёма траншеи",
  },
  {
    id: "v6",
    category: "volumes",
    severity: "high",
    title: "Неучтённый объём фундаментной плиты под стенами",
    description:
      "При плитном фундаменте считают только то, что под плитой объёмом, забывая что плита выступает за стены на 0.3–0.5 м для распределения нагрузки.",
    example:
      "Здание 16×24, плиту считают 16·24=384 м². По проекту 17×25 = 425 м². Разница 41 м² × 0.6 м = 24.6 м³ ж/б.",
    howToAvoid:
      "Брать чертёж плиты «П-1» из проектной документации, не ориентироваться на план здания.",
    normRef: "СП РК 5.03-106 п. 5.3",
    loss: "5–10% объёма фундаментов",
  },

  // ─── РАСЦЕНКИ (rates) ────────────────────────────────────────────────
  {
    id: "r1",
    category: "rates",
    severity: "critical",
    title: "Применение расценки не той категории грунта",
    description:
      "Грунт IV категории считают по расценкам II категории — экономия видимая, потеря реальная.",
    example:
      "100 м³ грунта IV (1-1-32) = 850 тг/м³, II (1-1-13) = 350 тг/м³. Разница 50 000 тг недополучения подрядчиком.",
    howToAvoid:
      "Использовать заключение геологии (ИГИ) или акт обследования грунта на стройплощадке.",
    normRef: "ЭСН РК Сб.1 + ГОСТ 25100",
    loss: "60–70% разницы расценки",
  },
  {
    id: "r2",
    category: "rates",
    severity: "medium",
    title: "Использование расценки для машин без расчёта КИВ",
    description:
      "Маш-час экскаватора 12 500 тг × 8 часов смены = 100 000 тг. Реальная производительность 70–85% (КИВ).",
    example:
      "Заложили в смету 100 000 тг/смена, реальная стоимость должна быть 100 000 / 0.8 = 125 000 тг (увеличение на 25%).",
    howToAvoid:
      "КИВ обязателен в калькуляции — даже если ЭСН его не указывает явно.",
    normRef: "МДС 81-3.99",
    loss: "15–30% от стоимости машин",
  },
  {
    id: "r3",
    category: "rates",
    severity: "low",
    title: "Применение расценки м.п. вместо м³",
    description:
      "При прокладке кабеля Ø50 расценка м.п. (за 1 метр трассы), а не м³ (объём кабеля).",
    example:
      "100 м.п. кабеля на трассе 80 м (с запасом 25%) — нужно считать 100 м.п. по расценке Сб.8-02-148, не пересчитывать в кубометры.",
    howToAvoid:
      "ВСЕГДА сверять единицу измерения расценки и фактического объёма работ.",
    normRef: "ЕНиР, ЭСН РК",
    loss: "100–300% (если применить «в м³»)",
  },
  {
    id: "r4",
    category: "rates",
    severity: "high",
    title: "Применение расценки нового стр-ва на демонтаж без К=0.5",
    description:
      "При демонтаже стен применяют расценку Сб.8 (новая кладка) вместо Сб.46 (демонтаж) или Сб.8 × К=0.5.",
    example:
      "Стена 10 м³ × 1845 тг (Сб.8) = 18 450 тг. Должно быть 10 м³ × 1845 × 0.5 = 9 225 тг (но это формальный расчёт, лучше Сб.46-1-001 = 8 500 тг/м³).",
    howToAvoid:
      "Проверять Сб.46 ПЕРВЫМ. Если нет — применять К=0.5 к новому стр-ву.",
    normRef: "МДС 81-25.2004 п. 2.21",
    loss: "50–100% завышения",
  },
  {
    id: "r5",
    category: "rates",
    severity: "medium",
    title: "Игнорирование коэффициентов МДС 81-35 (стеснённость, действующее)",
    description: "К=1.15 на действующих объектах не применяется.",
    example:
      "Реконструкция в действующей школе (по 2 смены работ): 25 000 000 × 1.15 = 28 750 000 тг (доплата 3.75 млн тг).",
    howToAvoid:
      "ВНЕ зависимости от типа работ — на действующем объекте применить К=1.15.",
    normRef: "МДС 81-35 п. 4.4",
    loss: "15% от СМР",
  },

  // ─── КОЭФФИЦИЕНТЫ (coef) ─────────────────────────────────────────────
  {
    id: "c1",
    category: "coef",
    severity: "high",
    title: "Применение зимнего Кз ко всему контракту",
    description:
      "Зимний коэффициент применяют ко всем работам контракта, а не только к выполненным в зимний период.",
    example:
      "Контракт на 50 млн, в зимний период выполнено 18 млн. Кз=1.30. Удорожание = 18 · 0.30 = 5.4 млн (а не 50 · 0.30 = 15 млн).",
    howToAvoid: "По журналу КС-6 определить точно объёмы зимних работ.",
    normRef: "СН РК 8.02-02-2002",
    loss: "200–500% завышения",
  },
  {
    id: "c2",
    category: "coef",
    severity: "medium",
    title: "Кр применён дважды (на разработку и на вывоз)",
    description:
      "Объём грунта × Кр для разработки, потом снова × Кр для вывоза. Кр уже включён в первое умножение.",
    example:
      "Котлован 1000 м³ × 1.20 = 1200 м³ для вывоза. Платят за 1200 м³, а считают 1000 · 1.20 · 1.20 = 1440 м³. Лишние 240 м³.",
    howToAvoid: "Кр применяется ТОЛЬКО ОДИН РАЗ.",
    normRef: "ЭСН РК Сб.1 общая часть п. 1.6",
    loss: "20% от затрат на вывоз",
  },
  {
    id: "c3",
    category: "coef",
    severity: "medium",
    title: "НР+СП применяются к материалам",
    description:
      "НР (95%) и СП (65%) — это процент от ФОТ × 0.5, а не от всех затрат.",
    example:
      "Материалы 5 млн, ФОТ 1 млн. НР: 1·0.5·0.95 = 475 тыс. СП: 1·0.5·0.65 = 325 тыс. НЕ надо считать НР+СП от 5+1 млн.",
    howToAvoid:
      "НР и СП — только к ФОТ × 0.5 (упрощённо). Точная формула: к ФОТ × коэф. в МДС 81-33.",
    normRef: "МДС 81-33.2004",
    loss: "20–50% завышения",
  },
  {
    id: "c4",
    category: "coef",
    severity: "low",
    title: "Использование старого индекса перехода",
    description: "Применяют индекс прошлого квартала, не текущего.",
    example:
      "Q3 2025 = 11.42, а считают по Q2 = 12.65 (старая база). Разница ~10%.",
    howToAvoid:
      "Сверять по new-shop.ksm.kz или ИСТ Эталон РК на дату подписания смет.",
    normRef: "ССЦ РК 8.04-08-2025",
    loss: "5–15% сметы",
  },

  // ─── НАКЛАДНЫЕ (overhead) ────────────────────────────────────────────
  {
    id: "o1",
    category: "overhead",
    severity: "medium",
    title: "НР применяется к временным зданиям",
    description:
      "ВЗС (временные здания и сооружения) — отдельная статья (раздел 8 в Ф-3), НР к ним не применяется.",
    example:
      "ВЗС 3% от СМР = 1.5 млн. Дополнительно НР 95% = +1.4 млн (ошибка). Должно быть просто 1.5 млн.",
    howToAvoid: "НР НЕ применяется к ВЗС, ПИР, резерву.",
    normRef: "МДС 81-25.2004 п. 4.21",
    loss: "5–8% сметы",
  },
  {
    id: "o2",
    category: "overhead",
    severity: "low",
    title: "Двойной учёт ОТ (охрана труда)",
    description:
      "Затраты на ОТ (0.7% от ФОТ) отдельной строкой, а потом ещё в накладных.",
    example:
      "ФОТ 1 млн, ОТ = 7000 тг отдельная строка. Затем НР 95% включает ОТ повторно (около 0.05% сметы).",
    howToAvoid:
      "Если ОТ отдельной строкой — то в МДС 81-33 п. 2.3.5 это исключено из НР (или применяется К=0.97 к НР).",
    normRef: "МДС 81-33.2004 п. 2.3.5",
    loss: "0.5–1% сметы",
  },
  {
    id: "o3",
    category: "overhead",
    severity: "low",
    title: "СП применяется без учёта типа работ",
    description:
      "СП фиксированный 65% для всех работ, хотя должен зависеть от типа.",
    example:
      "Бюджетная стройка СП=50%, коммерческая 65%, сложные технологии 75–85%.",
    howToAvoid:
      "Дифференцировать СП по тарифным группам в МДС 81-25 Прил. №3.",
    normRef: "МДС 81-25 Прил. №3",
    loss: "5–15% от стоимости работ",
  },

  // ─── МАТЕРИАЛЫ (materials) ───────────────────────────────────────────
  {
    id: "m1",
    category: "materials",
    severity: "medium",
    title: "Не учтены отходы (раскрой) для рулонных и листовых материалов",
    description:
      "Линолеум, ламинат, керамогранит, гипсокартон считают «как есть», без × 1.05–1.15.",
    example:
      "Ламинат 100 м², закупили 100 м². Раскрой по диагонали даёт 7–12% отходов = на 7–12 м² меньше получается.",
    howToAvoid: "К=1.05 для прямой укладки, 1.10–1.15 для диагональной.",
    normRef: "ССЦ РК 8.04, ЭСН РК Сб.15 общ. часть",
    loss: "7–15% материала (+ повторная доставка ещё +20–30%)",
  },
  {
    id: "m2",
    category: "materials",
    severity: "high",
    title: "Не учтены метизы и комплектующие к материалам",
    description:
      "Гипсокартон считают, но забывают про профили (CW/UW), шурупы, ленту, армоугольники.",
    example:
      "ГКЛ 100 м² по 2850 = 285 000. Профилей CW/UW: 100·1.5 = 150 м.п. × 380 = 57 000. Шурупы 100·40 шт × 35 = 140 000. Лента 80 м.п. × 120 = 9600. Итого комплектующих: 206 600 (~70% от стоимости ГКЛ).",
    howToAvoid:
      "По ССЦ РК спецификации систем (например, 1 м² ГКЛ Knauf W111 = 1.0 ГКЛ + 1.5 проф. CW/UW + 35–40 шурупов + 0.8 м.п. ленты).",
    normRef: "ССЦ РК + спецификации производителей (Knauf, USG)",
    loss: "30–70% недосчёта",
  },

  // ─── ДОКУМЕНТЫ (docs) ────────────────────────────────────────────────
  {
    id: "d1",
    category: "docs",
    severity: "high",
    title: "АОСР закрыты после фактического закрытия конструкций",
    description:
      "Скрытые работы закрыли (засыпали, забетонировали), а АОСР подписали потом — формально нарушение.",
    example:
      "Фундамент засыпан, акт о арматуре подписан через неделю на основе фотографий. При споре с заказчиком — недействительность акта.",
    howToAvoid:
      "АОСР — ТОЛЬКО до закрытия. Если упустили момент — требуется вскрытие или независимая экспертиза.",
    normRef: "СНиП РК 1.03-05-2001 п. 4.5",
    loss: "до 100% спорной работы",
  },
  {
    id: "d2",
    category: "docs",
    severity: "medium",
    title: "Журнал работ КС-6 ведётся «задним числом»",
    description:
      "Записи в журнале вносят раз в неделю/месяц, а должно быть ежедневно.",
    example:
      "При споре по задержке — «прораб не вёл записи» = нет доказательств когда именно работы выполнялись.",
    howToAvoid:
      "Ежедневная запись + подпись прораба + контроль ИТО заказчика 1–2 раза в неделю.",
    normRef: "СН РК 1.03-00-2011 п. 5.2",
    loss: "невозможность доказать выполнение работ",
  },
];

// ── Метаданные категорий и severity ──────────────────────────────────────────

const CATEGORY_LABELS: Record<Category | "all", string> = {
  all: "Все",
  volumes: "Объёмы (геометрия)",
  rates: "Расценки (ЭСН)",
  coef: "Коэффициенты (Кр, Кз)",
  overhead: "Накладные (НР, СП)",
  materials: "Материалы (ССЦ)",
  docs: "Документы (формы)",
  legal: "Юридические",
};

const CATEGORY_BADGE: Record<Category, string> = {
  volumes:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  rates:
    "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  coef:
    "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  overhead:
    "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  materials:
    "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200",
  docs:
    "bg-pink-100 text-pink-900 dark:bg-pink-900/40 dark:text-pink-200",
  legal:
    "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

const SEVERITY_META: Record<
  Severity,
  { label: string; border: string; chip: string; bold: boolean }
> = {
  low: {
    label: "LOW",
    border: "border-blue-400 dark:border-blue-500",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    bold: false,
  },
  medium: {
    label: "MEDIUM",
    border: "border-yellow-400 dark:border-yellow-500",
    chip: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    bold: false,
  },
  high: {
    label: "HIGH",
    border: "border-orange-500 dark:border-orange-400",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    bold: false,
  },
  critical: {
    label: "CRITICAL",
    border: "border-red-600 dark:border-red-500 ring-2 ring-red-300 dark:ring-red-700/50",
    chip: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100 font-bold",
    bold: true,
  },
};

// ── Сводная статистика ──────────────────────────────────────────────────────

function computeStats(list: Mistake[]) {
  const counts: Record<Severity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  list.forEach((m) => {
    counts[m.severity] += 1;
  });
  return { total: list.length, ...counts };
}

// ── Карточка ошибки ──────────────────────────────────────────────────────────

function MistakeCard({ mistake, index }: { mistake: Mistake; index: number }) {
  const sev = SEVERITY_META[mistake.severity];
  return (
    <div
      className={`rounded-xl border-2 ${sev.border} bg-red-50/60 dark:bg-zinc-900/60 p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-red-700 dark:text-red-300">
            #{index + 1}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-md uppercase tracking-wide ${sev.chip}`}
          >
            {sev.label}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-md ${CATEGORY_BADGE[mistake.category]}`}
        >
          {CATEGORY_LABELS[mistake.category]}
        </span>
      </div>

      <h3
        className={`text-lg ${
          sev.bold ? "font-extrabold" : "font-semibold"
        } text-red-900 dark:text-red-100 mb-3 leading-snug`}
      >
        {mistake.title}
      </h3>

      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase font-bold text-red-700 dark:text-red-300 tracking-wider mb-1">
            Описание
          </div>
          <p className="text-zinc-800 dark:text-zinc-200">
            {mistake.description}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-zinc-950/40 border border-red-200 dark:border-red-900/40 rounded-md p-3">
          <div className="text-xs uppercase font-bold text-red-700 dark:text-red-300 tracking-wider mb-1">
            Пример
          </div>
          <p className="text-zinc-800 dark:text-zinc-200 font-mono text-xs leading-relaxed">
            {mistake.example}
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-md p-3">
          <div className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider mb-1">
            Как избежать
          </div>
          <p className="text-zinc-800 dark:text-zinc-100">
            {mistake.howToAvoid}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-zinc-700 dark:text-zinc-300 border-t border-red-200 dark:border-red-900/40">
          <div>
            <span className="font-semibold">Норматив:</span> {mistake.normRef}
          </div>
          <div>
            <span className="font-semibold">Типичные потери:</span>{" "}
            <span className="text-red-700 dark:text-red-300 font-semibold">
              {mistake.loss}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Главная страница ─────────────────────────────────────────────────────────

export default function BestPracticesPage() {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MISTAKES.filter((m) => {
      if (activeCategory !== "all" && m.category !== activeCategory)
        return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.example.toLowerCase().includes(q) ||
        m.howToAvoid.toLowerCase().includes(q) ||
        m.normRef.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, search]);

  const totalStats = computeStats(MISTAKES);
  const filteredStats = computeStats(filtered);

  const categories: (Category | "all")[] = [
    "all",
    "volumes",
    "rates",
    "coef",
    "overhead",
    "materials",
    "docs",
    "legal",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-orange-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-red-100/80 dark:bg-zinc-900/80 border-b border-red-300 dark:border-red-900/40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm font-semibold text-red-800 dark:text-red-200 hover:text-red-600 dark:hover:text-red-100 transition-colors"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-red-700 dark:text-red-300 font-mono">
            best-practices · v1
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Title */}
        <section>
          <h1 className="text-3xl md:text-4xl font-extrabold text-red-900 dark:text-red-100 mb-2 leading-tight">
            ⚡ Лучшие практики и типовые ошибки сметчика
          </h1>
          <p className="text-sm text-red-700 dark:text-red-300">
            Quick-reference для опытных сметчиков и предупреждение для
            начинающих.
          </p>
        </section>

        {/* Введение */}
        <section className="rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-5 text-red-900 dark:text-red-100">
          <p className="font-bold mb-2">
            📌 ЭТА СТРАНИЦА — РЕАЛЬНЫЕ ОШИБКИ из практики сметчиков РК.
          </p>
          <p className="mb-2">
            Каждая стоит в среднем 0.5–3% от стоимости сметы.
          </p>
          <p className="mb-3">
            Изучи ВСЕ — на любом проекте встречается 4–7 из них.
          </p>
          <p className="text-xs italic text-red-700 dark:text-red-300 border-t border-red-300 dark:border-red-800 pt-2">
            Источники: реальные акты госэкспертизы, отчёты тех. надзора,
            судебная практика по строительным спорам РК.
          </p>
        </section>

        {/* Сводная статистика */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Всего ошибок" value={totalStats.total} tone="red" />
          <StatCard
            label="Критических"
            value={totalStats.critical}
            tone="red"
          />
          <StatCard
            label="Высокого риска"
            value={totalStats.high}
            tone="orange"
          />
          <StatCard
            label="Среднего риска"
            value={totalStats.medium}
            tone="yellow"
          />
          <StatCard label="Низкого" value={totalStats.low} tone="blue" />
          <StatCard
            label="Сум. потери"
            value="80–150%"
            tone="red"
            small
          />
        </section>

        {/* Фактоид */}
        <section className="rounded-xl border-l-4 border-red-600 bg-red-100 dark:bg-red-950/40 p-4 text-red-900 dark:text-red-100 shadow-sm">
          <p className="font-bold">
            ⚠ ВНИМАНИЕ: Эти ошибки повторяются в 8 из 10 проверках госэкспертизы
            РК. Заложи в свой чек-лист — не повторяй!
          </p>
        </section>

        {/* Фильтр + поиск */}
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = activeCategory === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    active
                      ? "bg-red-600 text-white border-red-700 shadow"
                      : "bg-white dark:bg-zinc-800 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/40"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по тексту: название, описание, норматив…"
              className="w-full px-4 py-2 rounded-lg border-2 border-red-300 dark:border-red-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/60"
              >
                сбросить
              </button>
            )}
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Показано <span className="font-semibold">{filteredStats.total}</span>{" "}
            из {totalStats.total} ошибок
            {filteredStats.critical > 0 && (
              <>
                {" "}· критических:{" "}
                <span className="text-red-700 dark:text-red-300 font-semibold">
                  {filteredStats.critical}
                </span>
              </>
            )}
            {filteredStats.high > 0 && (
              <>
                {" "}· высокого:{" "}
                <span className="text-orange-700 dark:text-orange-300 font-semibold">
                  {filteredStats.high}
                </span>
              </>
            )}
          </div>
        </section>

        {/* Список ошибок */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.length === 0 ? (
            <div className="md:col-span-2 text-center py-12 text-zinc-500 dark:text-zinc-400">
              Ошибок по фильтру не найдено. Попробуй другой запрос.
            </div>
          ) : (
            filtered.map((m, i) => (
              <MistakeCard key={m.id} mistake={m} index={i} />
            ))
          )}
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-4 text-center text-xs text-zinc-500 dark:text-zinc-400 border-t border-red-200 dark:border-red-900/30">
          AEVION Smeta Trainer · База типовых ошибок сметчиков РК ·{" "}
          {MISTAKES.length} записей
        </footer>
      </main>
    </div>
  );
}

// ── Карточка статистики ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
  small = false,
}: {
  label: string;
  value: number | string;
  tone: "red" | "orange" | "yellow" | "blue";
  small?: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    red: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800",
    orange:
      "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-800",
    yellow:
      "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-100 dark:border-yellow-800",
    blue: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-800",
  };
  return (
    <div
      className={`rounded-lg border-2 ${tones[tone]} px-3 py-2 text-center shadow-sm`}
    >
      <div
        className={`${
          small ? "text-base md:text-lg" : "text-2xl md:text-3xl"
        } font-extrabold leading-tight`}
      >
        {value}
      </div>
      <div className="text-[10px] md:text-xs uppercase tracking-wider font-semibold opacity-80 mt-0.5">
        {label}
      </div>
    </div>
  );
}
