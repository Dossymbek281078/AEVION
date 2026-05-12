"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadDrawingsProgress } from "../../lib/useDrawingsProgress";

type Category = "theory" | "earth" | "structure" | "finishing" | "utilities" | "special" | "process" | "practice" | "tools";

interface Module {
  id: string;
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  level: "L2" | "L3" | "L4" | "L5";
  exercises: number;
  color: string;
  category: Category;
}

const MODULES: Module[] = [
  // ── Теория и справочники ──
  { id: "normatives",     category: "theory",   href: "/smeta-trainer/drawings-practice/normatives",     icon: "📋", title: "Нормативная база",                  subtitle: "СНиП РК, ЭСН РК, грунты, откосы, Кр, ширина траншей",       level: "L2", exercises: 2,  color: "slate"   },
  { id: "rate-selector",  category: "theory",   href: "/smeta-trainer/drawings-practice/rate-selector",  icon: "🎯", title: "Задачник: выбери расценку ЭСН",     subtitle: "10 задач — земля, бетон, кладка, кровля, отделка, дороги",  level: "L3", exercises: 10, color: "slate"   },

  // ── Земляные работы ──
  { id: "excavation",     category: "earth",    href: "/smeta-trainer/drawings-practice/excavation",     icon: "🔶", title: "Котлован",                          subtitle: "Объём земляных работ с откосами",                            level: "L2", exercises: 4,  color: "amber"   },
  { id: "trenches",       category: "earth",    href: "/smeta-trainer/drawings-practice/trenches",       icon: "🔗", title: "Траншеи под сети",                  subtitle: "Нормативная ширина, объём, подушка, ручная засыпка",         level: "L3", exercises: 4,  color: "teal"    },

  // ── Конструктив ──
  { id: "foundation",     category: "structure",href: "/smeta-trainer/drawings-practice/foundation",     icon: "🏗", title: "Фундаменты",                        subtitle: "Ленточный ж/б: тело, подошва, г/и",                          level: "L3", exercises: 3,  color: "slate"   },
  { id: "walls",          category: "structure",href: "/smeta-trainer/drawings-practice/walls",          icon: "🧱", title: "Стены",                             subtitle: "Кладка кирпич/газобетон, объём и площадь",                   level: "L2", exercises: 4,  color: "orange"  },
  { id: "slabs",          category: "structure",href: "/smeta-trainer/drawings-practice/slabs",          icon: "🔲", title: "Перекрытия",                        subtitle: "Монолит и пустотные плиты, опалубка",                        level: "L3", exercises: 3,  color: "slate"   },
  { id: "stairs",         category: "structure",href: "/smeta-trainer/drawings-practice/stairs",         icon: "🪜", title: "Лестницы",                          subtitle: "Ступени, марши, площадки, отделка",                          level: "L3", exercises: 3,  color: "violet"  },
  { id: "roof-flat",      category: "structure",href: "/smeta-trainer/drawings-practice/roof-flat",      icon: "🏠", title: "Кровля",                            subtitle: "Плоская + скатная с уклоном",                                level: "L4", exercises: 4,  color: "blue"    },

  // ── Отделка и фасады ──
  { id: "windows-doors",  category: "finishing",href: "/smeta-trainer/drawings-practice/windows-doors",  icon: "🪟", title: "Окна и двери",                      subtitle: "Количество, откосы, монтаж",                                  level: "L2", exercises: 3,  color: "sky"     },
  { id: "finishing",      category: "finishing",href: "/smeta-trainer/drawings-practice/finishing",      icon: "🎨", title: "Отделка",                           subtitle: "Плитка, штукатурка, окраска по помещениям",                  level: "L2", exercises: 5,  color: "emerald" },
  { id: "facade-svtk",    category: "finishing",href: "/smeta-trainer/drawings-practice/facade-svtk",    icon: "🏢", title: "Фасады — СФТК и НВФ",               subtitle: "Композитные системы и навесные вентилируемые фасады",        level: "L4", exercises: 4,  color: "violet"  },

  // ── Инженерные сети ──
  { id: "sewage",         category: "utilities",href: "/smeta-trainer/drawings-practice/sewage",         icon: "🚰", title: "Канализация — наружные сети",       subtitle: "Самотечная Ø200, уклон 8‰, колодцы КК-1000",                 level: "L3", exercises: 3,  color: "blue"    },
  { id: "water",          category: "utilities",href: "/smeta-trainer/drawings-practice/water",          icon: "💧", title: "Водоснабжение",                     subtitle: "ПЭ100 SDR17 Ø160, водомерный колодец ВК",                    level: "L3", exercises: 4,  color: "sky"     },
  { id: "heating",        category: "utilities",href: "/smeta-trainer/drawings-practice/heating",        icon: "♨️", title: "Тепловые сети",                     subtitle: "Двухтрубная Ø108, изоляция минвата 60 мм, опоры",            level: "L4", exercises: 4,  color: "orange"  },
  { id: "gas",            category: "utilities",href: "/smeta-trainer/drawings-practice/gas",            icon: "🔥", title: "Газоснабжение",                     subtitle: "ПЭ Ø110 низкого давления, футляры на пересечениях",          level: "L4", exercises: 3,  color: "amber"   },
  { id: "cables",         category: "utilities",href: "/smeta-trainer/drawings-practice/cables",         icon: "⚡", title: "Кабельные трассы",                  subtitle: "Силовые до 1 кВ, песчаная постель, защита кирпичом",         level: "L3", exercises: 4,  color: "violet"  },
  { id: "ventilation",    category: "utilities",href: "/smeta-trainer/drawings-practice/ventilation",    icon: "🌬", title: "Вентиляция",                        subtitle: "Воздуховоды 800×500, изоляция, расчёт площадей",             level: "L3", exercises: 4,  color: "emerald" },
  { id: "utilities",      category: "utilities",href: "/smeta-trainer/drawings-practice/utilities",      icon: "🔧", title: "Инженерные системы (внутр.)",       subtitle: "Трубопроводы, изоляция, воздуховоды внутри здания",          level: "L4", exercises: 3,  color: "purple"  },

  // ── Спец. работы ──
  { id: "roads",          category: "special",  href: "/smeta-trainer/drawings-practice/roads",          icon: "🛣", title: "Дороги и благоустройство",          subtitle: "А/б покрытие, бордюры, тротуары, дорожная одежда",           level: "L3", exercises: 4,  color: "slate"   },
  { id: "landscape",      category: "special",  href: "/smeta-trainer/drawings-practice/landscape",      icon: "🌳", title: "Озеленение и МАФ",                  subtitle: "Газоны, посадка деревьев, малые архитектурные формы",         level: "L3", exercises: 4,  color: "emerald" },
  { id: "demolition",     category: "special",  href: "/smeta-trainer/drawings-practice/demolition",     icon: "🔨", title: "Демонтаж",                          subtitle: "ЭСН Сб.46, утилизация, вторсырьё, экология",                 level: "L3", exercises: 3,  color: "amber"   },
  { id: "reconstruction", category: "special",  href: "/smeta-trainer/drawings-practice/reconstruction", icon: "🔄", title: "Реконструкция",                     subtitle: "Отличия от нового стр-ва, коэффициенты МДС 81-35",            level: "L4", exercises: 4,  color: "purple"  },

  // ── Производство работ ──
  { id: "inspections",    category: "process",  href: "/smeta-trainer/drawings-practice/inspections",    icon: "✅", title: "Приёмка работ",                     subtitle: "АОСР, КС-2/КС-3, исполнительная документация",               level: "L4", exercises: 0,  color: "indigo"  },
  { id: "safety",         category: "process",  href: "/smeta-trainer/drawings-practice/safety",         icon: "🦺", title: "Охрана труда",                      subtitle: "Расценки, ППР, ограждения, СИЗ — 0.4-1% от ФОТ",             level: "L3", exercises: 3,  color: "orange"  },
  { id: "winter",         category: "process",  href: "/smeta-trainer/drawings-practice/winter",         icon: "❄️", title: "Зимние работы",                     subtitle: "Кз 1.10-1.60, прогрев бетона, противоморозные добавки",      level: "L4", exercises: 3,  color: "blue"    },

  // ── Практика ──
  { id: "self-study",     category: "practice", href: "/smeta-trainer/drawings-practice/self-study",     icon: "📝", title: "Самостоятельная работа",            subtitle: "3 задания: составь ВОР по нормативам",                       level: "L4", exercises: 3,  color: "teal"    },
  { id: "advanced",       category: "practice", href: "/smeta-trainer/drawings-practice/advanced",       icon: "📐", title: "Сложные объёмы",                    subtitle: "Кровля с уклоном, фасад, лестничный марш",                   level: "L4", exercises: 3,  color: "indigo"  },
  { id: "errors",         category: "practice", href: "/smeta-trainer/drawings-practice/errors",         icon: "🔍", title: "Найди ошибку в ВОР",                subtitle: "3 сценария с неверными расчётами",                            level: "L5", exercises: 3,  color: "red"     },
  { id: "case-school47",  category: "practice", href: "/smeta-trainer/drawings-practice/case-school47",  icon: "🎓", title: "КЕЙС: Школа №47",                   subtitle: "Сквозной кейс — пристройка 600 м², 8 этапов от котлована",   level: "L5", exercises: 8,  color: "amber"   },

  // ── Инструменты (применяются после подсчёта объёмов) ──
  { id: "cost-engine",    category: "tools",    href: "/smeta-trainer/drawings-practice/cost-engine",    icon: "💰", title: "Калькулятор стоимости",             subtitle: "ЭСН × Кр × Кз × индекс ССЦ + НР + СП = итог в тг",            level: "L3", exercises: 0,  color: "emerald" },
  { id: "forms-acts",     category: "tools",    href: "/smeta-trainer/drawings-practice/forms-acts",     icon: "📑", title: "Формы КС-2, КС-3, Ф-3",             subtitle: "Заполняемые формы с готовой к печати версией",               level: "L3", exercises: 0,  color: "blue"    },
  { id: "pos-ppr",        category: "process",  href: "/smeta-trainer/drawings-practice/pos-ppr",        icon: "📋", title: "ПОС и ППР",                         subtitle: "Проект организации стр-ва и производства работ — состав",     level: "L4", exercises: 0,  color: "indigo"  },

  // ── Тестирование и справочники ──
  { id: "quiz",           category: "practice", href: "/smeta-trainer/drawings-practice/quiz",           icon: "🎯", title: "Адаптивный квиз",                   subtitle: "40+ вопросов из всех разделов, тайминг, оценка",              level: "L4", exercises: 40, color: "amber"   },
  { id: "glossary",       category: "tools",    href: "/smeta-trainer/drawings-practice/glossary",       icon: "📖", title: "Глоссарий терминов",                subtitle: "80+ терминов сметного дела РК с поиском",                     level: "L2", exercises: 0,  color: "slate"   },
  { id: "materials",      category: "tools",    href: "/smeta-trainer/drawings-practice/materials",      icon: "💼", title: "Цены на материалы",                 subtitle: "60+ позиций ССЦ РК 8.04-08-2025 с калькулятором",            level: "L3", exercises: 0,  color: "emerald" },

  // ── Сметная база — труд, машины, транспорт ──
  { id: "labor-norms",    category: "tools",    href: "/smeta-trainer/drawings-practice/labor-norms",    icon: "👷", title: "Нормы труда",                       subtitle: "ЕНиР РК, выработка по видам работ, тарифы по разрядам",       level: "L3", exercises: 4,  color: "blue"    },
  { id: "equipment",      category: "tools",    href: "/smeta-trainer/drawings-practice/equipment",      icon: "🚜", title: "Эксплуатация машин",                subtitle: "Маш-час 25+ типовых машин, КИВ, расход ГСМ",                  level: "L3", exercises: 4,  color: "orange"  },
  { id: "transport",      category: "tools",    href: "/smeta-trainer/drawings-practice/transport",      icon: "🚛", title: "Транспортные расходы",              subtitle: "8 групп материалов, тарифы ТС, доставка по Алматы",          level: "L3", exercises: 4,  color: "amber"   },

  // ── Расширенная практика и аналитика ──
  { id: "case-house",     category: "practice", href: "/smeta-trainer/drawings-practice/case-house",     icon: "🏘", title: "КЕЙС: 9-этажный жилой дом",         subtitle: "Капстоун №2 — 2300 м², 8 этапов от паркинга до отделки",      level: "L5", exercises: 8,  color: "purple"  },
  { id: "individual-rates",category: "tools",   href: "/smeta-trainer/drawings-practice/individual-rates",icon: "📝", title: "Индивидуальные расценки",          subtitle: "Когда ЭСН не подходит — методика составления и согласования", level: "L4", exercises: 3,  color: "sky"     },
  { id: "index-history",  category: "tools",    href: "/smeta-trainer/drawings-practice/index-history",  icon: "📈", title: "Динамика индексов 2001-2025",       subtitle: "23 года истории, 16 регионов, 15 видов работ",                level: "L3", exercises: 3,  color: "red"     },

  // ── Финальная подборка — лучшие практики и проверка ──
  { id: "best-practices", category: "process",  href: "/smeta-trainer/drawings-practice/best-practices", icon: "⚡", title: "Лучшие практики и ошибки",          subtitle: "22 типовые ошибки сметчиков из реальной практики РК",         level: "L4", exercises: 0,  color: "red"     },
  { id: "case-pool",      category: "practice", href: "/smeta-trainer/drawings-practice/case-pool",      icon: "🏊", title: "КЕЙС: Крытый бассейн",              subtitle: "Капстоун №3 — 25×12 м, гидроизоляция, спец. отделка",         level: "L5", exercises: 8,  color: "sky"     },
  { id: "checklists",     category: "process",  href: "/smeta-trainer/drawings-practice/checklists",     icon: "📋", title: "Чек-листы приёмки",                 subtitle: "12 чек-листов от котлована до кровли с печатью акта",         level: "L3", exercises: 0,  color: "emerald" },

  // ── Сводные инструменты студента ──
  { id: "dashboard",      category: "tools",    href: "/smeta-trainer/drawings-practice/dashboard",      icon: "📊", title: "Дашборд прогресса",                 subtitle: "Статус всех 45 модулей + достижения + рекомендации",          level: "L2", exercises: 0,  color: "indigo"  },
  { id: "cheatsheet",     category: "tools",    href: "/smeta-trainer/drawings-practice/cheatsheet",     icon: "📜", title: "Шпаргалка-плакат",                  subtitle: "Все формулы, коэф-ты, расценки на одной странице — print",    level: "L2", exercises: 0,  color: "amber"   },
  { id: "timeline",       category: "tools",    href: "/smeta-trainer/drawings-practice/timeline",       icon: "📅", title: "Гантт-планировщик",                 subtitle: "График строительства с шаблонами школа/жилой/бассейн",        level: "L3", exercises: 0,  color: "blue"    },

  // ── Управление проектами ──
  { id: "risk-register",  category: "process",  href: "/smeta-trainer/drawings-practice/risk-register",  icon: "🎲", title: "Реестр рисков",                     subtitle: "25 типовых рисков, матрица вероятность×влияние, резерв",      level: "L4", exercises: 0,  color: "orange"  },
  { id: "bim-intro",      category: "tools",    href: "/smeta-trainer/drawings-practice/bim-intro",      icon: "🏗", title: "BIM для сметчика",                  subtitle: "LOD, 5D-моделирование, экспорт ВОР из Revit/ArchiCAD",        level: "L4", exercises: 4,  color: "violet"  },
  { id: "bidding",        category: "process",  href: "/smeta-trainer/drawings-practice/bidding",        icon: "🏆", title: "Тендеры и госзакупки РК",           subtitle: "zakup.sk.kz, конкурсная заявка, демпинг, лицензии СМР",       level: "L4", exercises: 4,  color: "emerald" },

  // ── Обязательные разделы общественных зданий ──
  { id: "accessibility",  category: "structure",href: "/smeta-trainer/drawings-practice/accessibility",  icon: "♿", title: "Доступная среда",                   subtitle: "Пандусы, поручни, тактильные плитки по СНиП РК 3.06-09",     level: "L3", exercises: 4,  color: "sky"     },
  { id: "elevators",      category: "structure",href: "/smeta-trainer/drawings-practice/elevators",      icon: "🛗", title: "Лифты и подъёмники",                subtitle: "12 типов, монтаж, шахта, эксплуатация — глава 3 Ф-3",         level: "L4", exercises: 4,  color: "slate"   },
  { id: "fire-safety",    category: "process",  href: "/smeta-trainer/drawings-practice/fire-safety",    icon: "🔥", title: "Пожарная безопасность",             subtitle: "АПС, СОУЭ, ВПВ, огнезащита по СНиП РК 2.02-05",              level: "L4", exercises: 4,  color: "red"     },

  // ── Контроль и инженерное сопровождение ──
  { id: "survey",         category: "process",  href: "/smeta-trainer/drawings-practice/survey",         icon: "📐", title: "Геодезические работы",              subtitle: "Разбивка, нивелирование, исполнительные схемы по СНиП РК 1.02-08", level: "L3", exercises: 4,  color: "indigo"  },
  { id: "weld-control",   category: "process",  href: "/smeta-trainer/drawings-practice/weld-control",   icon: "🔥", title: "Контроль сварных соединений",       subtitle: "УЗК, рентген, цветной по ГОСТ 14782, СНиП РК 5.04-23",       level: "L4", exercises: 4,  color: "slate"   },
  { id: "environmental",  category: "process",  href: "/smeta-trainer/drawings-practice/environmental",  icon: "🌍", title: "Экология строительства",            subtitle: "Эко-сборы, отходы, лимиты по ЭК РК и ПП РК № 595",            level: "L3", exercises: 4,  color: "emerald" },

  // ── Дополнительные конструктивы и системы ──
  { id: "pile-foundations",category: "structure",href: "/smeta-trainer/drawings-practice/pile-foundations",icon: "🔩", title: "Свайные фундаменты",                subtitle: "Забивные, буронабивные, винтовые по СП РК 5.04-101",          level: "L4", exercises: 4,  color: "slate"   },
  { id: "scaffolding",    category: "process",  href: "/smeta-trainer/drawings-practice/scaffolding",    icon: "🪜", title: "Строительные леса",                 subtitle: "8 типов, расчёт площади, аренда, ГОСТ Р 52086-2003",         level: "L3", exercises: 4,  color: "amber"   },
  { id: "low-voltage",    category: "utilities",href: "/smeta-trainer/drawings-practice/low-voltage",    icon: "📡", title: "Слаботочные сети",                  subtitle: "СКС, IP-видео, СКУД, домофоны по ЭСН Сб.34",                  level: "L3", exercises: 4,  color: "indigo"  },

  // ── Конструкции и оборудование ──
  { id: "steel-structures",category: "structure",href: "/smeta-trainer/drawings-practice/steel-structures",icon: "🏗", title: "Стальные конструкции",              subtitle: "Балки, колонны, фермы по СНиП РК 5.04-23, ЭСН Сб.9",          level: "L4", exercises: 4,  color: "slate"   },
  { id: "thermal-calc",   category: "tools",    href: "/smeta-trainer/drawings-practice/thermal-calc",   icon: "🌡", title: "Теплотехнический расчёт",           subtitle: "R сопротивление, толщина утеплителя по СП РК 2.04-104",       level: "L4", exercises: 4,  color: "blue"    },
  { id: "equipment-mounting",category: "structure",href: "/smeta-trainer/drawings-practice/equipment-mounting",icon: "🔧", title: "Монтаж оборудования",               subtitle: "Котлы, насосы, вентиляция, ПНР — ЭСН Сб.36-41",                level: "L4", exercises: 4,  color: "orange"  },

  // ── Дополнительные ограждающие конструкции и каталог ──
  { id: "sound-insulation",category: "structure",href: "/smeta-trainer/drawings-practice/sound-insulation",icon: "🔇", title: "Звукоизоляция",                     subtitle: "Rw для стен/перекрытий/окон по СН РК 4.04-22",                level: "L3", exercises: 4,  color: "violet"  },
  { id: "wood-structures",category: "structure",href: "/smeta-trainer/drawings-practice/wood-structures",icon: "🪵", title: "Деревянные конструкции",            subtitle: "Балки, стропила, защита по СНиП РК 5.04-23, ЭСН Сб.10",       level: "L3", exercises: 4,  color: "amber"   },
  { id: "esn-catalog",    category: "theory",   href: "/smeta-trainer/drawings-practice/esn-catalog",    icon: "📚", title: "Каталог 47 сборников ЭСН РК",       subtitle: "Полный список с описанием, поиск и связи с модулями",          level: "L2", exercises: 0,  color: "slate"   },
];

