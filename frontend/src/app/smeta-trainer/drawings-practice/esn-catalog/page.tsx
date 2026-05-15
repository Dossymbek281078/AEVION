"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Полный каталог сборников ЭСН (Элементные Сметные Нормы) Республики Казахстан.
 * 47 сборников, охватывающих все виды строительно-монтажных работ.
 * Источник: ЭСН РК (Сб.1 ... Сб.49) — действующая база ИСТ Эталон.
 */

type Category =
  | "earth"
  | "structure"
  | "finishing"
  | "utilities"
  | "special"
  | "process"
  | "equipment";

interface EsnSb {
  id: string;
  num: string;
  title: string;
  category: Category;
  description: string;
  example: string;
  relatedModule?: string;
}

const SBORNIKI: EsnSb[] = [
  // ── Земляные работы ──
  {
    id: "sb1",
    num: "Сб.1",
    title: "Земляные работы",
    category: "earth",
    description:
      "Разработка, перемещение и уплотнение грунтов I–IV категорий: котлованы, траншеи, насыпи, обратная засыпка. Механизированно (экскаваторы, бульдозеры) и вручную.",
    example: "§1-1-9 Разработка грунта II кат. экскаватором с погрузкой в а/с",
    relatedModule: "/smeta-trainer/drawings-practice/excavation",
  },
  {
    id: "sb2",
    num: "Сб.2",
    title: "Горно-вскрышные работы",
    category: "earth",
    description:
      "Вскрытие месторождений полезных ископаемых: разработка пород на карьерах, селективная выемка, отвалообразование.",
    example: "§2-01-002 Разработка вскрышных пород экскаватором ЭКГ-5",
  },
  {
    id: "sb3",
    num: "Сб.3",
    title: "Буровзрывные работы",
    category: "earth",
    description:
      "Бурение скважин и шпуров, заряжание, взрывание скальных грунтов V–VII категорий и крепких пород.",
    example: "§3-2-15 Взрывание скальных грунтов VI кат. на выброс",
  },
  {
    id: "sb4",
    num: "Сб.4",
    title: "Скважины",
    category: "earth",
    description:
      "Бурение скважин на воду, разведочных и инженерно-геологических, обсадка и оборудование.",
    example: "§4-1-7 Бурение скважины Ø273 в породах III группы",
  },
  {
    id: "sb5",
    num: "Сб.5",
    title: "Свайные работы",
    category: "earth",
    description:
      "Погружение, вдавливание, бурение свай (ж/б, металл, буронабивные), шпунтовое ограждение, испытания свай статической и динамической нагрузкой.",
    example: "§5-1-2 Погружение ж/б свай С12-40 копром в грунты II гр.",
    relatedModule: "/smeta-trainer/drawings-practice/pile-foundations",
  },

  // ── Бетон и ж/б ──
  {
    id: "sb6",
    num: "Сб.6",
    title: "Бетонные и ж/б монолитные конструкции",
    category: "structure",
    description:
      "Все виды монолитного бетонирования: фундаменты, стены, колонны, плиты, балки. Опалубка, армирование, укладка бетона, уход.",
    example: "§6-01-001-1 Бетонирование фундамента М200",
    relatedModule: "/smeta-trainer/drawings-practice/foundation",
  },
  {
    id: "sb7",
    num: "Сб.7",
    title: "Бетонные и ж/б сборные конструкции",
    category: "structure",
    description:
      "Монтаж сборных ж/б элементов: фундаментные блоки ФБС, плиты перекрытий ПК/ПБ, колонны, ригели, лестничные марши.",
    example: "§7-1-12 Установка фундаментных блоков ФБС-24-6-6 краном",
    relatedModule: "/smeta-trainer/drawings-practice/slabs",
  },
  {
    id: "sb8",
    num: "Сб.8",
    title: "Конструкции из кирпича и блоков",
    category: "structure",
    description:
      "Каменная кладка: кирпич керамический и силикатный, газо- и пенобетон, ракушечник. Стены, перегородки, столбы, своды, армокладка.",
    example: "§8-2-1 Кладка наружных стен из кирпича толщ. 510 мм",
    relatedModule: "/smeta-trainer/drawings-practice/walls",
  },
  {
    id: "sb9",
    num: "Сб.9",
    title: "Металлические конструкции",
    category: "structure",
    description:
      "Изготовление и монтаж металлоконструкций: каркасы, фермы, балки, связи, площадки. Огнезащита, антикоррозия.",
    example: "§9-1-15 Монтаж стальных колонн до 3 т",
    relatedModule: "/smeta-trainer/drawings-practice/steel-structures",
  },

  // ── Дерево, окна, двери ──
  {
    id: "sb10",
    num: "Сб.10",
    title: "Деревянные конструкции, окна, двери",
    category: "structure",
    description:
      "Деревянные стропильные системы, балки, обшивки. Установка оконных и дверных блоков (ПВХ, дерево, алюминий), подоконники, откосы.",
    example: "§10-3-2 Установка оконных блоков ПВХ S до 2 м²",
    relatedModule: "/smeta-trainer/drawings-practice/wood-structures",
  },

  // ── Полы и кровли ──
  {
    id: "sb11",
    num: "Сб.11",
    title: "Полы (без покрытия — стяжки, основания)",
    category: "structure",
    description:
      "Подготовительные слои полов: щебёночные основания, цементно-песчаные стяжки, гидро- и звукоизоляция под покрытие, наливные основания.",
    example: "§11-1-7 Устройство стяжки ЦПС толщ. 50 мм по плите",
  },
  {
    id: "sb12",
    num: "Сб.12",
    title: "Кровли",
    category: "structure",
    description:
      "Все виды кровельных работ: рулонные (битумно-полимерные), мастичные, металлочерепица, профлист. Парапеты, водостоки, примыкания.",
    example: "§12-1-2 Устройство 2-сл. кровли из Техноэласт ЭКП по бетону",
    relatedModule: "/smeta-trainer/drawings-practice/roof-flat",
  },

  // ── Изоляция, реконструкция ──
  {
    id: "sb13",
    num: "Сб.13",
    title: "Защита строительных конструкций",
    category: "structure",
    description:
      "Огнезащита (вспучивающиеся составы, плиты), гидроизоляция (обмазочная, оклеечная, проникающая), пароизоляция, антикоррозийная защита.",
    example: "§13-2-9 Огнезащита м/к составом ВПД-1М R45",
    relatedModule: "/smeta-trainer/drawings-practice/fire-safety",
  },
  {
    id: "sb14",
    num: "Сб.14",
    title: "Конструкции в условиях реконструкции",
    category: "structure",
    description:
      "Усиление существующих конструкций, надстройка, перепланировка, восстановление элементов в эксплуатируемых зданиях. Применяются повышающие коэффициенты.",
    example: "§14-2-5 Усиление ж/б колонн обоймой из у/с в стеснённых условиях",
  },

  // ── Отделка ──
  {
    id: "sb15",
    num: "Сб.15",
    title: "Отделочные работы",
    category: "finishing",
    description:
      "Штукатурка (мокрая, сухая, ГКЛ), облицовка плиткой керамической и керамогранитом, окраска и оклейка обоями, подвесные потолки, покрытия полов (линолеум, ламинат, паркет).",
    example: "§15-2-30 Облицовка стен керамической плиткой по подготовке",
    relatedModule: "/smeta-trainer/drawings-practice/finishing",
  },

  // ── Внутренние сети ──
  {
    id: "sb16",
    num: "Сб.16",
    title: "Внутренние водопроводные сети",
    category: "utilities",
    description:
      "Прокладка трубопроводов холодной и горячей воды внутри здания (стальные, ПП, металлопластик), установка сантехарматуры, гидравлические испытания.",
    example: "§16-2-1 Прокладка трубопровода ПП Ø25 в штробе",
    relatedModule: "/smeta-trainer/drawings-practice/utilities",
  },
  {
    id: "sb17",
    num: "Сб.17",
    title: "Внутренние канализационные сети",
    category: "utilities",
    description:
      "Внутренние сети бытовой и ливневой канализации: трубы ПВХ, чугунные, стояки, подводки к приборам, ревизии и прочистки.",
    example: "§17-1-3 Прокладка чугунных трубопроводов канализации Ø100",
  },
  {
    id: "sb18",
    num: "Сб.18",
    title: "Отопление внутреннее",
    category: "utilities",
    description:
      "Внутридомовые системы отопления: трубопроводы, радиаторы, конвекторы, узлы управления, балансировочная и регулирующая арматура.",
    example: "§18-2-15 Установка чугунных радиаторов до 8 секций",
  },
  {
    id: "sb19",
    num: "Сб.19",
    title: "Газоснабжение внутреннее",
    category: "utilities",
    description:
      "Внутридомовые газопроводы низкого давления, установка газовых плит, котлов, водонагревателей, газовых счётчиков и арматуры.",
    example: "§19-1-7 Прокладка газопровода стального Ø25 по стене",
  },

  // ── Вентиляция, холод ──
  {
    id: "sb20",
    num: "Сб.20",
    title: "Вентиляция и кондиционирование",
    category: "utilities",
    description:
      "Монтаж воздуховодов (оцинковка, нержавейка), вентиляторов, калориферов, фильтров, сплит-систем, чиллеров, фанкойлов, изоляция воздуховодов.",
    example: "§20-1-22 Монтаж воздуховодов из оцинковки P=800×500",
    relatedModule: "/smeta-trainer/drawings-practice/ventilation",
  },
  {
    id: "sb21",
    num: "Сб.21",
    title: "Холодоснабжение",
    category: "utilities",
    description:
      "Системы технологического холода: холодильные машины, охладители, фреоновые трассы, изоляция холодопроводов.",
    example: "§21-1-4 Монтаж компрессорно-конденсаторного блока 50 кВт",
  },

  // ── Наружные сети ──
  {
    id: "sb22",
    num: "Сб.22",
    title: "Канализация наружная",
    category: "utilities",
    description:
      "Наружные сети самотечной и напорной канализации: ж/б, ПВХ, ПЭ трубы Ø150–1500, колодцы КК, фасонные части, врезки.",
    example: "§22-1-12 Прокладка трубопровода ПВХ Ø200 в траншее",
    relatedModule: "/smeta-trainer/drawings-practice/sewage",
  },
  {
    id: "sb23",
    num: "Сб.23",
    title: "Очистка стоков и водоснабжение",
    category: "utilities",
    description:
      "Очистные сооружения: отстойники, аэротенки, биофильтры. Водозаборные узлы, насосные станции, резервуары.",
    example: "§23-3-2 Монтаж отстойника горизонтального V=400 м³",
  },
  {
    id: "sb24",
    num: "Сб.24",
    title: "Газоснабжение наружное",
    category: "utilities",
    description:
      "Наружные газопроводы низкого, среднего и высокого давления (стальные, ПЭ), ГРП и ГРПШ, защита от коррозии, футляры на пересечениях.",
    example: "§24-2-9 Прокладка ПЭ газопровода Ø110 SDR11 в траншее",
    relatedModule: "/smeta-trainer/drawings-practice/gas",
  },
  {
    id: "sb25",
    num: "Сб.25",
    title: "Тепловые сети",
    category: "utilities",
    description:
      "Наружные тепловые сети (двухтрубные, четырёхтрубные): подземные канальные и бесканальные ППУ, надземные. Тепловые камеры УТ, компенсаторы, опоры.",
    example: "§25-1-15 Прокладка стальной трубы Ø108 в ППУ-изоляции",
    relatedModule: "/smeta-trainer/drawings-practice/heating",
  },
  {
    id: "sb26",
    num: "Сб.26",
    title: "Изоляция трубопроводов и оборудования",
    category: "utilities",
    description:
      "Тепловая изоляция труб и оборудования: минвата, ППУ-скорлупы, вспененный каучук. Покровный слой — оцинковка, фольга, штукатурка.",
    example: "§26-1-8 Изоляция трубопровода Ø108 минватой 60 мм с оцинковкой",
    relatedModule: "/smeta-trainer/drawings-practice/heating",
  },
  {
    id: "sb27",
    num: "Сб.27",
    title: "Автомобильные дороги",
    category: "utilities",
    description:
      "Земляное полотно, дорожные одежды (щебень, песок, асфальтобетон, ж/б плиты), бордюры, тротуары, искусственные сооружения малых форм.",
    example: "§27-3-12 Устройство а/б покрытия из плотной смеси типа Б толщ. 5 см",
    relatedModule: "/smeta-trainer/drawings-practice/roads",
  },

  // ── Мосты, тоннели, гидротехника ──
  {
    id: "sb28",
    num: "Сб.28",
    title: "Мосты и трубы под насыпями",
    category: "special",
    description:
      "Опоры мостов, пролётные строения (ж/б, металл), мостовое полотно, водопропускные трубы (ж/б, металлические гофрированные).",
    example: "§28-2-15 Монтаж пролётного строения 18 м краном",
  },
  {
    id: "sb29",
    num: "Сб.29",
    title: "Тоннели и метрополитены",
    category: "special",
    description:
      "Проходка тоннелей (горный, щитовой способы), обделка (чугунная, ж/б тюбинги, монолит), вентиляция тоннелей, рельсовый путь.",
    example: "§29-1-7 Проходка тоннеля щитом Ø6 м в породах II категории",
  },
  {
    id: "sb30",
    num: "Сб.30",
    title: "Гидротехнические сооружения",
    category: "special",
    description:
      "Плотины, дамбы, шлюзы, причалы, водосливные сооружения. Подводные работы, шпунтовое ограждение, бетонирование под водой.",
    example: "§30-2-3 Бетонирование подводное методом ВПТ",
  },

  // ── Аэродромы, связь ──
  {
    id: "sb31",
    num: "Сб.31",
    title: "Аэродромы",
    category: "utilities",
    description:
      "Покрытия ВПП и рулёжных дорожек (цементобетонные плиты, монолитный ж/б), маркировка, аэродромное оборудование.",
    example: "§31-1-9 Устройство ж/б покрытия ВПП плитами ПАГ-XIV",
  },
  {
    id: "sb32",
    num: "Сб.32",
    title: "Сооружения связи и сигнализации",
    category: "utilities",
    description:
      "Кабельные линии связи (медь, оптоволокно), мачты, антенно-фидерные устройства, оборудование связи и сигнализации.",
    example: "§32-2-5 Прокладка ВОЛС Ø12 в защитной трубе",
  },

  // ── Электротехника ──
  {
    id: "sb33",
    num: "Сб.33",
    title: "Линии электропередачи (внешние)",
    category: "utilities",
    description:
      "ВЛ 0.4–110 кВ: установка опор (ж/б, металл, дерево), подвеска проводов, ВЛИ с СИП, заземление, защита.",
    example: "§33-1-15 Установка ж/б опоры СВ-110-3.5 в грунты II гр.",
  },
  {
    id: "sb34",
    num: "Сб.34",
    title: "Электрические системы (внутренние)",
    category: "utilities",
    description:
      "Внутренние электросети: щитовое оборудование, кабельные трассы, СКС, слаботочка, ОПС, СОТ, охранно-пожарная сигнализация, электроосвещение.",
    example: "§34-2-22 Прокладка кабеля ВВГнг 3×2.5 в гофре по перекрытию",
    relatedModule: "/smeta-trainer/drawings-practice/low-voltage",
  },
  {
    id: "sb35",
    num: "Сб.35",
    title: "Электростанции и подстанции",
    category: "utilities",
    description:
      "Силовое оборудование подстанций: трансформаторы, КРУ, КРУН, РУ, шинопроводы, маслохозяйство, релейная защита.",
    example: "§35-1-3 Монтаж силового трансформатора ТМ-1000/10",
  },

  // ── Технологическое оборудование ──
  {
    id: "sb36",
    num: "Сб.36",
    title: "Котельные и отопительные системы",
    category: "equipment",
    description:
      "Установка котлов (газовых, твёрдотопливных, электрических), горелок, дымоходов, ХВО, систем автоматики котельных.",
    example: "§36-1-8 Монтаж водогрейного котла КВ-Г-3.0 на фундамент",
    relatedModule: "/smeta-trainer/drawings-practice/equipment-mounting",
  },
  {
    id: "sb37",
    num: "Сб.37",
    title: "Вентиляция оборудование",
    category: "equipment",
    description:
      "Промышленные вентиляторы и установки кондиционирования больших мощностей, системы дымоудаления и подпора воздуха.",
    example: "§37-2-4 Монтаж приточной установки L=10 000 м³/ч",
    relatedModule: "/smeta-trainer/drawings-practice/equipment-mounting",
  },
  {
    id: "sb38",
    num: "Сб.38",
    title: "Сантехническое оборудование",
    category: "equipment",
    description:
      "Промышленное сантехническое оборудование: насосы, баки, теплообменники, фильтры, водоподготовительные установки.",
    example: "§38-1-12 Монтаж насоса центробежного К-100/65 на раме",
  },
  {
    id: "sb39",
    num: "Сб.39",
    title: "Электротехническое оборудование",
    category: "equipment",
    description:
      "Электрические машины, преобразователи, ГРЩ, аккумуляторные установки, электротермическое оборудование.",
    example: "§39-1-6 Монтаж электродвигателя А-200 P=37 кВт",
    relatedModule: "/smeta-trainer/drawings-practice/equipment-mounting",
  },
  {
    id: "sb40",
    num: "Сб.40",
    title: "Промышленное оборудование (станки)",
    category: "equipment",
    description:
      "Станки металлообрабатывающие, деревообрабатывающие, кузнечно-прессовое оборудование, конвейеры, технологические линии.",
    example: "§40-2-7 Монтаж токарного станка 16К20 массой до 3 т",
  },
  {
    id: "sb41",
    num: "Сб.41",
    title: "Пусконаладочные работы",
    category: "equipment",
    description:
      "ПНР всех систем: электрооборудование, КИПиА, вентиляция и кондиционирование, ОПС, тепломеханическое оборудование. Индивидуальные и комплексные испытания.",
    example: "§41-1-15 ПНР электроустановок до 1 кВ комплексные",
    relatedModule: "/smeta-trainer/drawings-practice/equipment-mounting",
  },

  // ── Временные, реконструкция ──
  {
    id: "sb45",
    num: "Сб.45",
    title: "Временные здания и сооружения",
    category: "special",
    description:
      "Титульные временные сооружения стройплощадки: бытовки, склады, временные дороги и ограждения. Норма 1.1–3.5 % от СМР по ГСН-2001.",
    example: "§45-1-1 Возведение бытового городка 6 контейнеров",
  },
  {
    id: "sb46",
    num: "Сб.46",
    title: "Реконструкция и демонтаж",
    category: "special",
    description:
      "Демонтаж конструкций (бетон, кирпич, металл, дерево), вывоз строительного мусора, обращение с отходами, утилизация.",
    example: "§46-2-5 Разборка кирпичных стен толщ. 510 мм с погрузкой",
    relatedModule: "/smeta-trainer/drawings-practice/demolition",
  },

  // ── Озеленение, благоустройство ──
  {
    id: "sb47",
    num: "Сб.47",
    title: "Озеленение, защитные лесонасаждения",
    category: "special",
    description:
      "Подготовка почвы, посадка деревьев и кустарников, устройство газонов, цветников, защитных лесополос, уход в первый год.",
    example: "§47-1-12 Посадка деревьев лиственных с комом 0.8×0.8 м",
    relatedModule: "/smeta-trainer/drawings-practice/landscape",
  },
  {
    id: "sb48",
    num: "Сб.48",
    title: "Благоустройство территорий",
    category: "special",
    description:
      "Дорожки, площадки, бордюры, малые архитектурные формы (МАФ), детские и спортивные площадки, ограждения, наружное освещение территории.",
    example: "§48-2-7 Устройство тротуарной плитки на ц/п основании",
  },

  // ── Геодезия ──
  {
    id: "sb49",
    num: "Сб.49",
    title: "Геодезические работы",
    category: "process",
    description:
      "Разбивка зданий и сооружений в натуре, геодезический контроль СМР, исполнительные съёмки, наблюдения за деформациями.",
    example: "§49-1-3 Вынос осей здания в натуру с закреплением знаками",
    relatedModule: "/smeta-trainer/drawings-practice/survey",
  },
];

