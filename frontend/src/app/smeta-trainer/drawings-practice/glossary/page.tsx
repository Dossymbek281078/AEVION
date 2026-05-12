"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Category = "docs" | "smeta" | "rates" | "coef" | "utilities" | "construction" | "control";

interface GlossaryEntry {
  term: string;
  fullName?: string;
  category: Category;
  definition: string;
  normRef?: string;
  relatedModule?: string;
}

const ENTRIES: GlossaryEntry[] = [
  // ── Документы и формы (docs) ──
  { term: "АОСР",  fullName: "Акт освидетельствования скрытых работ", category: "docs", definition: "Подписывается перед закрытием конструкции. Без АОСР приёмка следующего этапа невозможна.", normRef: "СНиП РК 1.03-05", relatedModule: "/smeta-trainer/drawings-practice/inspections" },
  { term: "КС-2",  fullName: "Акт о приёмке выполненных работ", category: "docs", definition: "Помесячный акт приёмки с заказчиком. Основа для расчёта.", normRef: "Постановление Госкомстата РК", relatedModule: "/smeta-trainer/drawings-practice/forms-acts" },
  { term: "КС-3",  fullName: "Справка о стоимости выполненных работ и затрат", category: "docs", definition: "Сводная справка к КС-2 за отчётный период с НДС и индексами.", normRef: "Постановление Госкомстата РК", relatedModule: "/smeta-trainer/drawings-practice/forms-acts" },
  { term: "КС-6",  fullName: "Журнал общих работ", category: "docs", definition: "Ведётся ежедневно прорабом. Фиксирует все этапы, погоду, бригады.", relatedModule: "/smeta-trainer/drawings-practice/inspections" },
  { term: "КС-11", fullName: "Акт приёмки законченного строительством объекта в эксплуатацию", category: "docs", definition: "Финальный акт приёмки объекта рабочей комиссией." },
  { term: "Ф-1",   fullName: "Объектная смета (форма 1)", category: "docs", definition: "Смета по объекту целиком — суммирует все локальные сметы и затраты." },
  { term: "Ф-2",   fullName: "Локальная смета (форма 2)", category: "docs", definition: "Смета по одному разделу или виду работ. Аналог ЛСР в новой терминологии." },
  { term: "Ф-3",   fullName: "Сводный сметный расчёт (форма 3)", category: "docs", definition: "По всему объекту с НР, СП, индексами, лимитированными затратами и НДС.", relatedModule: "/smeta-trainer/drawings-practice/forms-acts" },
  { term: "Ф-4",   fullName: "Объектная смета (форма для проектной документации)", category: "docs", definition: "Используется в составе проектной документации на стадии «Проект»." },
  { term: "ЛСР",   fullName: "Локальный сметный расчёт", category: "docs", definition: "Расчёт стоимости по одному разделу/виду работ. То же, что Ф-2 в новой терминологии." },
  { term: "ВОР",   fullName: "Ведомость объёмов работ", category: "docs", definition: "Список работ с количествами и единицами измерения, без цен. Основа для составления ЛСР." },
  { term: "ПОС",   fullName: "Проект организации строительства", category: "docs", definition: "Разрабатывается на стадии «Проект». Определяет общую организацию строительства.", relatedModule: "/smeta-trainer/drawings-practice/pos-ppr" },
  { term: "ППР",   fullName: "Проект производства работ", category: "docs", definition: "Разрабатывается подрядчиком на стадии исполнения. Детализирует ПОС.", relatedModule: "/smeta-trainer/drawings-practice/pos-ppr" },
  { term: "КП",    fullName: "Календарный план", category: "docs", definition: "График выполнения работ помесячно/понедельно с привязкой к ресурсам." },
  { term: "СГП",   fullName: "Стройгенплан", category: "docs", definition: "План строительной площадки: бытовки, склады, временные сети, подъезды.", relatedModule: "/smeta-trainer/drawings-practice/pos-ppr" },

  // ── Сметные документы и нормативы (smeta) ──
  { term: "НДЦС",   fullName: "Нормативный документ по ценообразованию в строительстве", category: "smeta", definition: "Совокупность утверждённых документов, регламентирующих ценообразование в РК." },
  { term: "ССЦ",    fullName: "Сборник сметных цен", category: "smeta", definition: "Справочник текущих цен на материалы, изделия, конструкции. Например, ССЦ РК 8.04-08-2025.", normRef: "ССЦ РК (квартальные выпуски)" },
  { term: "ЭСН",    fullName: "Элементные сметные нормы", category: "smeta", definition: "Базовые нормы расхода труда, машин и материалов на единицу работ.", normRef: "ЭСН РК (по сборникам)" },
  { term: "СНБ",    fullName: "Сметно-нормативная база", category: "smeta", definition: "Совокупность всех сметных норм, индексов, цен и методических документов." },
  { term: "СНиП",   fullName: "Строительные нормы и правила", category: "smeta", definition: "Технические нормативы РК. Например, СНиП РК 5.01-03 «Основания зданий и сооружений»." },
  { term: "СП",     fullName: "Свод правил", category: "smeta", definition: "Свод правил РК. Например, СП РК 4.02-42 «Отопление, вентиляция и кондиционирование воздуха»." },
  { term: "СН",     fullName: "Строительные нормы", category: "smeta", definition: "Действующие строительные нормы РК. Дополняют СНиП и СП." },
  { term: "ГОСТ",   fullName: "Государственный стандарт", category: "smeta", definition: "Межгосударственный или национальный стандарт. Применяется при отсутствии СТ РК." },
  { term: "МДС",    fullName: "Методические документы в строительстве", category: "smeta", definition: "Методические указания по ценообразованию. Например, МДС 81-25 «Сметная прибыль»." },
  { term: "ИСТ Эталон", category: "smeta", definition: "Платная база нормативов и индексов РК с подпиской. Источник официальных ССЦ/ЭСН." },
  { term: "Сб.1",   fullName: "Сборник 1 — Земляные работы", category: "smeta", definition: "Базовый сборник ЭСН РК на разработку грунтов, котлованы, траншеи, обратную засыпку." },
  { term: "Сб.6",   fullName: "Сборник 6 — Бетонные и ж/б монолитные конструкции", category: "smeta", definition: "Расценки на устройство монолитных фундаментов, стен, перекрытий, лестниц." },

  // ── Расценки и сборники ЭСН (rates) ──
  { term: "Сб.7",   fullName: "Сборник 7 — Бетонные и ж/б сборные конструкции", category: "rates", definition: "Расценки на монтаж сборных ж/б плит, балок, колонн, ФБС." },
  { term: "Сб.8",   fullName: "Сборник 8 — Конструкции из кирпича и блоков", category: "rates", definition: "Кладка кирпича, газобетона, керамзитобетона, перегородок, столбов." },
  { term: "Сб.10",  fullName: "Сборник 10 — Деревянные конструкции", category: "rates", definition: "Окна, двери, стропильные системы, перегородки из ГКЛ по дереву." },
  { term: "Сб.12",  fullName: "Сборник 12 — Кровли", category: "rates", definition: "Устройство плоских и скатных кровель, пароизоляция, утепление, гидроизоляция." },
  { term: "Сб.15",  fullName: "Сборник 15 — Отделочные работы", category: "rates", definition: "Штукатурка, шпаклёвка, окраска, плитка, обои, подвесные потолки." },
  { term: "Сб.16",  fullName: "Сборник 16 — Водопровод и канализация (внутренние)", category: "rates", definition: "Внутренние трубопроводы ХВС, ГВС, канализации, санитарно-технические приборы." },
  { term: "Сб.20",  fullName: "Сборник 20 — Вентиляция и кондиционирование", category: "rates", definition: "Воздуховоды, вентиляторы, узлы прохода, изоляция, диффузоры." },
  { term: "Сб.22",  fullName: "Сборник 22 — Канализация (наружные сети)", category: "rates", definition: "Прокладка наружных сетей канализации, колодцы КК, выпуски." },
  { term: "Сб.24",  fullName: "Сборник 24 — Тепловые сети, газопроводы", category: "rates", definition: "Наружные тепловые сети и газопроводы, изоляция, опоры, тепловые камеры." },
  { term: "Сб.26",  fullName: "Сборник 26 — Изоляция трубопроводов и оборудования", category: "rates", definition: "Тепловая и противокоррозионная изоляция, покровный слой." },
  { term: "Сб.27",  fullName: "Сборник 27 — Автомобильные дороги", category: "rates", definition: "Дорожная одежда, асфальтобетонное покрытие, бордюры, тротуары." },
  { term: "Сб.46",  fullName: "Сборник 46 — Реконструкция и демонтаж", category: "rates", definition: "Разборка конструкций, демонтаж, ремонтно-восстановительные работы." },
  { term: "Сб.47",  fullName: "Сборник 47 — Озеленение", category: "rates", definition: "Газоны, посадка деревьев и кустарников, малые архитектурные формы." },

  // ── Коэффициенты (coef) ──
  { term: "Кр",  fullName: "Коэффициент разрыхления грунта", category: "coef", definition: "Учитывает увеличение объёма грунта при разработке. 1.10–1.50 в зависимости от группы.", normRef: "СНиП РК 5.01-03" },
  { term: "Ку",  fullName: "Коэффициент уплотнения", category: "coef", definition: "Учитывает уменьшение объёма при уплотнении. Нужен для расчёта обратной засыпки." },
  { term: "Кз",  fullName: "Коэффициент удорожания зимних работ", category: "coef", definition: "1.05–1.60 в зависимости от температурной зоны и видов работ.", normRef: "ГСН 81-05-02" },
  { term: "Кв",  fullName: "Коэффициент использования времени", category: "coef", definition: "Доля сменного времени, в течение которой машина выполняет полезную работу." },
  { term: "НР",  fullName: "Накладные расходы", category: "coef", definition: "80–120% от ФОТ. Покрывают административно-хозяйственные расходы подрядчика.", normRef: "МДС 81-33", relatedModule: "/smeta-trainer/drawings-practice/cost-engine" },
  { term: "СП",  fullName: "Сметная прибыль", category: "coef", definition: "50–85% от ФОТ. Плановая прибыль подрядной организации.", normRef: "МДС 81-25" },
  { term: "ФОТ", fullName: "Фонд оплаты труда", category: "coef", definition: "Прямые затраты на заработную плату рабочих и машинистов. База для НР и СП." },
  { term: "Индекс", fullName: "Индекс пересчёта", category: "coef", definition: "Коэффициент перехода от базисных цен 2001 г. к текущим. Публикуется ежеквартально.", relatedModule: "/smeta-trainer/drawings-practice/cost-engine" },
  { term: "НДС", fullName: "Налог на добавленную стоимость", category: "coef", definition: "12% в РК. Начисляется на итог сводного сметного расчёта." },
  { term: "М",   fullName: "Модуль поверхности конструкции", category: "coef", definition: "М = F/V — отношение охлаждаемой поверхности к объёму. Для зимнего бетонирования." },

  // ── Инженерные сети (utilities) ──
  { term: "ХВС", fullName: "Холодное водоснабжение", category: "utilities", definition: "Подача питьевой воды температурой не более +25 °C." },
  { term: "ГВС", fullName: "Горячее водоснабжение", category: "utilities", definition: "Подача воды температурой +60…+75 °C от теплоузла или бойлера." },
  { term: "ВК",  fullName: "Водомерный колодец", category: "utilities", definition: "Колодец с узлом учёта на вводе водопровода в здание.", relatedModule: "/smeta-trainer/drawings-practice/water" },
  { term: "КК",  fullName: "Канализационный колодец", category: "utilities", definition: "Смотровой/перепадной колодец на наружной сети канализации (КК-1000, КК-1500).", relatedModule: "/smeta-trainer/drawings-practice/sewage" },
  { term: "Т1, Т2", fullName: "Подающий и обратный трубопроводы теплосети", category: "utilities", definition: "Т1 — подача (горячая), Т2 — обратка (остывшая). Двухтрубная схема теплоснабжения.", relatedModule: "/smeta-trainer/drawings-practice/heating" },
  { term: "НД",  fullName: "Низкое давление (для газа)", category: "utilities", definition: "До 0.005 МПа. Используется для бытовых потребителей.", relatedModule: "/smeta-trainer/drawings-practice/gas" },
  { term: "СД",  fullName: "Среднее давление (для газа)", category: "utilities", definition: "0.005–0.3 МПа. Для квартальных распределительных сетей." },
  { term: "АДН", fullName: "Воздухораспределитель", category: "utilities", definition: "Решётка/диффузор для подачи воздуха в помещение от вентсистемы.", relatedModule: "/smeta-trainer/drawings-practice/ventilation" },
  { term: "АВВГ", fullName: "Кабель силовой алюминиевый с виниловой изоляцией", category: "utilities", definition: "Силовой кабель с алюминиевыми жилами в ПВХ-оболочке. До 1 кВ.", relatedModule: "/smeta-trainer/drawings-practice/cables" },
  { term: "ЛСО-450", fullName: "Лента сигнальная оранжевая, ширина 450 мм", category: "utilities", definition: "Укладывается над кабельной трассой как защитное предупреждение.", relatedModule: "/smeta-trainer/drawings-practice/cables" },

  // ── Строительные термины (construction) ──
  { term: "СМР",  fullName: "Строительно-монтажные работы", category: "construction", definition: "Совокупность работ по возведению зданий и монтажу оборудования." },
  { term: "ЖБИ",  fullName: "Железобетонные изделия", category: "construction", definition: "Сборные ж/б элементы заводского изготовления: плиты, балки, колонны, ФБС." },
  { term: "ЖБК",  fullName: "Железобетонные конструкции", category: "construction", definition: "Конструкции из железобетона — монолитные или сборные." },
  { term: "ХПП",  fullName: "Холодное прессование плит", category: "construction", definition: "Технология производства плит без термообработки (холодным методом)." },
  { term: "СФТК", fullName: "Система фасадная теплоизоляционная композитная", category: "construction", definition: "«Мокрый фасад»: утеплитель + клей + сетка + штукатурка + краска.", relatedModule: "/smeta-trainer/drawings-practice/facade-svtk" },
  { term: "НВФ",  fullName: "Навесной вентилируемый фасад", category: "construction", definition: "Подоблицовочная конструкция + утеплитель + воздушный зазор + облицовка.", relatedModule: "/smeta-trainer/drawings-practice/facade-svtk" },
  { term: "ОБ",   fullName: "Обмазочная гидроизоляция", category: "construction", definition: "Битумные или полимерные мастики, наносимые валиком или кистью." },
  { term: "ПС",   fullName: "Пенополистирол", category: "construction", definition: "Утеплитель из вспененных гранул полистирола. Часто = ПСБ-С." },
  { term: "XPS",  fullName: "Экструдированный пенополистирол", category: "construction", definition: "Плотный плитный утеплитель закрытоячеистой структуры. Для цоколей, кровель, инверсий." },
  { term: "ППС",  fullName: "Пенополистирол", category: "construction", definition: "Общее название утеплителя из полистирола. Маркировка ПСБ-С 15/25/35." },
  { term: "МАФ",  fullName: "Малые архитектурные формы", category: "construction", definition: "Скамьи, урны, перголы, ограждения, декоративные элементы благоустройства.", relatedModule: "/smeta-trainer/drawings-practice/landscape" },
  { term: "ОСБ",  fullName: "Ориентированно-стружечная плита (OSB)", category: "construction", definition: "Древесно-стружечная плита для обшивки каркасных конструкций." },

  // ── Контроль и приёмка (control) ──
  { term: "КС",   fullName: "Контроль качества (Quality Control)", category: "control", definition: "Также — серия унифицированных форм Госкомстата (КС-2, КС-3, КС-6, КС-11)." },
  { term: "ОТ",   fullName: "Охрана труда", category: "control", definition: "Система мероприятий по сохранению жизни и здоровья работников.", relatedModule: "/smeta-trainer/drawings-practice/safety" },
  { term: "ТБ",   fullName: "Техника безопасности", category: "control", definition: "Совокупность технических и организационных мер для предотвращения травматизма." },
  { term: "ППБ",  fullName: "Правила противопожарной безопасности", category: "control", definition: "Нормативные требования по предотвращению пожаров на стройплощадке." },
  { term: "ВДГО", fullName: "Внутридомовое газовое оборудование", category: "control", definition: "Газопроводы, счётчики и приборы внутри здания. Подлежит ТО специализированной организацией." },
  { term: "АСУ",  fullName: "Автоматизированная система управления", category: "control", definition: "Системы автоматики и диспетчеризации инженерных систем здания." },
  { term: "ОВ",   fullName: "Отопление и вентиляция", category: "control", definition: "Раздел проекта инженерных систем здания." },
  { term: "ОВиК", fullName: "Отопление, вентиляция и кондиционирование", category: "control", definition: "Расширенный раздел проекта с системами кондиционирования." },
  { term: "ПИР",  fullName: "Проектные и изыскательские работы", category: "control", definition: "Инженерные изыскания + проектирование. Отдельная глава ССР." },
  { term: "КЗ",   fullName: "Контрольная зона / Контроль качества", category: "control", definition: "Зона особого контроля либо синоним «контроль качества» в зависимости от контекста." },
];