const CATEGORIES: { id: Category; icon: string; title: string; description: string }[] = [
  { id: "theory",    icon: "📚", title: "Теория и справочники", description: "Нормативная база и задачники по расценкам" },
  { id: "earth",     icon: "⛏",  title: "Земляные работы",      description: "Котлованы, траншеи, объёмы по СНиП РК" },
  { id: "structure", icon: "🏛", title: "Конструктив",          description: "Фундаменты, стены, перекрытия, кровля" },
  { id: "finishing", icon: "🖌", title: "Отделка и фасады",     description: "Внутренняя и фасадные системы" },
  { id: "utilities", icon: "🔌", title: "Инженерные сети",      description: "Канализация, вода, тепло, газ, кабель, вентиляция" },
  { id: "special",   icon: "🛠", title: "Специальные работы",   description: "Дороги, благоустройство, демонтаж, реконструкция" },
  { id: "process",   icon: "📋", title: "Производство работ",   description: "Приёмка, охрана труда, зимние удорожания, ПОС/ППР" },
  { id: "practice",  icon: "🎯", title: "Практика и кейсы",     description: "Самостоятельные задания и капстоун-проекты" },
  { id: "tools",     icon: "🧰", title: "Инструменты сметчика", description: "Калькуляторы и генераторы форм" },
];