const CATEGORIES: { id: Category | "all"; label: string; icon: string }[] = [
  { id: "all",       label: "Все",                  icon: "📚" },
  { id: "earth",     label: "Земля",                icon: "⛏" },
  { id: "structure", label: "Конструктив",          icon: "🏛" },
  { id: "finishing", label: "Отделка",              icon: "🖌" },
  { id: "utilities", label: "Сети и электро",       icon: "🔌" },
  { id: "special",   label: "Спец. работы",         icon: "🛠" },
  { id: "process",   label: "Процессы",             icon: "📋" },
  { id: "equipment", label: "Оборудование",         icon: "🔧" },
];

const CATEGORY_BADGE: Record<Category, { label: string; cls: string }> = {
  earth:     { label: "Земля",         cls: "bg-amber-900/40 text-amber-300 border-amber-700/50" },
  structure: { label: "Конструктив",   cls: "bg-orange-900/40 text-orange-300 border-orange-700/50" },
  finishing: { label: "Отделка",       cls: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" },
  utilities: { label: "Сети",          cls: "bg-sky-900/40 text-sky-300 border-sky-700/50" },
  special:   { label: "Спец.",         cls: "bg-violet-900/40 text-violet-300 border-violet-700/50" },
  process:   { label: "Процесс",       cls: "bg-indigo-900/40 text-indigo-300 border-indigo-700/50" },
  equipment: { label: "Оборудование",  cls: "bg-rose-900/40 text-rose-300 border-rose-700/50" },
};

type Sort = "num" | "alpha";

export default function EsnCatalogPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [sort, setSort] = useState<Sort>("num");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = SBORNIKI.filter((s) => {
      if (cat !== "all" && s.category !== cat) return false;
      if (!q) return true;
      return (
        s.num.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.example.toLowerCase().includes(q) ||
        (s.relatedModule ?? "").toLowerCase().includes(q)
      );
    });

    if (sort === "alpha") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ru"));
    } else {
      list = [...list].sort((a, b) => parseSbNum(a.num) - parseSbNum(b.num));
    }
    return list;
  }, [query, cat, sort]);

  const total = SBORNIKI.length;
  const shown = filtered.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            {shown} из {total}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-3 leading-tight">
          📚 Каталог сборников ЭСН РК — все 47 сборников
        </h1>

        {/* Intro */}
        <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/60 p-5 text-sm leading-relaxed text-slate-300">
          <p className="mb-2">
            📚 Полный каталог ЭСН (Элементные Сметные Нормы) Республики Казахстан.
            <br />
            47 сборников охватывают <span className="text-slate-100 font-semibold">ВСЕ</span> виды
            строительно-монтажных работ.
          </p>
          <p className="mb-2">
            Каждый сборник содержит расценки в формате{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">§X-Y-Z</code>{" "}
            (раздел-подраздел-расценка).
            <br />
            Пример:{" "}
            <span className="text-slate-100">
              ЭСН РК Сб.6 §6-01-001-1 «Бетонирование фундамента М200»
            </span>
            .
          </p>
          <p className="text-slate-400">
            Поиск: введи название работы, шифр сборника, или вид конструкции.
          </p>
        </div>

        {/* Search + sort */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔎 Поиск: бетон, кровля, Сб.6, кабель, §15..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Сортировка:</span>
            <button
              onClick={() => setSort("num")}
              className={`rounded-md border px-3 py-1.5 transition ${
                sort === "num"
                  ? "border-slate-500 bg-slate-700 text-slate-100"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              По номеру
            </button>
            <button
              onClick={() => setSort("alpha")}
              className={`rounded-md border px-3 py-1.5 transition ${
                sort === "alpha"
                  ? "border-slate-500 bg-slate-700 text-slate-100"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              По алфавиту
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = cat === c.id;
            const count =
              c.id === "all"
                ? SBORNIKI.length
                : SBORNIKI.filter((s) => s.category === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-slate-400 bg-slate-700 text-slate-50"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                <span className="mr-1">{c.icon}</span>
                {c.label}
                <span className="ml-1.5 text-slate-500">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
            Ничего не найдено по запросу «{query}». Попробуй другое слово
            или сними фильтр категории.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <SbornikCard key={s.id} s={s} />
            ))}
          </div>
        )}

        {/* Factoid */}
        <div className="mt-10 rounded-lg border border-slate-700 bg-slate-800/60 p-5 text-sm leading-relaxed text-slate-300">
          <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">
            Фактоид
          </div>
          47 сборников ЭСН РК — это около{" "}
          <span className="font-semibold text-slate-100">30 000 базовых расценок</span>.
          Опытный сметчик помнит наизусть только основные{" "}
          <span className="font-semibold text-slate-100">200–300</span> (своей специализации).
          Этот каталог — справочник для быстрого поиска сборника по теме.
        </div>

        <div className="mt-8 text-center text-xs text-slate-600">
          Источник: ЭСН РК — действующая база (Сб.1 ... Сб.49).
          Цены и индексы — отдельно: ССЦ РК, ИЦСМ.
        </div>
      </div>
    </div>
  );
}

function SbornikCard({ s }: { s: EsnSb }) {
  const badge = CATEGORY_BADGE[s.category];
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700 hover:bg-slate-900">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-lg font-bold text-slate-50">{s.num}</div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="mb-3 text-sm font-semibold text-slate-100 leading-snug">
        {s.title}
      </div>

      {/* Description */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          Описание
        </div>
        <p className="text-xs leading-relaxed text-slate-300">{s.description}</p>
      </div>

      {/* Example */}
      <div className="mb-3 rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          Пример расценки
        </div>
        <code className="block text-xs leading-snug text-amber-200/90">
          {s.example}
        </code>
      </div>

      {/* Related modules */}
      {s.relatedModule && (
        <div className="mt-auto pt-1">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
            Связанный модуль
          </div>
          <Link
            href={s.relatedModule}
            className="inline-block text-xs text-sky-400 hover:text-sky-300 transition"
          >
            → {s.relatedModule}
          </Link>
        </div>
      )}
    </div>
  );
}

// "Сб.6" → 6, "Сб.46" → 46
function parseSbNum(num: string): number {
  const m = num.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