const CATEGORIES: { id: Category; icon: string; title: string; short: string }[] = [
  { id: "docs",         icon: "📄", title: "Документы и формы",        short: "Документы" },
  { id: "smeta",        icon: "📚", title: "Сметные нормативы",        short: "Сметные" },
  { id: "rates",        icon: "💵", title: "Расценки и сборники ЭСН",  short: "Расценки" },
  { id: "coef",         icon: "🧮", title: "Коэффициенты",             short: "Коэф-ты" },
  { id: "utilities",    icon: "🔌", title: "Инженерные сети",          short: "Сети" },
  { id: "construction", icon: "🏗", title: "Строительные термины",     short: "Стройка" },
  { id: "control",      icon: "✅", title: "Контроль и приёмка",       short: "Контроль" },
];

const CATEGORY_BADGE: Record<Category, string> = {
  docs:         "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  smeta:        "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  rates:        "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  coef:         "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  utilities:    "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  construction: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  control:      "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
};

// Регистронезависимое сравнение для русского/латиницы
function ciIncludes(haystack: string | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLocaleLowerCase("ru-RU").includes(needle);
}

// Подсветка совпадений в строке
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLocaleLowerCase("ru-RU");
  const q = query.toLocaleLowerCase("ru-RU");
  const parts: Array<{ s: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const pos = lower.indexOf(q, i);
    if (pos === -1) {
      parts.push({ s: text.slice(i), hit: false });
      break;
    }
    if (pos > i) parts.push({ s: text.slice(i, pos), hit: false });
    parts.push({ s: text.slice(pos, pos + q.length), hit: true });
    i = pos + q.length;
  }
  return (
    <>
      {parts.map((p, idx) =>
        p.hit ? (
          <mark key={idx} className="bg-amber-200 text-slate-900 dark:bg-amber-500/40 dark:text-amber-100 rounded px-0.5">
            {p.s}
          </mark>
        ) : (
          <span key={idx}>{p.s}</span>
        )
      )}
    </>
  );
}

