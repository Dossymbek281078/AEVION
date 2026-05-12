"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * База цен на основные строительные материалы — учебная выборка из ССЦ РК 8.04-08-2025.
 * Цены — средние по г. Алматы на III квартал 2025 г. с НДС.
 * Не для коммерческих расчётов!
 */

type Category =
  | "concrete"
  | "brick"
  | "insulation"
  | "roofing"
  | "finishing"
  | "utilities"
  | "electric"
  | "maf";

interface Material {
  id: string;
  name: string;
  category: Category;
  unit: string;
  priceKzt: number;
  specs?: string;
  gost?: string;
}

const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  concrete:   { label: "Бетон",       icon: "🔲", color: "slate"   },
  brick:      { label: "Кирпич",      icon: "🧱", color: "orange"  },
  insulation: { label: "Утеплитель",  icon: "🧊", color: "sky"     },
  roofing:    { label: "Кровля",      icon: "🏠", color: "blue"    },
  finishing:  { label: "Отделка",     icon: "🎨", color: "violet"  },
  utilities:  { label: "Сети",        icon: "🚰", color: "teal"    },
  electric:   { label: "Электрика",   icon: "⚡", color: "amber"   },
  maf:        { label: "МАФ",         icon: "🌳", color: "emerald" },
};

const MATERIALS: Material[] = [
  // ── Бетон и раствор (concrete) ──
  { id: "c-01", name: "Бетон М200 W4 (товарный)",                 category: "concrete", unit: "м³",       priceKzt: 36500, specs: "Товарный, для подготовок и фундаментов", gost: "ГОСТ 7473-2010" },
  { id: "c-02", name: "Бетон М300 W6",                            category: "concrete", unit: "м³",       priceKzt: 41800, specs: "Товарный, для фундаментов и перекрытий", gost: "ГОСТ 7473-2010" },
  { id: "c-03", name: "Бетон М400 W8 (для гидротехн.)",           category: "concrete", unit: "м³",       priceKzt: 52000, specs: "Гидротехнический, повышенная водонепроницаемость", gost: "ГОСТ 7473-2010" },
  { id: "c-04", name: "Раствор кладочный М100",                    category: "concrete", unit: "м³",       priceKzt: 28000, specs: "Цементно-песчаный, для кирпичной кладки", gost: "ГОСТ 28013-98" },
  { id: "c-05", name: "Раствор штукатурный цем-известк. М75",      category: "concrete", unit: "м³",       priceKzt: 26500, specs: "Для штукатурки внутренних и наружных стен", gost: "ГОСТ 28013-98" },
  { id: "c-06", name: "Сухая смесь Knauf Ротбанд (штукатурка)",   category: "concrete", unit: "мешок 30 кг", priceKzt: 4200,  specs: "Гипсовая штукатурка ручного нанесения" },
  { id: "c-07", name: "Сухая смесь Ceresit CT 17 (грунт)",        category: "concrete", unit: "л",        priceKzt: 850,   specs: "Грунтовка глубокого проникновения" },
  { id: "c-08", name: "Цемент М500 Д0 (мешок 50 кг)",             category: "concrete", unit: "мешок",    priceKzt: 4500,  specs: "Портландцемент без добавок", gost: "ГОСТ 31108-2020" },

  // ── Кирпич и блоки (brick) ──
  { id: "b-01", name: "Кирпич рядовой полнотелый М150",           category: "brick", unit: "шт",         priceKzt: 95,    specs: "Для несущих стен, фундаментов", gost: "ГОСТ 530" },
  { id: "b-02", name: "Кирпич рядовой пустотелый М125",           category: "brick", unit: "шт",         priceKzt: 80,    specs: "Для самонесущих стен", gost: "ГОСТ 530" },
  { id: "b-03", name: "Кирпич облицовочный гладкий М150",         category: "brick", unit: "шт",         priceKzt: 165,   specs: "Лицевой, морозостойкий F50", gost: "ГОСТ 530" },
  { id: "b-04", name: "Кирпич клинкерный",                         category: "brick", unit: "шт",         priceKzt: 380,   specs: "Высокопрочный, для фасадов и тротуаров", gost: "ГОСТ 32311-2012" },
  { id: "b-05", name: "Газоблок D500 600×300×200",                category: "brick", unit: "шт",         priceKzt: 950,   specs: "Автоклавный, для несущих стен малоэтажки", gost: "ГОСТ 31360" },
  { id: "b-06", name: "Пеноблок D700 600×300×200",                 category: "brick", unit: "шт",         priceKzt: 1200,  specs: "Конструкционно-теплоизоляционный", gost: "ГОСТ 21520-89" },
  { id: "b-07", name: "Керамзитобетонный блок 390×190×190",        category: "brick", unit: "шт",         priceKzt: 380,   specs: "Для несущих и самонесущих стен", gost: "ГОСТ 6133-2019" },
  { id: "b-08", name: "Гипсокартон ГКЛ 12.5 мм Knauf 1.2×2.5 м",  category: "brick", unit: "лист",       priceKzt: 2850,  specs: "Стандартный, для перегородок и облицовки", gost: "ГОСТ 6266-97" },

  // ── Утеплитель (insulation) ──
  { id: "i-01", name: "ППС-25 (пенополистирол) 100 мм",            category: "insulation", unit: "м²",   priceKzt: 1350,  specs: "Плотность 25 кг/м³, для фасадов", gost: "ГОСТ 15588-2014" },
  { id: "i-02", name: "ППС-35 (плотный) 100 мм",                   category: "insulation", unit: "м²",   priceKzt: 1850,  specs: "Плотность 35 кг/м³, для нагруженных конструкций", gost: "ГОСТ 15588-2014" },
  { id: "i-03", name: "ХПС/XPS 100 мм Технониколь",                category: "insulation", unit: "м²",   priceKzt: 3200,  specs: "Экструдированный пенополистирол, для цоколей и кровель", gost: "ГОСТ 32310-2012" },
  { id: "i-04", name: "Минвата URSA 100 мм рулон",                 category: "insulation", unit: "м²",   priceKzt: 1850,  specs: "Стекловолокно, для каркасных конструкций" },
  { id: "i-05", name: "Минвата Rockwool ROCKMIN 100 мм",           category: "insulation", unit: "м²",   priceKzt: 2350,  specs: "Базальтовая, для перегородок и перекрытий" },
  { id: "i-06", name: "Базальтовая Парок (для кровли, фасадов) 100 мм", category: "insulation", unit: "м²", priceKzt: 4200, specs: "Высокая плотность, негорючая НГ" },
  { id: "i-07", name: "ППУ напыляемый 100 мм",                     category: "insulation", unit: "м²",   priceKzt: 6500,  specs: "Пенополиуретан, бесшовное напыление" },
  { id: "i-08", name: "Минвата для трубопроводов URSA М21",        category: "insulation", unit: "м³",   priceKzt: 22000, specs: "Цилиндры для тепло- и водопровода" },

  // ── Кровля (roofing) ──
  { id: "r-01", name: "Рубероид РКП-350 (1 м × 15 м)",             category: "roofing", unit: "рулон",  priceKzt: 4200,  specs: "Подкладочный с пылевидной посыпкой", gost: "ГОСТ 10923-93" },
  { id: "r-02", name: "Линокром К ХПП наплавляемый",               category: "roofing", unit: "рулон 10 м²", priceKzt: 7800, specs: "Гидроизоляционный наплавляемый, нижний слой" },
  { id: "r-03", name: "Бикрост ТКП наплавляемый",                  category: "roofing", unit: "рулон 10 м²", priceKzt: 12500, specs: "Верхний слой кровельного ковра, сланцевая посыпка" },
  { id: "r-04", name: "Унифлекс ЭКП ВЭ",                            category: "roofing", unit: "рулон 10 м²", priceKzt: 18200, specs: "СБС-модифицированный, повышенной долговечности" },
  { id: "r-05", name: "Профнастил оцинк. С21 (0.5 мм)",            category: "roofing", unit: "м²",     priceKzt: 4200,  specs: "Стеновой/кровельный, высота волны 21 мм" },
  { id: "r-06", name: "Металлочерепица Монтеррей 0.45 мм",         category: "roofing", unit: "м²",     priceKzt: 5800,  specs: "Полиэстер RAL, для скатных кровель" },
  { id: "r-07", name: "Битумная черепица Tegola Top Shingle",      category: "roofing", unit: "м²",     priceKzt: 6500,  specs: "Многослойная, базальтовая посыпка" },
  { id: "r-08", name: "Ондулин классический",                       category: "roofing", unit: "лист 2×0.95 м", priceKzt: 4800, specs: "Битум-целлюлозный, для лёгких кровель" },

  // ── Отделка (finishing) ──
  { id: "f-01", name: "Плитка керамическая 300×300 матовая",        category: "finishing", unit: "м²", priceKzt: 4200,  specs: "Для пола санузлов и подсобных помещений" },
  { id: "f-02", name: "Плитка керамическая 600×600 ректификат",     category: "finishing", unit: "м²", priceKzt: 8500,  specs: "Ректифицированная кромка, бесшовная укладка" },
  { id: "f-03", name: "Керамогранит 600×600×10 матовый",            category: "finishing", unit: "м²", priceKzt: 9800,  specs: "Полнотелый, морозостойкий", gost: "ГОСТ 6787-2001" },
  { id: "f-04", name: "Линолеум коммерческий Tarkett 2.5 мм",       category: "finishing", unit: "м²", priceKzt: 4800,  specs: "Класс износостойкости 33-34" },
  { id: "f-05", name: "Ламинат 33 кл. Kronospan 8 мм",              category: "finishing", unit: "м²", priceKzt: 3800,  specs: "Для офисных и общественных помещений" },
  { id: "f-06", name: "Паркетная доска ясень 14 мм",                category: "finishing", unit: "м²", priceKzt: 18500, specs: "Трёхслойная, заводская тонировка" },
  { id: "f-07", name: "Краска ВД интерьерная Tikkurila Joker (9 л)", category: "finishing", unit: "банка", priceKzt: 18500, specs: "Гипоаллергенная, расход ~10 м²/л" },
  { id: "f-08", name: "Краска ВД фасадная Caparol",                  category: "finishing", unit: "л",  priceKzt: 1850,  specs: "Атмосферостойкая, для минеральных оснований" },
  { id: "f-09", name: "Шпатлёвка Vetonit LR+ (25 кг)",               category: "finishing", unit: "мешок", priceKzt: 4800, specs: "Финишная, под покраску" },
  { id: "f-10", name: "Грунтовка Ceresit CT 17 (10 л)",              category: "finishing", unit: "канистра", priceKzt: 8500, specs: "Глубокого проникновения, под все основания" },

  // ── Сети — трубы и арматура (utilities) ──
  { id: "u-01", name: "Труба ПЭ100 SDR17 Ø160 (PN10)",              category: "utilities", unit: "м.п.", priceKzt: 4200,  specs: "Водоснабжение, рабочее давление 10 атм", gost: "ГОСТ 18599-2001" },
  { id: "u-02", name: "Труба ПЭ100 SDR11 Ø110 (газовая)",           category: "utilities", unit: "м.п.", priceKzt: 3500,  specs: "Газоснабжение низкого/среднего давления", gost: "ГОСТ Р 50838-2009" },
  { id: "u-03", name: "Труба ПВХ Ø200 канализационная",              category: "utilities", unit: "м.п.", priceKzt: 2800,  specs: "Раструбная, для самотечной канализации", gost: "ГОСТ 32413-2013" },
  { id: "u-04", name: "Труба сталь Ø108×4 (теплосеть)",              category: "utilities", unit: "м.п.", priceKzt: 5200,  specs: "ВГП оцинк., для тепловых сетей", gost: "ГОСТ 10704-91" },
  { id: "u-05", name: "Колодец КК Ø1000 (днище + 2 кольца + плита)", category: "utilities", unit: "комплект", priceKzt: 95000, specs: "Канализационный, ж/б, типовой", gost: "ГОСТ 8020-2016" },
  { id: "u-06", name: "Колодец ВК Ø1500",                             category: "utilities", unit: "комплект", priceKzt: 145000, specs: "Водопроводный, ж/б, типовой", gost: "ГОСТ 8020-2016" },
  { id: "u-07", name: "Задвижка чугун. Ø100 30ч6бр",                  category: "utilities", unit: "шт",   priceKzt: 28500, specs: "Клиновая с выдвижным шпинделем" },
  { id: "u-08", name: "Гидрант пожарный наземный Ø100",               category: "utilities", unit: "шт",   priceKzt: 185000, specs: "Стальной, для систем пожаротушения", gost: "ГОСТ 53961-2010" },

  // ── Электрика и кабели (electric) ──
  { id: "e-01", name: "Кабель АВВГ 4×95",                             category: "electric", unit: "м.п.", priceKzt: 8500, specs: "Алюминий, ПВХ-изоляция, до 1 кВ", gost: "ГОСТ 31996-2012" },
  { id: "e-02", name: "Кабель АВВГ 4×35",                             category: "electric", unit: "м.п.", priceKzt: 3200, specs: "Алюминий, ПВХ-изоляция, до 1 кВ", gost: "ГОСТ 31996-2012" },
  { id: "e-03", name: "Кабель ВВГнг-LS 3×2.5",                        category: "electric", unit: "м.п.", priceKzt: 850,  specs: "Медь, не распр. горение, низкое дымовыделение", gost: "ГОСТ 31996-2012" },
  { id: "e-04", name: "Лента сигнальная ЛСО-450 (рулон 100 м)",       category: "electric", unit: "рулон", priceKzt: 4800, specs: "Защитно-сигнальная для кабельных трасс" },
  { id: "e-05", name: "Гофра ПВХ Ø25 (рулон 25 м)",                   category: "electric", unit: "рулон", priceKzt: 4200, specs: "Гибкая, для скрытой проводки" },
  { id: "e-06", name: "Светильник LED уличный 80 Вт",                  category: "electric", unit: "шт",    priceKzt: 38500, specs: "IP65, для опор освещения 6-8 м" },

  // ── МАФ (maf) ──
  { id: "m-01", name: "Скамья парковая чугун + дерево",                category: "maf", unit: "шт", priceKzt: 65000, specs: "Длина 1.8 м, спинка дерево, опоры чугун" },
  { id: "m-02", name: "Урна металлическая 30 л",                        category: "maf", unit: "шт", priceKzt: 18500, specs: "Окрашенная сталь, для парков и скверов" },
  { id: "m-03", name: "Бордюр БР 100.30.15 (1.0 м)",                    category: "maf", unit: "шт", priceKzt: 2850,  specs: "Дорожный ж/б, серый", gost: "ГОСТ 6665-91" },
  { id: "m-04", name: "Тротуарная плитка 300×300×60 (брусчатка)",       category: "maf", unit: "м²", priceKzt: 3800,  specs: "Вибропрессованная, морозостойкая", gost: "ГОСТ 17608-2017" },
  { id: "m-05", name: "Газон рулонный (1 м²)",                          category: "maf", unit: "м²", priceKzt: 1800,  specs: "Партерный, толщина дёрна 20 мм" },
  { id: "m-06", name: "Семена газона Country Eurogras (1 кг)",          category: "maf", unit: "кг", priceKzt: 4200,  specs: "Универсальная смесь, расход 30-40 г/м²" },
];