const LEVEL_COLORS: Record<string, string> = {
  L2: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  L3: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  L4: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  L5: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const MODULE_COLORS: Record<string, string> = {
  amber:   "border-amber-200 hover:border-amber-400",
  slate:   "border-slate-200 hover:border-slate-400",
  orange:  "border-orange-200 hover:border-orange-400",
  blue:    "border-blue-200 hover:border-blue-400",
  sky:     "border-sky-200 hover:border-sky-400",
  violet:  "border-violet-200 hover:border-violet-400",
  emerald: "border-emerald-200 hover:border-emerald-400",
  purple:  "border-purple-200 hover:border-purple-400",
  indigo:  "border-indigo-200 hover:border-indigo-400",
  red:     "border-red-200 hover:border-red-400",
  teal:    "border-teal-200 hover:border-teal-400",
};

export default function DrawingsHub() {
  const [progress, setProgress] = useState({ basicDone: 0, advancedDone: 0, errorsDone: 0 });
  const [filter, setFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const p = loadDrawingsProgress();
    setProgress({ basicDone: p.basicDone, advancedDone: p.advancedDone, errorsDone: p.errorsDone });
  }, []);

  const totalEx = MODULES.reduce((s, m) => s + m.exercises, 0);

  const visibleModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULES.filter(m => {
      if (filter !== "all" && m.category !== filter) return false;
      if (q && !(m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [filter, search]);

  const visibleByCat = useMemo(() => {
    const map: Record<string, Module[]> = {};
    for (const m of visibleModules) {
      if (!map[m.category]) map[m.category] = [];
      map[m.category].push(m);
    }
    return map;
  }, [visibleModules]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📐 Чтение чертежей — все разделы
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {MODULES.length} модулей · {totalEx} упражнений · 8 категорий
            </p>
          </div>
          <input
            type="search"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg w-40"
          />
        </div>
      </header>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 px-6 py-2 text-xs text-indigo-800 dark:text-indigo-300">
        💡 Каждый раздел — интерактивный SVG-чертёж с реальными размерами + упражнения по подсчёту объёмов для ВОР.
        Начни с теории, затем земляные работы → конструктив → инженерные сети → отделка → капстоун-кейс.
      </div>

      {/* Категория-фильтр */}
      <div className="max-w-6xl mx-auto px-6 pt-4 flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
            filter === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
          }`}>
          ✦ Все ({MODULES.length})
        </button>
        {CATEGORIES.map((c) => {
          const cnt = MODULES.filter(m => m.category === c.id).length;
          return (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
                filter === c.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}>
              {c.icon} {c.title} <span className="opacity-60">({cnt})</span>
            </button>
          );
        })}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {visibleModules.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-500">
            Ничего не найдено по запросу «{search}»
          </div>
        )}

        {CATEGORIES.map((c) => {
          const mods = visibleByCat[c.id];
          if (!mods || mods.length === 0) return null;
          return (
            <section key={c.id} className="mb-7">
              <div className="mb-3 flex items-baseline gap-2 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                <span className="text-xl">{c.icon}</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">{c.title}</h2>
                <span className="text-[10px] text-slate-400">— {c.description}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{mods.length} модулей</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mods.map((m) => (
                  <Link
                    key={m.id}
                    href={m.href}
                    className={`bg-white dark:bg-slate-900 border-2 ${MODULE_COLORS[m.color]} rounded-xl p-4 flex gap-3 items-start transition-all hover:shadow-md dark:border-slate-700 dark:hover:border-indigo-500`}
                  >
                    <span className="text-3xl shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.title}</h3>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_COLORS[m.level]}`}>
                          {m.level}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{m.subtitle}</p>
                      <div className="text-[10px] text-slate-400 mt-1">{m.exercises > 0 ? `${m.exercises} упражнений` : "Информационный"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {/* Быстрый доступ */}
        <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
            ✅ Быстрый старт (рекомендуем):
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/smeta-trainer/drawings-practice" className="text-[11px] px-3 py-1.5 bg-emerald-600 text-white rounded-full font-semibold hover:bg-emerald-700">
              📐 Базовый L2 ({progress.basicDone}/5)
            </Link>
            <Link href="/smeta-trainer/drawings-practice/advanced" className="text-[11px] px-3 py-1.5 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700">
              📐 Продвинутый L4 ({progress.advancedDone}/6)
            </Link>
            <Link href="/smeta-trainer/drawings-practice/errors" className="text-[11px] px-3 py-1.5 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700">
              🔍 Найди ошибку ({progress.errorsDone}/3)
            </Link>
            <Link href="/smeta-trainer/drawings-practice/case-school47" className="text-[11px] px-3 py-1.5 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700">
              🎓 Капстоун-кейс
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