export default function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const q = search.trim().toLocaleLowerCase("ru-RU");

  const visibleEntries = useMemo(() => {
    return ENTRIES.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!q) return true;
      return ciIncludes(e.term, q) || ciIncludes(e.fullName, q) || ciIncludes(e.definition, q);
    });
  }, [filter, q]);

  const visibleByCat = useMemo(() => {
    const map: Record<string, GlossaryEntry[]> = {};
    for (const e of visibleEntries) {
      if (!map[e.category]) map[e.category] = [];
      map[e.category].push(e);
    }
    // Сортировка по алфавиту в каждой категории
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.term.localeCompare(b.term, "ru-RU"));
    }
    return map;
  }, [visibleEntries]);

  const reset = () => {
    setSearch("");
    setFilter("all");
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← К разделам
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              📖 Глоссарий — термины сметного дела РК
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {ENTRIES.length} терминов · 7 категорий · поиск по сокращениям и определениям
            </p>
          </div>
          <input
            type="search"
            placeholder="Поиск: введи термин или сокращение"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg w-72"
          />
        </div>
      </header>

      <div className="bg-slate-100 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 px-6 py-2 text-xs text-slate-700 dark:text-slate-300">
        💡 Справочник всех аббревиатур и терминов сметного дела РК. Используй поиск или фильтр по категориям. Клик на «→ Подробнее» ведёт в соответствующий модуль курса.
      </div>

      {/* Фильтры по категориям */}
      <div className="max-w-6xl mx-auto px-6 pt-4 flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
            filter === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
          }`}
        >
          ✦ Все ({ENTRIES.length})
        </button>
        {CATEGORIES.map((c) => {
          const cnt = ENTRIES.filter((e) => e.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
                filter === c.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}
            >
              {c.icon} {c.short} <span className="opacity-60">({cnt})</span>
            </button>
          );
        })}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {visibleEntries.length === 0 && (
          <div className="text-center py-16">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              По запросу «{search}» ничего не найдено.
            </div>
            <button
              onClick={reset}
              className="text-xs px-4 py-2 bg-slate-700 text-white rounded-full font-semibold hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {CATEGORIES.map((c) => {
          const items = visibleByCat[c.id];
          if (!items || items.length === 0) return null;
          return (
            <section key={c.id} className="mb-7">
              <div className="mb-3 flex items-baseline gap-2 border-b border-slate-300 dark:border-slate-700 pb-1.5">
                <span className="text-xl">{c.icon}</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  {c.title}
                </h2>
                <span className="text-[10px] text-slate-400 ml-auto">{items.length} терминов</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((e) => (
                  <article
                    key={`${e.category}-${e.term}`}
                    className="bg-slate-100 dark:bg-slate-900 border-l-4 border-slate-500 dark:border-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-1.5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        <Highlight text={e.term} query={q} />
                      </h3>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${CATEGORY_BADGE[e.category]}`}
                      >
                        {c.short}
                      </span>
                    </div>
                    {e.fullName && (
                      <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 leading-snug">
                        <Highlight text={e.fullName} query={q} />
                      </div>
                    )}
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      <Highlight text={e.definition} query={q} />
                    </p>
                    {(e.normRef || e.relatedModule) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-300 dark:border-slate-700 flex flex-col gap-0.5">
                        {e.normRef && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-500">
                            <span className="font-semibold">Норматив:</span> {e.normRef}
                          </div>
                        )}
                        {e.relatedModule && (
                          <Link
                            href={e.relatedModule}
                            className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            → Подробнее: {e.relatedModule}
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {/* Фактоид */}
        <div className="mt-8 bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            💡 Если встретишь незнакомый термин в любом модуле — возвращайся сюда. {ENTRIES.length}+ терминов покрывают весь курс сметного дела РК. Можешь добавить свой термин через GitHub Issue.
          </div>
        </div>
      </div>

      {/* Кнопка «Прокрутить наверх» */}
      {showTop && (
        <button
          onClick={scrollToTop}
          aria-label="Прокрутить наверх"
          className="fixed bottom-6 right-6 z-20 w-11 h-11 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100 flex items-center justify-center text-lg font-bold transition-all"
        >
          ↑
        </button>
      )}
    </div>
  );
}