type SortMode = "name-asc" | "name-desc" | "price-asc" | "price-desc";

const CATEGORY_BORDER: Record<Category, string> = {
  concrete:   "border-l-4 border-slate-400 dark:border-slate-500",
  brick:      "border-l-4 border-orange-400 dark:border-orange-500",
  insulation: "border-l-4 border-sky-400 dark:border-sky-500",
  roofing:    "border-l-4 border-blue-400 dark:border-blue-500",
  finishing:  "border-l-4 border-violet-400 dark:border-violet-500",
  utilities:  "border-l-4 border-teal-400 dark:border-teal-500",
  electric:   "border-l-4 border-amber-400 dark:border-amber-500",
  maf:        "border-l-4 border-emerald-400 dark:border-emerald-500",
};

const CATEGORY_PILL: Record<Category, string> = {
  concrete:   "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  brick:      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  insulation: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  roofing:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  finishing:  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  utilities:  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  electric:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  maf:        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function formatPrice(n: number): string {
  return n.toLocaleString("ru-RU");
}

export default function MaterialsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");

  // Калькулятор
  const [calcMaterialId, setCalcMaterialId] = useState<string>(MATERIALS[0].id);
  const [calcQty, setCalcQty] = useState<string>("1");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = MATERIALS.filter((m) => {
      if (activeCategory !== "all" && m.category !== activeCategory) return false;
      if (!q) return true;
      const hay = `${m.name} ${m.specs ?? ""} ${m.gost ?? ""} ${m.unit}`.toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case "name-asc":  return a.name.localeCompare(b.name, "ru");
        case "name-desc": return b.name.localeCompare(a.name, "ru");
        case "price-asc": return a.priceKzt - b.priceKzt;
        case "price-desc":return b.priceKzt - a.priceKzt;
      }
    });

    return list;
  }, [search, activeCategory, sortMode]);

  const calcMaterial = useMemo(
    () => MATERIALS.find((m) => m.id === calcMaterialId) ?? MATERIALS[0],
    [calcMaterialId]
  );
  const calcQtyNum = parseFloat(calcQty.replace(",", ".")) || 0;
  const calcTotal = calcMaterial.priceKzt * calcQtyNum;

  async function handleCopy() {
    const text = `${calcMaterial.name} — ${formatPrice(calcQtyNum)} ${calcMaterial.unit} × ${formatPrice(calcMaterial.priceKzt)} тг = ${formatPrice(Math.round(calcTotal))} тг`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      // fallback: невозможно скопировать
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header bar */}
      <div className="border-b border-emerald-200 dark:border-emerald-900/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100 font-medium flex items-center gap-1"
          >
            <span>←</span>
            <span>К разделам</span>
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            ССЦ РК 8.04-08-2025 · учебная выборка
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          💼 Цены на материалы — ССЦ РК 8.04-08-2025 (учебная выборка)
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          База средних цен по г. Алматы для отработки методики калькуляции стоимости.
        </p>

        {/* Описание / предупреждение */}
        <div className="mb-6 rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠</span>
            <div className="space-y-2 text-sm text-emerald-900 dark:text-emerald-200">
              <p className="font-semibold">
                ВНИМАНИЕ: Это УЧЕБНАЯ выборка для отработки методики расчёта.
              </p>
              <p>
                Реальные цены актуализируются ежеквартально через ИСТ Эталон РК.
                Не используй для коммерческих расчётов.
              </p>
              <p className="text-emerald-800/80 dark:text-emerald-300/70 pt-1 border-t border-emerald-300/50 dark:border-emerald-800/50">
                <span className="font-medium">Источник:</span> ССЦ РК 8.04-08-2025, выборка из 60+ позиций.
                Цены — средние по г. Алматы на III квартал 2025 г. с НДС.
              </p>
            </div>
          </div>
        </div>

        {/* Поиск */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔎 Поиск материала (название, спецификация, ГОСТ)..."
            className="w-full px-4 py-3 rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Фильтры по категории */}
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">
            Категории:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === "all"
                  ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
                  : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-emerald-600"
              }`}
            >
              Все ({MATERIALS.length})
            </button>
            {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = MATERIALS.filter((m) => m.category === cat).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isActive
                      ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
                      : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-emerald-600"
                  }`}
                >
                  <span className="mr-1">{meta.icon}</span>
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Сортировка */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Сортировка:
          </span>
          {([
            { id: "name-asc",  label: "По названию ▲" },
            { id: "name-desc", label: "По названию ▼" },
            { id: "price-asc", label: "По цене ▲" },
            { id: "price-desc",label: "По цене ▼" },
          ] as { id: SortMode; label: string }[]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSortMode(opt.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                sortMode === opt.id
                  ? "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700"
                  : "bg-white text-slate-700 border-slate-300 hover:border-amber-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-amber-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            Найдено: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{filtered.length}</span> поз.
          </span>
        </div>

        {/* Карточки материалов */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
            Ничего не найдено. Попробуйте изменить запрос или сбросить фильтр категории.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m) => {
              const meta = CATEGORY_META[m.category];
              return (
                <div
                  key={m.id}
                  className={`rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition-shadow ${CATEGORY_BORDER[m.category]}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {m.name}
                    </h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_PILL[m.category]}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  {m.specs && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span className="font-medium text-slate-500 dark:text-slate-500">Спецификация:</span> {m.specs}
                    </div>
                  )}
                  {m.gost && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      <span className="font-medium text-slate-500 dark:text-slate-500">Норматив:</span> {m.gost}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                        {formatPrice(m.priceKzt)} <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">тг/{m.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                        включая НДС, доставка отдельно
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCalcMaterialId(m.id);
                        if (typeof window !== "undefined") {
                          document.getElementById("calc")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                      title="Использовать в калькуляторе"
                    >
                      → Калькулятор
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Калькулятор стоимости */}
        <div
          id="calc"
          className="mt-10 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-900 dark:border-emerald-700 shadow-lg overflow-hidden"
        >
          <div className="bg-emerald-600 dark:bg-emerald-700 px-5 py-3 text-white">
            <h2 className="text-lg font-bold flex items-center gap-2">
              🧮 Калькулятор стоимости материала
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">
              Подставь количество и выбери позицию — получишь итог за пару секунд
            </p>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                Материал
              </label>
              <select
                value={calcMaterialId}
                onChange={(e) => setCalcMaterialId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
                  const items = MATERIALS.filter((m) => m.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <optgroup key={cat} label={`${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}`}>
                      {items.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {formatPrice(m.priceKzt)} тг/{m.unit}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                Количество
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={calcQty}
                onChange={(e) => setCalcQty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                ед.: {calcMaterial.unit}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                Цена за единицу
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                {formatPrice(calcMaterial.priceKzt)} тг/{calcMaterial.unit}
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                onClick={handleCopy}
                className={`w-full px-3 py-2 rounded-lg font-medium border-2 transition-colors ${
                  copyState === "copied"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/60"
                }`}
              >
                {copyState === "copied" ? "✓ Скопировано" : "📋 Скопировать"}
              </button>
            </div>
          </div>

          <div className="mx-5 mb-5 rounded-lg bg-gradient-to-r from-emerald-50 to-amber-50 dark:from-emerald-950/40 dark:to-amber-950/40 border border-emerald-300 dark:border-emerald-800 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
              Итого
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-100">
              {formatPrice(calcQtyNum)} {calcMaterial.unit} × {formatPrice(calcMaterial.priceKzt)} тг ={" "}
              <span className="text-amber-700 dark:text-amber-300">
                {formatPrice(Math.round(calcTotal))} тг
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {calcMaterial.name} · цена с НДС, без доставки и НР/СП
            </div>
          </div>
        </div>

        {/* Фактоид */}
        <div className="mt-8 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200">
            <span className="text-2xl shrink-0">💡</span>
            <p>
              Реальные цены ежеквартально публикуются в <span className="font-semibold">ССЦ РК</span>{" "}
              (Сборник сметных цен) — для коммерческих смет используй последнюю редакцию через{" "}
              <span className="font-semibold">ИСТ Эталон РК</span>.
            </p>
          </div>
        </div>

        {/* Footer space */}
        <div className="h-12" />
      </div>
    </div>
  );
}
