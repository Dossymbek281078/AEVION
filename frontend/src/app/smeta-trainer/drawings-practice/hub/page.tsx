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
  { id: "case-cottage",   category: "practice", href: "/smeta-trainer/drawings-practice/case-cottage",   icon: "🏡", title: "КЕЙС: Коттедж 240 м²",              subtitle: "Капстоун №4 — 2 эт., газоблок Ytong, 31.4 млн тг",            level: "L5", exercises: 4,  color: "amber"   },
  { id: "case-cafe",      category: "practice", href: "/smeta-trainer/drawings-practice/case-cafe",      icon: "☕", title: "КЕЙС: Кафе 50 мест",                subtitle: "Капстоун №5 — 140 м², кухня+вытяжка+АПС, 21.3 млн тг",        level: "L5", exercises: 4,  color: "rose"    },
  { id: "case-carwash",   category: "practice", href: "/smeta-trainer/drawings-practice/case-carwash",   icon: "🚗", title: "КЕЙС: Автомойка 4 поста",           subtitle: "Капстоун №6 — самообсл., очистные KESSEL, 32.4 млн тг",       level: "L5", exercises: 4,  color: "cyan"    },

  // ── Бизнес-процессы сметчика ──
  { id: "customer-negotiations", category: "process",  href: "/smeta-trainer/drawings-practice/customer-negotiations", icon: "🤝", title: "Переговоры с заказчиком",          subtitle: "Защита сметы, 6 возражений, скрипты, ДОЦ",                    level: "L4", exercises: 4,  color: "violet"  },
  { id: "contractor-claims",     category: "process",  href: "/smeta-trainer/drawings-practice/contractor-claims",     icon: "🔍", title: "Проверка КС-2/КС-3",                subtitle: "8 нарушений подрядчика, контр. обмер, претензии",             level: "L4", exercises: 4,  color: "red"     },
  { id: "government-tender",     category: "process",  href: "/smeta-trainer/drawings-practice/government-tender",     icon: "🏛️", title: "Госзакупки и тендеры",              subtitle: "ZRK о госзакуп., обеспечение, аукцион, 12 документов",         level: "L4", exercises: 4,  color: "blue"    },

  // ── Дизайн и ландшафт ──
  { id: "landscape-detailed",    category: "special",  href: "/smeta-trainer/drawings-practice/landscape-detailed",    icon: "🌳", title: "Ландшафт детально",                subtitle: "Газоны, деревья, ирригация Hunter, LED-освещение",            level: "L3", exercises: 4,  color: "emerald" },
  { id: "interior-design",       category: "special",  href: "/smeta-trainer/drawings-practice/interior-design",       icon: "🎨", title: "Дизайн интерьера",                 subtitle: "Этапы, наценки, спецификация, авторский надзор",              level: "L3", exercises: 4,  color: "purple"  },
  { id: "winter-garden",         category: "special",  href: "/smeta-trainer/drawings-practice/winter-garden",         icon: "🌿", title: "Зимний сад и фитодизайн",          subtitle: "Алюминий+стеклопакеты, климат, фитолампы, уход",              level: "L3", exercises: 4,  color: "lime"    },

  // ── Финансы строителя ──
  { id: "construction-taxes",        category: "process",  href: "/smeta-trainer/drawings-practice/construction-taxes",        icon: "💰", title: "Налоги строителя РК",            subtitle: "КПН/ИПН/НДС/соц., упрощёнка/патент, штрафы",                  level: "L3", exercises: 4,  color: "emerald" },
  { id: "accounting-projects",       category: "process",  href: "/smeta-trainer/drawings-practice/accounting-projects",       icon: "📊", title: "Бухучёт по объектам",            subtitle: "Поэтапная готовность, счета 8010-8021, СБУ-7 РК",            level: "L4", exercises: 4,  color: "blue"    },
  { id: "bank-guarantees-insurance", category: "process",  href: "/smeta-trainer/drawings-practice/bank-guarantees-insurance", icon: "🏦", title: "БГ и страхование СМР",            subtitle: "1%/3%/5% БГ, страх.СМР+ответств., тарифы банков РК",         level: "L4", exercises: 4,  color: "amber"   },

  // ── Профессионализм сметчика ──
  { id: "bim-modeling",          category: "tools",    href: "/smeta-trainer/drawings-practice/bim-modeling",          icon: "🏗️", title: "BIM — Revit/ArchiCAD",            subtitle: "LOD 100-500, 5 ПО, плагины ЭСН РК, обязат. с 2025",          level: "L4", exercises: 4,  color: "indigo"  },
  { id: "expertise-docs",        category: "process",  href: "/smeta-trainer/drawings-practice/expertise-docs",        icon: "🔬", title: "Экспертиза проекта",              subtitle: "ГосЭкспертиза vs негос., 5 этапов, 30 дней замечания",        level: "L4", exercises: 4,  color: "purple"  },
  { id: "author-supervision",    category: "process",  href: "/smeta-trainer/drawings-practice/author-supervision",    icon: "👁️", title: "Авторский+тех. надзор",           subtitle: "АН раз/нед., ТН ежедн., журналы КС-6, АОСР",                  level: "L3", exercises: 4,  color: "teal"    },

  // ── Международные стандарты ──
  { id: "fidic-contracts",         category: "process",  href: "/smeta-trainer/drawings-practice/fidic-contracts",         icon: "📜", title: "FIDIC — R/Y/S Book",              subtitle: "Контракты ЕБРР/МБРР/АБР, Engineer, DAB, 21 день",            level: "L5", exercises: 4,  color: "red"     },
  { id: "evms-earned-value",       category: "process",  href: "/smeta-trainer/drawings-practice/evms-earned-value",       icon: "📈", title: "EVMS — освоенный объём",          subtitle: "PV/EV/AC, CPI/SPI, отчётность ЕБРР+JICA по PMBOK",            level: "L5", exercises: 4,  color: "blue"    },
  { id: "international-standards", category: "theory",   href: "/smeta-trainer/drawings-practice/international-standards", icon: "🌍", title: "NRM2/RICS/RSMeans/ISO",           subtitle: "AACE Class 1-5, межд. стандарты сметы vs ЭСН РК",            level: "L5", exercises: 4,  color: "violet"  },
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

  // ── Финальный батч — детали и справочник ──
  { id: "asphalt-detailed",category: "special",href: "/smeta-trainer/drawings-practice/asphalt-detailed",icon: "🛣", title: "Асфальтобетон детально",            subtitle: "Типы А/Б/В/ЩМА, расход битума, цены 2025 ГОСТ 9128",          level: "L3", exercises: 4,  color: "slate"   },
  { id: "water-treatment",category: "utilities",href: "/smeta-trainer/drawings-practice/water-treatment",icon: "🌊", title: "Очистные сооружения",               subtitle: "Септики до 1500 чел, биоочистка, УФ по СНиП РК 4.01-03",      level: "L4", exercises: 4,  color: "sky"     },
  { id: "faq",            category: "tools",    href: "/smeta-trainer/drawings-practice/faq",            icon: "❓", title: "FAQ — частые вопросы",              subtitle: "50+ вопросов с ответами по 7 категориям",                     level: "L2", exercises: 0,  color: "indigo"  },

  // ── Внутренние инженерные сети ──
  { id: "heating-internal",category: "utilities",href: "/smeta-trainer/drawings-practice/heating-internal",icon: "🔥", title: "Внутреннее отопление",              subtitle: "Радиаторы, тёплый пол, разводка по ЭСН Сб.18",                level: "L3", exercises: 4,  color: "orange"  },
  { id: "sewerage-internal",category: "utilities",href: "/smeta-trainer/drawings-practice/sewerage-internal",icon: "🚽", title: "Внутренняя канализация",            subtitle: "ПВХ, стояки, унитазы по ЭСН Сб.17",                            level: "L3", exercises: 4,  color: "slate"   },
  { id: "water-internal", category: "utilities",href: "/smeta-trainer/drawings-practice/water-internal", icon: "💧", title: "Внутренний водопровод",             subtitle: "ХВС/ГВС, металлопластик/PPR, узлы учёта по ЭСН Сб.16",        level: "L3", exercises: 4,  color: "sky"     },

  // ── Управление проектом и инструменты ──
  { id: "smeta-programs", category: "tools",    href: "/smeta-trainer/drawings-practice/smeta-programs", icon: "💼", title: "Сметные программы РК",              subtitle: "АВС-4, Смета РК, ИСТ Эталон — обзор и инструкции",            level: "L3", exercises: 4,  color: "sky"     },
  { id: "budget-management",category: "process",href: "/smeta-trainer/drawings-practice/budget-management",icon: "💰", title: "Управление бюджетом",               subtitle: "Аванс, удержания, cash flow, кассовые разрывы",               level: "L4", exercises: 4,  color: "emerald" },
  { id: "excel-templates",category: "tools",    href: "/smeta-trainer/drawings-practice/excel-templates",icon: "📋", title: "Excel-шаблоны смет",                subtitle: "8 типовых шаблонов с возможностью скачивания CSV",            level: "L2", exercises: 0,  color: "emerald" },

  // ── Теплоснабжение детально (расширение инж. сетей) ──
  { id: "itp",            category: "utilities",href: "/smeta-trainer/drawings-practice/itp",            icon: "♨️", title: "ИТП — индивидуальный теплопункт",   subtitle: "Теплообменник, насосы, узлы учёта тепла",                     level: "L4", exercises: 4,  color: "orange"  },
  { id: "boilers",        category: "utilities",href: "/smeta-trainer/drawings-practice/boilers",        icon: "🔥", title: "Котельные",                         subtitle: "Крышные/встроенные/отдельностоящие, газ. оборудование",       level: "L4", exercises: 4,  color: "red"     },
  { id: "vpv",            category: "utilities",href: "/smeta-trainer/drawings-practice/vpv",            icon: "🚰", title: "ВПВ — внутр. пожарный водопровод",   subtitle: "Пожарные краны, стояки, расчёт по СП РК 5.01-101",            level: "L4", exercises: 4,  color: "red"     },

  // ── Канализация детально (расширение) ──
  { id: "kns",            category: "utilities",href: "/smeta-trainer/drawings-practice/kns",            icon: "🔄", title: "КНС — насосные канализации",        subtitle: "5 типов от малых до резервуарных по СП РК 4.01-43",           level: "L4", exercises: 4,  color: "slate"   },
  { id: "storm-sewerage", category: "utilities",href: "/smeta-trainer/drawings-practice/storm-sewerage", icon: "☔", title: "Ливневая канализация",              subtitle: "Расчёт стоков, дождеприёмники, лотки по СНиП РК 4.01-43",     level: "L3", exercises: 4,  color: "blue"    },
  { id: "grease-traps",   category: "utilities",href: "/smeta-trainer/drawings-practice/grease-traps",   icon: "🍳", title: "Жироуловители",                     subtitle: "Для общепита, расчёт по посадочным местам",                   level: "L3", exercises: 4,  color: "amber"   },

  // ── Электроснабжение ──
  { id: "power-supply-external", category: "utilities",href: "/smeta-trainer/drawings-practice/power-supply-external", icon: "⚡", title: "Внешнее электроснабжение",         subtitle: "ЛЭП, КТП, ВЛ, КЛ — от подстанции до ВРУ",                      level: "L4", exercises: 4,  color: "violet"  },
  { id: "power-supply-internal", category: "utilities",href: "/smeta-trainer/drawings-practice/power-supply-internal", icon: "🔌", title: "Внутреннее электроснабжение",      subtitle: "ВРУ, щитовая, разводка по этажам, автоматы и УЗО",            level: "L3", exercises: 4,  color: "yellow"  },
  { id: "grounding-lightning",   category: "utilities",href: "/smeta-trainer/drawings-practice/grounding-lightning",   icon: "🌩",  title: "Заземление и молниезащита",        subtitle: "TN-S, контур, категории МЗ по СП РК 3.04-01",                 level: "L3", exercises: 4,  color: "amber"   },

  // ── Кондиционирование и холод ──
  { id: "air-conditioning",      category: "utilities",href: "/smeta-trainer/drawings-practice/air-conditioning",      icon: "❄️", title: "Кондиционирование",               subtitle: "Сплит, мульти-сплит, VRF, чиллер с фанкойлами",                level: "L3", exercises: 4,  color: "cyan"    },
  { id: "smoke-removal",         category: "utilities",href: "/smeta-trainer/drawings-practice/smoke-removal",         icon: "🚒", title: "Дымоудаление и противопож. вент.", subtitle: "ВД, ПД, огнезадерж. клапаны, EI 60/120 по СП РК 4.02-103",   level: "L4", exercises: 4,  color: "red"     },
  { id: "refrigeration",         category: "utilities",href: "/smeta-trainer/drawings-practice/refrigeration",         icon: "🧊", title: "Холодильные системы",             subtitle: "Камеры, витрины, серверная prec. cooling, чиллеры",            level: "L3", exercises: 4,  color: "sky"     },

  // ── Водоснабжение детально ──
  { id: "water-wells",              category: "utilities",href: "/smeta-trainer/drawings-practice/water-wells",              icon: "🚰", title: "Скважины и водозаборы",          subtitle: "Песок/известняк/артезианская, насосы Grundfos/Wilo",          level: "L4", exercises: 4,  color: "blue"    },
  { id: "pressure-stations",        category: "utilities",href: "/smeta-trainer/drawings-practice/pressure-stations",        icon: "💧", title: "ГНС повышения давления",         subtitle: "Дублирование N+1, противопож. ВКА, ЧРП по СП РК 4.01-101",   level: "L4", exercises: 4,  color: "cyan"    },
  { id: "water-treatment-detailed", category: "utilities",href: "/smeta-trainer/drawings-practice/water-treatment-detailed", icon: "🧪", title: "Водоподготовка детально",         subtitle: "Умягчение, обезжелезивание, осмос, УФ-стерилизация",          level: "L3", exercises: 4,  color: "teal"    },
  { id: "water-intake-pumping-station", category: "special", href: "/smeta-trainer/drawings-practice/water-intake-pumping-station", icon: "💧", title: "Водозабор + насосные I-II",      subtitle: "Балтаалинский 800 тыс м³/сут, KSB Sewatec + Sulzer APP, PCCP Ø2.4 м, hydrosphere surge, AWWA M11", level: "L5", exercises: 4,  color: "sky"     },
  { id: "sewage-treatment-msbr-large", category: "special", href: "/smeta-trainer/drawings-practice/sewage-treatment-msbr-large", icon: "🚱", title: "ОСК MSBR + N/P + cogeneration",  subtitle: "Кенасары 450 тыс м³/сут MSBR 6×9000 м³, AD digester 18000 м³ + GE Jenbacher J420, EU 91/271/EEC", level: "L5", exercises: 4,  color: "teal"    },
  { id: "ultra-pure-water-uf-ro", category: "special",   href: "/smeta-trainer/drawings-practice/ultra-pure-water-uf-ro", icon: "💎", title: "UPW Ultra Pure Water",            subtitle: "Химфарм 50 м³/час UF+RO+EDI+MB, USP <1231> 18.2 МΩ·см, ISPE Baseline, ASME BPE", level: "L5", exercises: 4,  color: "cyan"    },

  // ── Связь, газ ВД/СД, пневматика ──
  { id: "comm-fiber",             category: "utilities",href: "/smeta-trainer/drawings-practice/comm-fiber",             icon: "📡", title: "Связь и СКС",                     subtitle: "UTP cat.6/6A, ВОЛС, Wi-Fi, IP-камеры по ISO/IEC 11801",       level: "L3", exercises: 4,  color: "fuchsia" },
  { id: "gas-medium-pressure",    category: "utilities",href: "/smeta-trainer/drawings-practice/gas-medium-pressure",    icon: "🔥", title: "ГРП газовое ВД/СД",               subtitle: "ГРПШ-100/200, ГРПБ, ШРП по СНиП РК 4.03-01-2011",            level: "L4", exercises: 4,  color: "yellow"  },
  { id: "compressed-air",         category: "utilities",href: "/smeta-trainer/drawings-practice/compressed-air",         icon: "🌬", title: "Сжатый воздух — компрессорные",   subtitle: "Винтовые ATLAS COPCO, осушители, ресиверы",                   level: "L3", exercises: 4,  color: "slate"   },

  // ── Безопасность объекта ──
  { id: "fire-alarm",             category: "utilities",href: "/smeta-trainer/drawings-practice/fire-alarm",             icon: "🚨", title: "АПС и СОУЭ",                       subtitle: "Дымовые/тепловые/линейные ИП, СОУЭ 1-5 по СП РК 5.01-101",   level: "L4", exercises: 4,  color: "red"     },
  { id: "access-cctv",            category: "utilities",href: "/smeta-trainer/drawings-practice/access-cctv",            icon: "🔒", title: "СКУД и видеонаблюдение",          subtitle: "HID/Suprema, RFID/биометрия, IP-камеры 4МП, NVR 32CH",        level: "L3", exercises: 4,  color: "violet"  },
  { id: "sprinklers",             category: "utilities",href: "/smeta-trainer/drawings-practice/sprinklers",             icon: "💦", title: "Спринклерное пожаротушение",       subtitle: "Спринклеры/дренчеры/газовое/аэрозольное по СП РК 5.01-101",  level: "L4", exercises: 4,  color: "rose"    },

  // ── Smart + спец. демонтаж ──
  { id: "smart-home",             category: "utilities",href: "/smeta-trainer/drawings-practice/smart-home",             icon: "🏠", title: "Умный дом",                       subtitle: "KNX, Crestron, Wiren Board, MajorDoMo, ZigBee/Tuya",          level: "L3", exercises: 4,  color: "emerald" },
  { id: "asbestos-removal",       category: "special",   href: "/smeta-trainer/drawings-practice/asbestos-removal",     icon: "☣️", title: "Демонтаж асбеста",                subtitle: "Шифер, плиты, изоляция — лицензия МЭ + СЭС РК",               level: "L4", exercises: 4,  color: "stone"   },

  // ── Качество и безопасность зданий ──
  { id: "seismic-design",         category: "structure", href: "/smeta-trainer/drawings-practice/seismic-design",         icon: "🌋", title: "Сейсмостойкость зданий РК",       subtitle: "СП РК 2.03-30, Алматы 9 баллов, антисейсм. пояса, K₀/K₁/K₂",  level: "L5", exercises: 4,  color: "rose"    },
  { id: "energy-efficiency",      category: "process",   href: "/smeta-trainer/drawings-practice/energy-efficiency",      icon: "🌱", title: "Энергоэффективность",             subtitle: "СН РК 2.04-21, классы A-F, LEED/BREEAM/EDGE, утеплители",     level: "L4", exercises: 4,  color: "emerald" },
  { id: "lab-control",            category: "process",   href: "/smeta-trainer/drawings-practice/lab-control",            icon: "🧪", title: "Лабораторный контроль",           subtitle: "ГОСТ 10180/18105, кубики бетона, арматура, грунты",            level: "L4", exercises: 4,  color: "orange"  },

  // ── Цифровая стройка + управление ──
  { id: "cadastre-commissioning", category: "process",   href: "/smeta-trainer/drawings-practice/cadastre-commissioning", icon: "🏛️", title: "Ввод в эксплуатацию + кадастр",  subtitle: "ПП РК №353, Акт ввода, ГПК, регистрация НКА, ст.318 КоАП",     level: "L4", exercises: 4,  color: "fuchsia" },
  { id: "subcontractor-mgmt",     category: "process",   href: "/smeta-trainer/drawings-practice/subcontractor-mgmt",     icon: "🔗", title: "Управление субподрядом",          subtitle: "ГК РК 660, цепочка, удержания 10%, наценка ГП 5-15%",          level: "L4", exercises: 4,  color: "cyan"    },
  { id: "digital-twin-iot",       category: "tools",     href: "/smeta-trainer/drawings-practice/digital-twin-iot",       icon: "🧬", title: "Цифровой двойник + IoT",          subtitle: "BIM 3D-7D, ПП МИИР №132 (2025), 8 типов датчиков, ROI 7×",     level: "L5", exercises: 4,  color: "violet"  },

  // ── Логистика + охрана среды + юридич. защита ──
  { id: "transport-logistics",    category: "tools",     href: "/smeta-trainer/drawings-practice/transport-logistics",    icon: "🚛", title: "Транспортная логистика",          subtitle: "5 видов ТС, тарифы РК, ж/д vs авто, правило 300 км",          level: "L3", exercises: 4,  color: "amber"   },
  { id: "dust-noise-control",     category: "process",   href: "/smeta-trainer/drawings-practice/dust-noise-control",     icon: "🌫", title: "Пыле-шумозащита",                 subtitle: "СН РК 2.04-03, ПДК, штрафы СЭС, расчёт распр. шума",          level: "L3", exercises: 4,  color: "yellow"  },
  { id: "construction-disputes",  category: "process",   href: "/smeta-trainer/drawings-practice/construction-disputes",  icon: "⚖️", title: "Строительные споры",              subtitle: "ГК РК 706/716/723, СМЭС, МКАС Атамекен, односторонний КС-2",   level: "L5", exercises: 4,  color: "red"     },

  // ── Аналитика, базы цен, экспорт/импорт ──
  { id: "smeta-analytics",        category: "tools",     href: "/smeta-trainer/drawings-practice/smeta-analytics",        icon: "📊", title: "Аналитика и KPI сметчика",         subtitle: "Cost/m², CPI/SPI, ABC-анализ, бенчмарки РК 2025",             level: "L4", exercises: 4,  color: "indigo"  },
  { id: "price-database",         category: "tools",     href: "/smeta-trainer/drawings-practice/price-database",         icon: "🗄", title: "База цен и нормативный корпус",   subtitle: "6 источников РК, поля записи, Z-score, парсинг ССЦ",          level: "L4", exercises: 4,  color: "teal"    },
  { id: "export-import-reports",  category: "tools",     href: "/smeta-trainer/drawings-practice/export-import-reports",  icon: "📤", title: "Экспорт, импорт, отчёты",         subtitle: "8 форматов, 8 отчётов, АВС-4 vs Смета РК, ССР 12 глав",       level: "L3", exercises: 4,  color: "pink"    },

  // ── Изменения, безопасность, пост-сдача ──
  { id: "scope-change-mgmt",      category: "process",   href: "/smeta-trainer/drawings-practice/scope-change-mgmt",      icon: "🔄", title: "Управление изменениями (VO)",     subtitle: "ГК РК 718, FIDIC Sub-Cl.13/20, Claims, EOT, 28-дн. правило",  level: "L5", exercises: 4,  color: "orange"  },
  { id: "safety-incidents",       category: "process",   href: "/smeta-trainer/drawings-practice/safety-incidents",       icon: "🚑", title: "Несчастные случаи (Н-1)",         subtitle: "ТК РК 322-326, Приказ № 1108, УК РК ст. 152, ОПС 1-3% ФОТ",   level: "L4", exercises: 4,  color: "red"     },
  { id: "construction-warranty",  category: "process",   href: "/smeta-trainer/drawings-practice/construction-warranty",  icon: "🛠", title: "Гарантийное обслуживание",        subtitle: "ГК РК 723, 2/5/10 лет, журнал дефектов, регрессы цепочкой",    level: "L4", exercises: 4,  color: "blue"    },

  // ── Человек, карьера, финал ──
  { id: "soft-skills",            category: "tools",     href: "/smeta-trainer/drawings-practice/soft-skills",            icon: "🤝", title: "Soft skills сметчика",            subtitle: "8 навыков, Гарвардские переговоры, 6 типов конфликтов, BLUF",  level: "L4", exercises: 4,  color: "purple"  },
  { id: "career-pathway",         category: "tools",     href: "/smeta-trainer/drawings-practice/career-pathway",         icon: "🎓", title: "Карьерный путь сметчика РК",      subtitle: "6 уровней (Junior→Эксперт), 6 сертификаций, ВУЗы, зарплаты",   level: "L3", exercises: 4,  color: "emerald" },
  { id: "smeta-checklist",        category: "practice",  href: "/smeta-trainer/drawings-practice/smeta-checklist",        icon: "✅", title: "Финальный чек-лист (44 пункта)",  subtitle: "6 групп проверки, интерактивный, типовые ошибки сметчика РК",  level: "L5", exercises: 4,  color: "lime"    },

  // ── Специализации и масштаб ──
  { id: "specialty-construction", category: "special",   href: "/smeta-trainer/drawings-practice/specialty-construction", icon: "🏭", title: "Спец. строительство",            subtitle: "6 отраслей (промбу/гидро/агро/энерг/нефтегаз/транспорт)",      level: "L5", exercises: 4,  color: "stone"   },
  { id: "rural-construction",     category: "special",   href: "/smeta-trainer/drawings-practice/rural-construction",     icon: "🏡", title: "Сельское и дачное стр-во",        subtitle: "ИЖС до 500 м², уведомительный порядок, Бакыт, СБП, 6 программ", level: "L3", exercises: 4,  color: "green"   },
  { id: "infrastructure-projects",category: "practice",  href: "/smeta-trainer/drawings-practice/infrastructure-projects",icon: "🌆", title: "Инфраструктурные мегапроекты",    subtitle: "БАКАД/метро/нефтегаз, FIDIC, AACE Class, EVMS, RICS",          level: "L5", exercises: 4,  color: "zinc"    },

  // ── Реставрация, модули, восстановление ──
  { id: "historical-monuments",   category: "special",   href: "/smeta-trainer/drawings-practice/historical-monuments",   icon: "🏛️", title: "Реставрация памятников",          subtitle: "СНиП РК 1.04-25, ЮНЕСКО, Ясави, Венецианская хартия 1964",     level: "L5", exercises: 4,  color: "amber"   },
  { id: "religious-mosque",       category: "special",   href: "/smeta-trainer/drawings-practice/religious-mosque",       icon: "🕌", title: "Мечети и религ. комплексы",       subtitle: "Хазрет Султан 5000 верующих, купол Ø24 H=40, 4 минарета 70 м, СНиП 31-06, османский канон", level: "L5", exercises: 4,  color: "amber"   },
  { id: "modular-construction",   category: "special",   href: "/smeta-trainer/drawings-practice/modular-construction",   icon: "🧩", title: "Модульное и быстровозводимое",    subtitle: "6 типов (контейнер/SIP/3D-печать/LSF), вдвое быстрее монолита",  level: "L4", exercises: 4,  color: "cyan"    },
  { id: "post-disaster-recon",    category: "practice",  href: "/smeta-trainer/drawings-practice/post-disaster-recon",    icon: "🆘", title: "Послеаварийное восстановление",    subtitle: "Паводки 2024, ЗРК №188-V, Build Back Better, 6 типов ЧС РК",   level: "L5", exercises: 4,  color: "red"     },

  // ── Адаптация, умный город, спорт ──
  { id: "adaptive-reuse",         category: "special",   href: "/smeta-trainer/drawings-practice/adaptive-reuse",         icon: "♻️", title: "Адаптивное переиспользование",     subtitle: "Loft Almaty, заводы→лофты, ESG, экономия 20-40%, CO₂ −50-70%",  level: "L5", exercises: 4,  color: "orange"  },
  { id: "smart-city-iot",         category: "utilities", href: "/smeta-trainer/drawings-practice/smart-city-iot",         icon: "🏙", title: "Умный город (Smart City IoT)",    subtitle: "Светофоры, освещение, ЖКХ. LoRaWAN, NB-IoT, ЗРК №94-V",       level: "L4", exercises: 4,  color: "fuchsia" },
  { id: "stadium-arena",          category: "structure", href: "/smeta-trainer/drawings-practice/stadium-arena",          icon: "🏟", title: "Стадионы и арены",                subtitle: "FIFA Cat. 1-4, Astana Arena, эвакуация 8 мин, сейсмика 9 б.",  level: "L5", exercises: 4,  color: "emerald" },

  // ── Виды ремонта (фундаментальные) ──
  { id: "capital-vs-current-repair", category: "theory",  href: "/smeta-trainer/drawings-practice/capital-vs-current-repair", icon: "🔧", title: "Капремонт vs Текущий ремонт",     subtitle: "СН РК 3.02-01, ПП РК №1162, налог. учёт, гарантии 1 vs 5 лет",  level: "L4", exercises: 4,  color: "teal"    },
  { id: "reconstruction-vs-modernization", category: "theory", href: "/smeta-trainer/drawings-practice/reconstruction-vs-modernization", icon: "🔄", title: "Реконструкция vs Модернизация",   subtitle: "Изменение параметров, МДС 81-35, К=1.15-1.25, экспертиза",       level: "L5", exercises: 4,  color: "purple"  },
  { id: "renovation-types",       category: "practice",  href: "/smeta-trainer/drawings-practice/renovation-types",       icon: "🪜", title: "8 видов ремонта помещений",       subtitle: "От ямочного (50 тыс.) до VIP (300+ тыс. тг/м²), сметы по уровням", level: "L4", exercises: 4,  color: "rose"    },

  // ── Капремонт по объектам ──
  { id: "mkd-kapremont",          category: "process",   href: "/smeta-trainer/drawings-practice/mkd-kapremont",          icon: "🏢", title: "Капремонт МКД",                   subtitle: "10 видов работ, фонд капремонта, госсубсидии, Жил.код. 2/3",   level: "L4", exercises: 4,  color: "amber"   },
  { id: "road-repair-types",      category: "special",   href: "/smeta-trainer/drawings-practice/road-repair-types",      icon: "🛣", title: "Виды ремонта дорог",              subtitle: "6 уровней работ, СН РК 3.03-09, ЩМА-15, фрезеровка, бенчм.",   level: "L4", exercises: 4,  color: "slate"   },
  { id: "bridge-repair",          category: "special",   href: "/smeta-trainer/drawings-practice/bridge-repair",          icon: "🌉", title: "Ремонт мостов",                   subtitle: "СНиП 5.04-01, 8 элементов, водолазн. ЭСН Сб.45, FRP-усиление",  level: "L5", exercises: 4,  color: "cyan"    },

  // ── Ввод в работу ──
  { id: "commissioning-pnr",      category: "process",   href: "/smeta-trainer/drawings-practice/commissioning-pnr",      icon: "🔌", title: "Пуско-наладочные работы (ПНР)",   subtitle: "ЭСН Сб.4 ч.1/2, 8 этапов, 70 ч опробование, АСУТП 20-40%",    level: "L4", exercises: 4,  color: "yellow"  },
  { id: "tech-connection",        category: "process",   href: "/smeta-trainer/drawings-practice/tech-connection",        icon: "⚡", title: "Технологическое присоединение",   subtitle: "ТУ от 6 сетей, Глава 6 ССР, плата ТП электр. 30 тыс. тг/кВт",  level: "L4", exercises: 4,  color: "sky"     },
  { id: "shefmontazh",            category: "process",   href: "/smeta-trainer/drawings-practice/shefmontazh",            icon: "🔩", title: "Шефмонтаж и шефналадка",          subtitle: "Завод-изготовитель 2-10%, гарантия, иностранные спец-ты",       level: "L4", exercises: 4,  color: "lime"    },

  // ── Отделочные и изоляционные работы ──
  { id: "insulation-works",       category: "structure", href: "/smeta-trainer/drawings-practice/insulation-works",       icon: "🧱", title: "Изоляционные работы",             subtitle: "ЭСН Сб.25-27, тепло/гидро/звук, λ расчёт, 6 материалов",      level: "L3", exercises: 4,  color: "indigo"  },
  { id: "floor-types",            category: "finishing", href: "/smeta-trainer/drawings-practice/floor-types",            icon: "🪟", title: "Виды напольных покрытий",         subtitle: "8 видов (стяжка/керамогр./ламинат/паркет/наливной), ЭСН Сб.17", level: "L3", exercises: 4,  color: "amber"   },
  { id: "painting-plastering",    category: "finishing", href: "/smeta-trainer/drawings-practice/painting-plastering",    icon: "🎨", title: "Малярные и штукатурные работы",   subtitle: "ЭСН Сб.14-15, гипс/ЦПС/декор, покраска 4-5 слоёв, обои",      level: "L3", exercises: 4,  color: "fuchsia" },
  { id: "glazing-works",          category: "finishing", href: "/smeta-trainer/drawings-practice/glazing-works",          icon: "🪟", title: "Стекольные работы",               subtitle: "6 видов стекла, витражи, стеклопакеты 1/2/3-кам, смарт-стекло", level: "L3", exercises: 4,  color: "sky"     },
  { id: "natural-stone",          category: "finishing", href: "/smeta-trainer/drawings-practice/natural-stone",          icon: "💎", title: "Облицовка натуральным камнем",    subtitle: "Гранит/мрамор/травертин, ЭСН Сб.11, навесные системы",         level: "L4", exercises: 4,  color: "stone"   },
  { id: "special-finishes",       category: "finishing", href: "/smeta-trainer/drawings-practice/special-finishes",       icon: "✨", title: "Специальные виды отделки",        subtitle: "Венецианка, микроцемент, сусальное золото, роспись, резьба",    level: "L5", exercises: 4,  color: "amber"   },

  // ── Специализированные здания ──
  { id: "high-rise-buildings",    category: "structure", href: "/smeta-trainer/drawings-practice/high-rise-buildings",    icon: "🏢", title: "Высотные здания 30+ этажей",      subtitle: "ТМД, сейсмоизоляция, зонирование лифтов, VRF, бенчмарки",      level: "L5", exercises: 4,  color: "violet"  },
  { id: "data-centers",           category: "tools",     href: "/smeta-trainer/drawings-practice/data-centers",           icon: "💻", title: "Дата-центры (ЦОД)",               subtitle: "Tier I-IV, PUE, NOVEC-тушение, HEPA, Qazcloud/KT примеры РК",  level: "L5", exercises: 4,  color: "slate"   },
  { id: "clean-rooms",            category: "special",   href: "/smeta-trainer/drawings-practice/clean-rooms",            icon: "🧪", title: "Чистые комнаты (ISO 1-9)",        subtitle: "Фарм./медиц./нано, HEPA 99.97%, избыточное давление +15 Па",    level: "L5", exercises: 4,  color: "teal"    },
  { id: "museums-galleries",      category: "practice",  href: "/smeta-trainer/drawings-practice/museums-galleries",      icon: "🏛️", title: "Музеи и галереи",                 subtitle: "Климат 18-22°C, 50-200 лк без УФ, NOVEC, сейсмовитрины",       level: "L5", exercises: 4,  color: "amber"   },
  { id: "theaters-opera",         category: "practice",  href: "/smeta-trainer/drawings-practice/theaters-opera",         icon: "🎭", title: "Театры и оперы",                  subtitle: "RT60 1.1-3.0 с, сценическая механика, оркестровая яма",         level: "L5", exercises: 4,  color: "rose"    },
  { id: "aquapark-pool",          category: "special",   href: "/smeta-trainer/drawings-practice/aquapark-pool",          icon: "🏊", title: "Аквапарки и бассейны",            subtitle: "FINA 50×25 м, ПВХ-гидроизоляция, рециркуляция, хлорамины",     level: "L4", exercises: 4,  color: "cyan"    },
  { id: "military-defense",       category: "special",   href: "/smeta-trainer/drawings-practice/military-defense",       icon: "🪖", title: "Военные объекты",                 subtitle: "Допуск формы №2, секретные ЭСН МО, КП усиленный монолит",       level: "L5", exercises: 4,  color: "stone"   },
  { id: "prison-corrections",     category: "special",   href: "/smeta-trainer/drawings-practice/prison-corrections",     icon: "🔒", title: "СИЗО и ИК",                       subtitle: "ДТКС периметр, 4 м²/чел, PC-остекление, нормы КУИС",            level: "L5", exercises: 4,  color: "slate"   },
  { id: "cemetery-crematorium",   category: "special",   href: "/smeta-trainer/drawings-practice/cemetery-crematorium",   icon: "⚱️", title: "Кладбища и крематории",           subtitle: "500 м санразрыв, Qibla ориентация, HEPA дымоочистка кремат.",    level: "L4", exercises: 4,  color: "slate"   },
  { id: "food-production",        category: "special",   href: "/smeta-trainer/drawings-practice/food-production",        icon: "🏭", title: "Пищевые производства",            subtitle: "HACCP, нержавейка AISI 304, EP полы 1-2% уклон, зонирование",   level: "L4", exercises: 4,  color: "lime"    },
  { id: "anti-corrosion-works",   category: "process",   href: "/smeta-trainer/drawings-practice/anti-corrosion-works",   icon: "🛡", title: "Антикоррозионная защита",          subtitle: "ЭСН Сб.12, ISO 12944 C1-C5-M, горячее цинкование 40-80 лет",    level: "L4", exercises: 4,  color: "orange"  },
  { id: "drainage-systems",       category: "utilities", href: "/smeta-trainer/drawings-practice/drainage-systems",       icon: "🌊", title: "Дренажные системы",               subtitle: "5 видов, геотекстиль, уклон 1‰, СН РК 4.01-43",                 level: "L3", exercises: 4,  color: "blue"    },

  // ── Горное дело, промполы, логистика ──
  { id: "drilling-blasting",      category: "special",   href: "/smeta-trainer/drawings-practice/drilling-blasting",      icon: "💥", title: "Взрывные и буровые работы",       subtitle: "ЭСН Сб.36, ANFO/эмульсии, паспорт БВР, лицензия МЧС",          level: "L5", exercises: 4,  color: "stone"   },
  { id: "industrial-floors",      category: "finishing", href: "/smeta-trainer/drawings-practice/industrial-floors",      icon: "🏭", title: "Промышленные полы детально",      subtitle: "Топпинг, эпоксидные, ПУ, ММА — нагрузки 5-50 т/м²",              level: "L4", exercises: 4,  color: "zinc"    },
  { id: "logistics-terminals",    category: "practice",  href: "/smeta-trainer/drawings-practice/logistics-terminals",    icon: "📦", title: "Логистические центры и терминалы",  subtitle: "Склады A/B/C, стеллажи Mecalux, доки DOK, ESFR, X-dock",          level: "L5", exercises: 4,  color: "orange"  },

  // ── Карьеры, кессоны, зоопарки ──
  { id: "mining-quarry",          category: "special",   href: "/smeta-trainer/drawings-practice/mining-quarry",          icon: "⛏️", title: "Горнодобывающие работы",          subtitle: "Карьеры, ЭКГ-12/15/20, БелАЗ 75710, рекультивация СНиП 3.06-12",  level: "L5", exercises: 4,  color: "stone"   },
  { id: "caisson-works",          category: "special",   href: "/smeta-trainer/drawings-practice/caisson-works",          icon: "🌊", title: "Кессонные работы",                subtitle: "Опускные колодцы, шпунт Larssen, ВПТ, ЭСН Сб.45 водолазы",        level: "L5", exercises: 4,  color: "blue"    },
  { id: "zoo-aquarium",           category: "practice",  href: "/smeta-trainer/drawings-practice/zoo-aquarium",           icon: "🐅", title: "Зоопарки и аквариумы",            subtitle: "EAZA/WAZA нормы, акрил 100-300 мм, LSS, климат-зоны",            level: "L5", exercises: 4,  color: "amber"   },

  // ── Спорт, атом, берегоукрепление ──
  { id: "sports-fields",          category: "practice",  href: "/smeta-trainer/drawings-practice/sports-fields",          icon: "⚽", title: "Спортивные поля и гольф",         subtitle: "FIFA 105×68, IAAF Mondotrack, ITF корты, USGA 18 лунок",          level: "L4", exercises: 4,  color: "emerald" },
  { id: "nuclear-radiation",      category: "special",   href: "/smeta-trainer/drawings-practice/nuclear-radiation",      icon: "☢️", title: "Атомные и радиационные объекты", subtitle: "АЭС Балхаш ВВЭР-1200, бункеры LINAC, КАЭН РК, НРБ-99",          level: "L5", exercises: 4,  color: "red"     },
  { id: "cyclotron-medical-research", category: "special", href: "/smeta-trainer/drawings-practice/cyclotron-medical-research", icon: "⚛️", title: "Циклотроны и мед. изотопы",      subtitle: "ИЯФ Cyclone 18/9 IBA, F-18 FDG для ПЭТ/КТ, бункер ρ=3.5 т/м³, IAEA TRS-471", level: "L5", exercises: 4,  color: "indigo"  },
  { id: "coast-protection",       category: "special",   href: "/smeta-trainer/drawings-practice/coast-protection",       icon: "🌊", title: "Берегоукрепление и намыв",        subtitle: "Тетраподы 2-25 т, габионы Maccaferri, землесос, Каспий",          level: "L5", exercises: 4,  color: "cyan"    },

  // ── Агро, тоннели, нефтехимия ──
  { id: "agro-greenhouses",       category: "special",   href: "/smeta-trainer/drawings-practice/agro-greenhouses",       icon: "🌱", title: "Агрокомплексы и теплицы",         subtitle: "Venlo 6-7 м, гидропоника, РГС-хранилища, элеваторы SCAFCO",       level: "L4", exercises: 4,  color: "lime"    },
  { id: "tunneling-works",        category: "special",   href: "/smeta-trainer/drawings-practice/tunneling-works",        icon: "🚇", title: "Тоннелепроходка",                 subtitle: "TBM EPB, НАТМ, микротоннели, метро Алматы 11.3 км",               level: "L5", exercises: 4,  color: "slate"   },
  { id: "petrochemical-objects",  category: "special",   href: "/smeta-trainer/drawings-practice/petrochemical-objects",  icon: "⚗️", title: "Нефтехимия и НПЗ",                subtitle: "4 НПЗ РК, РВС 50000 м³, факелы H=120 м, эстакады, FGP $45 млрд", level: "L5", exercises: 4,  color: "amber"   },

  // ── ГПЗ, магистрали, аэропорты ──
  { id: "gas-processing-plants",  category: "special",   href: "/smeta-trainer/drawings-practice/gas-processing-plants",  icon: "🔥", title: "ГПЗ — газоперераб. заводы",       subtitle: "KPO Карачаганак, ТШО FGP, процесс Клауса, аминовая очистка",      level: "L5", exercises: 4,  color: "orange"  },
  { id: "main-pipelines",         category: "special",   href: "/smeta-trainer/drawings-practice/main-pipelines",         icon: "🛢️", title: "Магистральные трубопроводы",      subtitle: "КТК Тенгиз-Новороссийск, Туркм.-Китай, СКЗ, 400 млн тг/км",       level: "L5", exercises: 4,  color: "stone"   },
  { id: "oil-offshore-platform",  category: "special",   href: "/smeta-trainer/drawings-practice/oil-offshore-platform",  icon: "🛢️", title: "Морские нефт. платформы GBS",     subtitle: "Кашаган D-Island, GBS 270×100×30 м бетон 600 тыс м³, ice belt 45°, ISO 19906 + NACE MR0175", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "underwater-tunnels-subsea", category: "special", href: "/smeta-trainer/drawings-practice/underwater-tunnels-subsea", icon: "🌊", title: "Подводные трубопроводы Subsea",  subtitle: "Кашаган-Атырау Ø32\" X70 100 км, S-lay Saipem, CWC 40 мм, DNV-OS-F101 + API 1160", level: "L5", exercises: 4,  color: "sky"     },
  { id: "floating-storage-fpso",  category: "special",   href: "/smeta-trainer/drawings-practice/floating-storage-fpso",  icon: "⚓", title: "FPSO плавучие производства",      subtitle: "Афрамакс 110 000 dwt + topside 30 000 т, Internal Turret Yme-style, ABS/DNV/LR, MARPOL Annex I", level: "L5", exercises: 4,  color: "blue"    },
  { id: "airports-terminals",     category: "practice",  href: "/smeta-trainer/drawings-practice/airports-terminals",     icon: "✈️", title: "Аэропорты и терминалы",          subtitle: "ICAO Code 4F, ВПП 4500 м, ILS Cat III, Алматы AAA, Астана NQZ",   level: "L5", exercises: 4,  color: "sky"     },
  { id: "simulator-training-center", category: "special", href: "/smeta-trainer/drawings-practice/simulator-training-center", icon: "🎮", title: "Авиа-тренажёрные центры",       subtitle: "Air Astana FTC 4× CAE 7000XR FFS Level D, A320+B737+B767, EASA Part-FCL + FAA Part 142", level: "L5", exercises: 4,  color: "sky"     },

  // ── Ж/д, морпорты, электростанции ──
  { id: "railways-stations",      category: "special",   href: "/smeta-trainer/drawings-practice/railways-stations",      icon: "🚂", title: "Железные дороги и вокзалы",       subtitle: "Колея 1520, Р65, Ш1, ВСМ Алматы-Астана 1200 км, 25 кВ AC",        level: "L5", exercises: 4,  color: "slate"   },
  { id: "seaports-harbors",       category: "special",   href: "/smeta-trainer/drawings-practice/seaports-harbors",       icon: "⚓", title: "Морские и речные порты",          subtitle: "Актау 10 млн т, STS-краны, Liebherr LHM 600, TEU, дноуглубление", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "power-plants",           category: "special",   href: "/smeta-trainer/drawings-practice/power-plants",           icon: "⚡", title: "Электростанции (ТЭЦ/ГЭС/ВЭС/СЭС)", subtitle: "Экибастуз ГРЭС-1 4000 МВт, Мойнакская ГЭС, СЭС 330 млн тг/МВт",   level: "L5", exercises: 4,  color: "yellow"  },

  // ── Плотины, ПС, шахты ──
  { id: "dams-hydrostructures",   category: "special",   href: "/smeta-trainer/drawings-practice/dams-hydrostructures",   icon: "🌊", title: "Плотины и гидротехника",          subtitle: "Бухтарма H=90 м, Капшагай 28 км³, Tainter gate, КИА, СН РК 3.04-13", level: "L5", exercises: 4,  color: "blue"    },
  { id: "substations-power",      category: "utilities", href: "/smeta-trainer/drawings-practice/substations-power",      icon: "⚡", title: "Подстанции 110-1150 кВ",          subtitle: "KEGOC ПС 500/1150 кВ, КРУЭ ABB/Siemens, РЗА SIPROTEC",            level: "L5", exercises: 4,  color: "amber"   },
  { id: "mine-shafts-underground",category: "special",   href: "/smeta-trainer/drawings-practice/mine-shafts-underground",icon: "⛏️", title: "Шахты и подземные выработки",     subtitle: "Стволы Ø6-8 м H=1000 м, СВП-22/27/33, ПБ 03-553, Караганда",      level: "L5", exercises: 4,  color: "stone"   },

  // ── Цемент, металлургия, текстиль ──
  { id: "cement-plants",          category: "special",   href: "/smeta-trainer/drawings-practice/cement-plants",          icon: "🏭", title: "Цементные заводы",                subtitle: "Карагандацемент 2.5 млн т, вращающаяся печь Ø5×75 м, клинкер 1450°C", level: "L5", exercises: 4,  color: "stone"   },
  { id: "metallurgy-plants",      category: "special",   href: "/smeta-trainer/drawings-practice/metallurgy-plants",      icon: "🔥", title: "Металлургические заводы",         subtitle: "АО АрселорМиттал Темиртау 5 млн т стали, конвертер LD 250 т, ДП-9", level: "L5", exercises: 4,  color: "red"     },
  { id: "aluminum-smelter-electrolysis", category: "special", href: "/smeta-trainer/drawings-practice/aluminum-smelter-electrolysis", icon: "🔋", title: "Алюминий — электролиз Hall-Héroult", subtitle: "KAP Павлодар 250 тыс. т/год, AP-40 pre-baked, 13.5 МВт·ч/т, PFC <0.05 кг CO2eq, EU IED BAT", level: "L5", exercises: 4,  color: "stone"   },
  { id: "gold-cyanidation-plant", category: "special",   href: "/smeta-trainer/drawings-practice/gold-cyanidation-plant", icon: "🥇", title: "Золото — CIL + цианирование",     subtitle: "Алтынтау-Кокшетау 11 млн т/год 18 т Au, SAG 18 МВт + CIL 7×4500 м³, ICMC 2020 + GISTM", level: "L5", exercises: 4,  color: "zinc"    },
  { id: "chrome-ferroalloys-plant", category: "special", href: "/smeta-trainer/drawings-practice/chrome-ferroalloys-plant", icon: "⚙️", title: "Феррохром FeCr — SAF",            subtitle: "АксЗФ ERG 1.5 млн т/год, DC SAF 72 МВА Outotec closed-roof, Soderberg, cogeneration, ICDA + EU IED BAT NFM", level: "L5", exercises: 4,  color: "orange"  },
  { id: "textile-factories",      category: "special",   href: "/smeta-trainer/drawings-practice/textile-factories",      icon: "🧵", title: "Текстильные фабрики",             subtitle: "Шымкент 50 млрд тг, прядение/ткачество, цех 144×72 м, кондиционирование", level: "L5", exercises: 4,  color: "rose"    },

  // ── АПК: зерно, мясо, молоко ──
  { id: "elevators-granaries",    category: "special",   href: "/smeta-trainer/drawings-practice/elevators-granaries",    icon: "🌾", title: "Элеваторы и зернохранилища",      subtitle: "Силосы Ø6 м H=30 м, 50 тыс. т Костанай, СН РК 3.04-13, аспирация ПБ В-IIa", level: "L5", exercises: 4,  color: "yellow"  },
  { id: "meat-processing",        category: "special",   href: "/smeta-trainer/drawings-practice/meat-processing",        icon: "🥩", title: "Мясокомбинаты и пищепром",        subtitle: "50 т/смену Караганда, СанПиН 4.01-001-2024, шок -35°C, R717 NH₃ ПБ 09-595", level: "L5", exercises: 4,  color: "red"     },
  { id: "dairy-plants",           category: "special",   href: "/smeta-trainer/drawings-practice/dairy-plants",           icon: "🥛", title: "Молочные заводы",                 subtitle: "200 т/сутки, HTST 72°C/UHT 135°C, Tetra Pak, CIP-мойка, БПК₅ 3000→6 мг/л", level: "L5", exercises: 4,  color: "sky"     },

  // ── Коммерческая недвижимость: банки, ТРЦ, отели ──
  { id: "banks-branches",         category: "special",   href: "/smeta-trainer/drawings-practice/banks-branches",         icon: "🏦", title: "Банковские отделения",            subtitle: "Halyk/Kaspi/ForteBank, хранилище кл. III ГОСТ Р 50862, бронестекло Б3", level: "L5", exercises: 4,  color: "emerald" },
  { id: "shopping-malls",         category: "special",   href: "/smeta-trainer/drawings-practice/shopping-malls",         icon: "🛍️", title: "Торгово-развлекательные центры",  subtitle: "Mega/Esentai 50 000 м² GLA, эскалаторы Schindler, СН РК 2.02-15 Ф3.1",  level: "L5", exercises: 4,  color: "violet"  },
  { id: "hotels-resorts",         category: "special",   href: "/smeta-trainer/drawings-practice/hotels-resorts",         icon: "🏨", title: "Гостиницы 5★ и курорты",          subtitle: "Ritz-Carlton/Rixos, СП РК 3.02-08, Rw≥52 дБ, СПА, банкетные залы",      level: "L5", exercises: 4,  color: "amber"   },

  // ── Медицина и образование ──
  { id: "hospitals-clinics",      category: "practice",  href: "/smeta-trainer/drawings-practice/hospitals-clinics",      icon: "🏥", title: "Больницы и клиники",              subtitle: "РКБ Алматы 600 коек, ОРИТ 18 м²/койка, O₂ 540 л/мин, ОП Класс «А» ISO 5", level: "L5", exercises: 4,  color: "rose"    },
  { id: "schools-modern",         category: "practice",  href: "/smeta-trainer/drawings-practice/schools-modern",         icon: "🏫", title: "Современные школы",               subtitle: "ШГ-1500, СП РК 3.02-04, спортзал 18×30×7, актовый 600 мест, СанПиН 4.01-007", level: "L5", exercises: 4,  color: "sky"     },
  { id: "universities-campuses",  category: "practice",  href: "/smeta-trainer/drawings-practice/universities-campuses",  icon: "🎓", title: "Университеты и кампусы",          subtitle: "Назарбаев Универс. 152 га, BSL-3 лаборатории, амфитеатр 500 мест, бассейн 50 м", level: "L5", exercises: 4,  color: "violet"  },

  // ── ТЭК: нефтехимия, СПГ, ВИЭ ──
  { id: "refineries-oil",         category: "special",   href: "/smeta-trainer/drawings-practice/refineries-oil",         icon: "🛢️", title: "Нефтеперерабатывающие заводы",    subtitle: "АНПЗ 6 млн т/год, ЭЛОУ-АВТ-6 H=60 м, ATEX 0/1/2, факел H=80 м, ПУЭ 7.3", level: "L5", exercises: 4,  color: "stone"   },
  { id: "lng-plants",             category: "special",   href: "/smeta-trainer/drawings-practice/lng-plants",             icon: "🧊", title: "СПГ-заводы и терминалы",          subtitle: "2 млн т/год, C3MR Air Products, Full Containment Ø80 м −162°C, NFPA 59A", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "wind-solar-farms",       category: "special",   href: "/smeta-trainer/drawings-practice/wind-solar-farms",       icon: "🌬️", title: "ВЭС и СЭС (ВИЭ)",                 subtitle: "Жанатас 100 МВт, V150-5 МВт башня 120 м, JinkoSolar 550 Вт, IEC 61400-24",  level: "L5", exercises: 4,  color: "lime"    },
  { id: "green-hydrogen-electrolyzer", category: "special", href: "/smeta-trainer/drawings-practice/green-hydrogen-electrolyzer", icon: "💧", title: "Зелёный H2 — PEM электролиз",     subtitle: "Hyrasia One Мангистау 20 ГВт PV+ветер → 2 млн т H2/год, Siemens Silyzer 300 17.5 МВт, NH3 carrier, IRENA + EU H2 Strategy", level: "L5", exercises: 4,  color: "emerald" },
  { id: "pumped-storage-hydroelectric", category: "special", href: "/smeta-trainer/drawings-practice/pumped-storage-hydroelectric", icon: "⚡", title: "ГАЭС — гидроаккумуляция",         subtitle: "Алакольская 1200 МВт × 8 ч, H=130 м, Voith Francis reversible 300 МВт, round-trip 75%, ICOLD 2020", level: "L5", exercises: 4,  color: "blue"    },
  { id: "csp-solar-thermal-tower", category: "special",   href: "/smeta-trainer/drawings-practice/csp-solar-thermal-tower", icon: "☀️", title: "CSP башенного типа (расплавл. соль)", subtitle: "Aksu CSP 100 МВт + 8 ч TES, башня H=200 м, 6 000 гелиостатов, Solar Salt 565 °C, NREL + IEC 62862", level: "L5", exercises: 4,  color: "yellow"  },
  { id: "bess-grid-battery",       category: "special",   href: "/smeta-trainer/drawings-practice/bess-grid-battery",       icon: "🔋", title: "BESS Grid-Scale Battery",         subtitle: "200 МВт·ч 50× Tesla Megapack LFP, PCS SMA, NFPA 855 + UL 9540, frequency regulation", level: "L5", exercises: 4,  color: "violet"  },
  { id: "hvdc-transmission-line",  category: "special",   href: "/smeta-trainer/drawings-practice/hvdc-transmission-line",  icon: "⚡", title: "HVDC передача постоянного тока",  subtitle: "Экибастуз-Урумчи ±800 кВ 6 ГВт 1500 км, LCC Siemens HVDC PLUS, CIGRE B4 + IEEE 1158", level: "L5", exercises: 4,  color: "indigo"  },
  { id: "supercapacitor-flywheel-storage", category: "special", href: "/smeta-trainer/drawings-practice/supercapacitor-flywheel-storage", icon: "🌀", title: "Supercap + Flywheel fast storage", subtitle: "Maxwell BoostCap 13.5 МДж + Beacon Power 25× 100 кВт·ч 16 000 rpm, frequency response <100 ms", level: "L5", exercises: 4,  color: "purple"  },
  { id: "aromatics-btx-plant",     category: "special",   href: "/smeta-trainer/drawings-practice/aromatics-btx-plant",     icon: "🛢️", title: "BTX Aromatics Complex",            subtitle: "Атырау 1.2 Mt feed → 500 кт PX/год, UOP CCR Platforming + Sulfolane + Parex SMB, EU IED BAT Refining", level: "L5", exercises: 4,  color: "orange"  },
  { id: "ethylene-steam-cracker",  category: "special",   href: "/smeta-trainer/drawings-practice/ethylene-steam-cracker",  icon: "🔥", title: "Ethylene Steam Cracker",          subtitle: "GPC Атырау 600 кт/год, 8× furnaces 850 °C Linde, CGC 80 МВт, demethanizer -100 °C, EU IED BAT LVOC", level: "L5", exercises: 4,  color: "red"     },
  { id: "polymers-pe-pp-plant",    category: "special",   href: "/smeta-trainer/drawings-practice/polymers-pe-pp-plant",    icon: "🧴", title: "PE/PP полимеризация",             subtitle: "HDPE 400 кт/год Innovene G fluidized bed, Ziegler-Natta + metallocene, Coperion ZSK + Gala, NFPA 654 dust", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "district-cooling-chiller", category: "utilities", href: "/smeta-trainer/drawings-practice/district-cooling-chiller", icon: "❄️", title: "District Cooling chiller plant", subtitle: "Астана-Холод 50 МВт York YK 5000 RT R-1233zd HFO, ice TES 100 МВт·ч, ASHRAE 90.1 + IDEA", level: "L5", exercises: 4,  color: "sky"     },
  { id: "stormwater-detention-tunnel", category: "utilities", href: "/smeta-trainer/drawings-practice/stormwater-detention-tunnel", icon: "🌧️", title: "Stormwater Detention Tunnel",   subtitle: "Алматы Ø8 м × 10 км TBM Robbins 400 000 м³ buffer, 100-yr storm, ASCE BMP + EPA", level: "L5", exercises: 4,  color: "blue"    },
  { id: "pneumatic-waste-collection", category: "utilities", href: "/smeta-trainer/drawings-practice/pneumatic-waste-collection", icon: "🚮", title: "Pneumatic Waste AVAC Envac",     subtitle: "EXPO Astana 5000 households SS Ø600 vacuum 0.6 бар 50 м/с, Howden blowers, ISWA Best Practices", level: "L5", exercises: 4,  color: "emerald" },
  { id: "radio-telescope-vlbi",    category: "special",   href: "/smeta-trainer/drawings-practice/radio-telescope-vlbi",    icon: "📡", title: "Радиотелескоп VLBI",              subtitle: "РТ-32 Ка-band Cassegrain Vertex 0.3 мм RMS, H-maser, EVN+IVS, ITU-R RA.769", level: "L5", exercises: 4,  color: "violet"  },
  { id: "suspension-bridge-long-span", category: "structure", href: "/smeta-trainer/drawings-practice/suspension-bridge-long-span", icon: "🌉", title: "Висячий мост (suspension long-span)", subtitle: "1200 m main span pylons H=220 м, main cable Ø600 PWS 30 000 wires, TMD, AASHTO LRFD", level: "L5", exercises: 4,  color: "stone"   },
  { id: "leaning-tower-intentional-tilt", category: "structure", href: "/smeta-trainer/drawings-practice/leaning-tower-intentional-tilt", icon: "🗼", title: "Башня с намеренным наклоном",    subtitle: "Capital Gate-style H=80 m tilt 18°, diaphragm wall + post-tensioned, TMD 300 т, ASCE 7-22", level: "L5", exercises: 4,  color: "amber"   },
  { id: "organ-transplant-center", category: "special",   href: "/smeta-trainer/drawings-practice/organ-transplant-center", icon: "🫀", title: "Центр трансплантации органов",  subtitle: "РККТ Астана 24 koek, XVIVO LifePort + OrganOx, HLA Luminex, ISHLT + UNOS + СН РК 3.02-19", level: "L5", exercises: 4,  color: "red"     },
  { id: "ivf-fertility-clinic",    category: "special",   href: "/smeta-trainer/drawings-practice/ivf-fertility-clinic",    icon: "👶", title: "IVF ART клиника",                 subtitle: "ИРМ Алматы 1500 cycles/yr ISO 14644 cl.7 IVF-grade air, EmbryoScope+ time-lapse, Kitazato Cryotop", level: "L5", exercises: 4,  color: "pink"    },
  { id: "hyperbaric-oxygen-chamber", category: "special", href: "/smeta-trainer/drawings-practice/hyperbaric-oxygen-chamber", icon: "🫁", title: "HBO гипербарическая оксигенация", subtitle: "Multiplace 12 person 3.0 ATA, Sechrist ASME PVHO-1, NFPA 99 fire safety, UHMS Indications", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "cdmo-biopharma-facility", category: "special",   href: "/smeta-trainer/drawings-practice/cdmo-biopharma-facility", icon: "🧬", title: "CDMO Biopharma Contract Manuf.",  subtitle: "Astana Hub 2000 L bioreactor Sartorius STR, MAb Protein A Cytiva, EU GMP Annex 1 + ICH Q5A", level: "L5", exercises: 4,  color: "purple"  },
  { id: "genome-sequencing-center", category: "special",  href: "/smeta-trainer/drawings-practice/genome-sequencing-center", icon: "🧬", title: "Genome Sequencing Center NGS",   subtitle: "Kazakhstan Genome 100K samples/yr, NovaSeq X + PacBio + Nanopore, HPC 10 PB, GA4GH + HIPAA", level: "L5", exercises: 4,  color: "pink"    },
  { id: "mrna-vaccine-pilot",      category: "special",   href: "/smeta-trainer/drawings-practice/mrna-vaccine-pilot",      icon: "💉", title: "mRNA Vaccine Pilot Plant",        subtitle: "10M doses/yr pilot, IVT T7 50 L + LNP Precision NanoSystems, BioNTech-style, EU GMP Annex 1", level: "L5", exercises: 4,  color: "red"     },
  { id: "alpine-mountain-resort",  category: "special",   href: "/smeta-trainer/drawings-practice/alpine-mountain-resort",  icon: "⛷️", title: "Alpine Mountain Resort",          subtitle: "Шымбулак 50 km slopes Doppelmayr gondola, TechnoAlpin snow guns, Gazex avalanche control, FIS+ANSI B77.1", level: "L5", exercises: 4,  color: "sky"     },
  { id: "eco-resort-glamping",     category: "special",   href: "/smeta-trainer/drawings-practice/eco-resort-glamping",     icon: "🏕️", title: "Eco-Resort Glamping",             subtitle: "Чарын 50 safari tents off-grid solar 200 kWp + BESS, composting + greywater wetlands, LEED+GSTC", level: "L5", exercises: 4,  color: "emerald" },
  { id: "thermal-spa-balneology",  category: "special",   href: "/smeta-trainer/drawings-practice/thermal-spa-balneology",  icon: "♨️", title: "Thermal Spa + Бальнеология",      subtitle: "Сарыагаш 38-42 °C geothermal well 1500 м, ozone Wedeco, mud therapy + sauna, WHO + ISMH", level: "L5", exercises: 4,  color: "rose"    },
  { id: "fablab-makerspace",       category: "special",   href: "/smeta-trainer/drawings-practice/fablab-makerspace",       icon: "🛠️", title: "FabLab Makerspace MIT-style",     subtitle: "Astana Hub 800 м² Trotec + Tormach + Ultimaker + LPKF PCB, Fab Foundation Standards", level: "L5", exercises: 4,  color: "orange"  },
  { id: "hpc-supercomputing-center", category: "special", href: "/smeta-trainer/drawings-practice/hpc-supercomputing-center", icon: "🖥️", title: "HPC Supercomputing 100 PFlops",  subtitle: "Astana NU 2500 nodes EPYC + 10K NVIDIA H100, InfiniBand NDR, DLC liquid cooling, TIA-942 Tier IV", level: "L5", exercises: 4,  color: "indigo"  },
  { id: "climate-arctic-research-station", category: "special", href: "/smeta-trainer/drawings-practice/climate-arctic-research-station", icon: "❄️", title: "Climate Research Station High-Alt", subtitle: "Тянь-Шань H=3500 м Picarro CO2 CRDS, LIDAR, thermosiphon foundation, WMO GAW + IPCC", level: "L5", exercises: 4,  color: "sky"     },

  // ── Городской транспорт: метро, тоннели, LRT ──
  { id: "metro-stations",         category: "special",   href: "/smeta-trainer/drawings-practice/metro-stations",         icon: "🚇", title: "Метрополитен и станции",          subtitle: "Алматы Линия 1 11 ст. глубина 35 м, ТБМ Herrenknecht S-558 Ø6.66 м, СНиП 32-02", level: "L5", exercises: 4,  color: "indigo"  },
  { id: "tunnels-vehicle",        category: "special",   href: "/smeta-trainer/drawings-practice/tunnels-vehicle",        icon: "🚗", title: "Автомобильные тоннели",           subtitle: "Кокпекский 6 км, НАТМ, обделка B40, Jet-fan 28 шт, EU 2004/54/EC, СНиП 32-04", level: "L5", exercises: 4,  color: "zinc"    },
  { id: "tramway-light-rail",     category: "special",   href: "/smeta-trainer/drawings-practice/tramway-light-rail",     icon: "🚊", title: "Трамваи и LRT",                   subtitle: "Астана LRT 22 км, КС-160 750 В DC, рельсы Р65, Stadler Tango, СП 245.1326000", level: "L5", exercises: 4,  color: "teal"    },

  // ── Спорт, культура, наука ──
  { id: "arena-football",         category: "practice",  href: "/smeta-trainer/drawings-practice/arena-football",         icon: "⚽", title: "Футбольные арены",                subtitle: "Astana Arena 30 000 мест, UEFA Cat. 4, ретракт. крыша ПТФЭ, освещ. 2400 лк EBU HDR", level: "L5", exercises: 4,  color: "orange"  },
  { id: "museum-archives",        category: "practice",  href: "/smeta-trainer/drawings-practice/museum-archives",        icon: "🏛️", title: "Музеи и фондохранилища",          subtitle: "Нац. музей РК 74 000 м², +18°C/RH 50%, HEPA F9, Inergen IG-541, ICOM/ISO 11799", level: "L5", exercises: 4,  color: "fuchsia" },
  { id: "observatory-research",   category: "practice",  href: "/smeta-trainer/drawings-practice/observatory-research",   icon: "🔭", title: "Обсерватории и научные станции",  subtitle: "Тянь-Шань Цейсс-1000 d=1 м, купол Ø15 м, раздел. фундамент, IDA Dark Sky",        level: "L5", exercises: 4,  color: "blue"    },
  { id: "seismology-station",     category: "special",   href: "/smeta-trainer/drawings-practice/seismology-station",     icon: "🌍", title: "Сейсмостанции IMS CTBTO",          subtitle: "КНДЦ Курчатов, Streckeisen STS-2 360s, гранитный бункер 8 м, hyper-array, GPS ±10 нс", level: "L5", exercises: 4,  color: "zinc"    },

  // ── Экстремальные климатические зоны ──
  { id: "permafrost-objects",     category: "special",   href: "/smeta-trainer/drawings-practice/permafrost-objects",     icon: "❄️", title: "Объекты на вечной мерзлоте",      subtitle: "Сваи Long Yang, термосифоны СВВ-25 (CO₂), проветр. подполье H=1.5 м, СНиП 2.02.04", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "desert-objects",         category: "special",   href: "/smeta-trainer/drawings-practice/desert-objects",         icon: "🏜️", title: "Объекты в пустынной зоне",        subtitle: "Кызылкум +45°C, «русло-катушка» водосбор, Cool Roof, защита от «Афганец», СП РК 4.04", level: "L5", exercises: 4,  color: "yellow"  },
  { id: "mountain-resort",        category: "special",   href: "/smeta-trainer/drawings-practice/mountain-resort",        icon: "🎿", title: "Горнолыжные курорты",             subtitle: "Чимбулак 6-кр. Doppelmayr D-LINE, TechnoAlpin TR-V, галереи Daher, EN 1907",       level: "L5", exercises: 4,  color: "emerald" },

  // ── Сейсмостойкое и высотное строительство ──
  { id: "seismic-isolation",      category: "structure", href: "/smeta-trainer/drawings-practice/seismic-isolation",      icon: "🌐", title: "Сейсмоизоляция зданий",           subtitle: "Алматы 9-10 баллов, LRB Bridgestone + FPS + viscous damper, СН РК 2.03-30 + ASCE 7-22", level: "L5", exercises: 4,  color: "red"     },
  { id: "super-tall-buildings",   category: "structure", href: "/smeta-trainer/drawings-practice/super-tall-buildings",   icon: "🏙️", title: "Сверхвысотные здания 200+ м",     subtitle: "Abu Dhabi Plaza 320 м/88 эт., Outrigger + ядро C80, TMD 500 т, мегаколонны Ø2000 мм",  level: "L5", exercises: 4,  color: "sky"     },
  { id: "seismic-isolation-bridges", category: "structure", href: "/smeta-trainer/drawings-practice/seismic-isolation-bridges", icon: "🌉", title: "Сейсмостойкие мосты",          subtitle: "БАКАД эстакады, LRB Mageba + Taylor demper + Cable Restrainer, AASHTO LRFD Bridge", level: "L5", exercises: 4,  color: "slate"   },

  // ── Гидротехнические сооружения и аквакультура ──
  { id: "canals-irrigation",      category: "utilities", href: "/smeta-trainer/drawings-practice/canals-irrigation",      icon: "💧", title: "Магистральные каналы",            subtitle: "БАК 168 км Q=85 м³/с, Сатпаева 458 км, облицовка PCC C25/30 W6 F300, СНиП 2.06.03", level: "L5", exercises: 4,  color: "blue"    },
  { id: "caspian-ports",          category: "utilities", href: "/smeta-trainer/drawings-practice/caspian-ports",          icon: "⚓", title: "Каспийские морпорты",             subtitle: "Актау 10 млн т, больверк Larssen 32, защита от колебаний Каспия ±3 м, СНиП 2.06.04", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "aquaculture-farms",      category: "utilities", href: "/smeta-trainer/drawings-practice/aquaculture-farms",      icon: "🐟", title: "Аквакультура и рыбоводство",      subtitle: "RAS 200 т осётра/год, Wedeco УФ + озон, биофильтр K1, FAO Biosecurity",            level: "L5", exercises: 4,  color: "teal"    },

  // ── Космос, связь, гос. безопасность ──
  { id: "space-launch-facility",  category: "special",   href: "/smeta-trainer/drawings-practice/space-launch-facility",  icon: "🚀", title: "Космодромы и стартовые комплексы", subtitle: "Байтерек/Байконур, газоход B60 H=30 м, бункер ЛКЗ 6 м, Roscosmos РД-13", level: "L5", exercises: 4,  color: "violet"  },
  { id: "space-payload-processing", category: "special", href: "/smeta-trainer/drawings-practice/space-payload-processing", icon: "🛰️", title: "PIF Payload Integration Facility",   subtitle: "Байконур MIK 60×200×30, ISO 14644 кл.8+7, hydrazine fueling SCAPE suit, TVC + acoustic + EMC, ECSS-Q-ST-70-50", level: "L5", exercises: 4,  color: "violet"  },
  { id: "satellite-control-ground-station", category: "special", href: "/smeta-trainer/drawings-practice/satellite-control-ground-station", icon: "📡", title: "Спутниковые станции GS", subtitle: "Aizak Акколь Ка-band Ø13 м Cassegrain, G/T=48 dB/K, monopulse tracking 0.01°, AES-256+PKI, CCSDS+ITU-R", level: "L5", exercises: 4,  color: "blue"    },
  { id: "rocket-engine-test-stand", category: "special", href: "/smeta-trainer/drawings-practice/rocket-engine-test-stand", icon: "🚀", title: "Стенды ракетных двигателей",       subtitle: "Байконур РД-191 200 т thrust LOX/RP-1, vertical fired-down + deflector + ablation, water deluge 6000 л/с, NASA SP-8120", level: "L5", exercises: 4,  color: "orange"  },
  { id: "telecom-tower",          category: "special",   href: "/smeta-trainer/drawings-practice/telecom-tower",          icon: "📡", title: "Телебашни и радиовышки",          subtitle: "Кок-Тобе 372 м, решётка 420 т 80 мкм цинк, FAA L-810/L-864, FCC OET-65",   level: "L5", exercises: 4,  color: "zinc"    },
  { id: "government-akimat",      category: "special",   href: "/smeta-trainer/drawings-practice/government-akimat",      icon: "🏛️", title: "Парламент, Акиматы и гос. здания", subtitle: "Парламент РК 56 000 м², SCIF TEMPEST экран, ANSI/ASIS PCS, Anti-Ram болларды", level: "L5", exercises: 4,  color: "red"     },

  // ── Спец. технологические объекты ──
  { id: "desalination-plants",    category: "special",   href: "/smeta-trainer/drawings-practice/desalination-plants",    icon: "🌊", title: "Опреснительные станции SWRO",     subtitle: "МАЭК Актау 50 000 м³/сутки, Toray TM820V + ERI PX-300, NSF 61, WHO Guidelines", level: "L5", exercises: 4,  color: "blue"    },
  { id: "glass-factories",        category: "special",   href: "/smeta-trainer/drawings-practice/glass-factories",        icon: "🪟", title: "Стекольные заводы Float Glass",   subtitle: "Astana Glass 600 т/сут, печь Sorg + Float Bath Sn 50×7 м +1100°C, Pilkington", level: "L5", exercises: 4,  color: "lime"    },
  { id: "pharma-plants",          category: "special",   href: "/smeta-trainer/drawings-practice/pharma-plants",          icon: "💊", title: "Фармацевтические заводы GMP",     subtitle: "Химфарм Шымкент, классы A/B/C/D ISO 14644, HEPA H14, EU GMP Annex 1, WHO TRS 957", level: "L5", exercises: 4,  color: "slate"   },

  // ── Лёд, склад, магистраль ──
  { id: "ice-rink-arenas",        category: "special",   href: "/smeta-trainer/drawings-practice/ice-rink-arenas",        icon: "⛸️", title: "Ледовые арены",                   subtitle: "Барыс Арена 12 000 мест, IIHF 60×30 м, R717 NH₃ 1.2 МВт, ПБ 09-595, IIAR", level: "L5", exercises: 4,  color: "sky"     },
  { id: "logistics-warehouse",    category: "special",   href: "/smeta-trainer/drawings-practice/logistics-warehouse",    icon: "📦", title: "Склады класса А+ FEDIA",          subtitle: "Хоргос DAMU 100 000 м², ВРС 12 м, Jungheinrich + AS/RS, ESFR-спринклер, FEM 9.831", level: "L5", exercises: 4,  color: "zinc"    },
  { id: "bonded-warehouse-ftz",   category: "special",   href: "/smeta-trainer/drawings-practice/bonded-warehouse-ftz",   icon: "🛃", title: "Бондированные склады СЭЗ (FTZ)",  subtitle: "Хоргос ICBC 50 000 м², ТК ЕАЭС ст. 155-162, e-seal + АИС «Астана-1», WCO Kyoto", level: "L5", exercises: 4,  color: "zinc"    },
  { id: "highway-construction",   category: "special",   href: "/smeta-trainer/drawings-practice/highway-construction",   icon: "🛣️", title: "Магистрали и автобаны",           subtitle: "БАКАД 66 км, А1+ЩМА-15 SBS 210 мм, AASHTO LRFD + Superpave, СН РК 3.03-09",         level: "L5", exercises: 4,  color: "stone"   },

  // ── Оборона и стратегические объекты ──
  { id: "military-airbase",       category: "special",   href: "/smeta-trainer/drawings-practice/military-airbase",       icon: "✈️", title: "Военные аэродромы",               subtitle: "Жетыген Су-30СМ, ВПП 3500×60 B45 фибра, HAS бункеры, STANAG 3680 + ICAO 4F", level: "L5", exercises: 4,  color: "green"   },
  { id: "radar-stations",         category: "special",   href: "/smeta-trainer/drawings-practice/radar-stations",         icon: "📡", title: "РЛС и узлы связи",                subtitle: "Дарьял-У/П-18, антенна Ø11 м H=30 м, radome FRP, MIL-STD-188-125-1 EMP",  level: "L5", exercises: 4,  color: "violet"  },
  { id: "strategic-fuel-storage", category: "special",   href: "/smeta-trainer/drawings-practice/strategic-fuel-storage", icon: "⛽", title: "Стратегические нефтехранилища",   subtitle: "Атасу-Алашанькоу 500 000 т, 30 РВС-20000 понтон, AFFF + Boilover NFPA 30", level: "L5", exercises: 4,  color: "orange"  },

  // ── Экология и обращение с отходами ──
  { id: "landfill-tbo",           category: "process",   href: "/smeta-trainer/drawings-practice/landfill-tbo",           icon: "🗑️", title: "Полигоны ТБО (захоронение)",      subtitle: "Кеңқарасу 350 000 т/год, HDPE 2 мм + GCL Bentofix, биогаз КГЭС, EU 1999/31/EC", level: "L5", exercises: 4,  color: "lime"    },
  { id: "incinerator-plants",     category: "process",   href: "/smeta-trainer/drawings-practice/incinerator-plants",     icon: "🔥", title: "Мусоросжигание Waste-to-Energy",  subtitle: "Шымкент Veolia 500 т/сут, Martin grate +850°C×2 с, ESP+SCR+AC, EU IED Annex VI", level: "L5", exercises: 4,  color: "orange"  },
  { id: "recycling-plants",       category: "process",   href: "/smeta-trainer/drawings-practice/recycling-plants",       icon: "♻️", title: "Мусоросортировка MRF",            subtitle: "Алматы 500 т/сут, Tomra Autosort 5 NIR + Sutco BRT + Macpresse, EU 2008/98/EC",  level: "L5", exercises: 4,  color: "teal"    },

  // ── Спорт-вода / велотрек / медиа ──
  { id: "aquatic-center",         category: "practice",  href: "/smeta-trainer/drawings-practice/aquatic-center",         icon: "🏊", title: "Олимпийские аква-центры FINA",    subtitle: "Almaty Aquatics, 50×25 м + 10-м вышка, Vidrepur мозаика, 3300 м³/ч, FINA FR-2.2", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "velodrome-track",        category: "practice",  href: "/smeta-trainer/drawings-practice/velodrome-track",        icon: "🚴", title: "Крытые велотреки UCI",            subtitle: "Сарыарка 250 м, виражи R=23 м банк. 42°, Балтийск. сосна + Канадск. клён, UCI Tier 1", level: "L5", exercises: 4,  color: "sky"     },
  { id: "tv-radio-studio",        category: "practice",  href: "/smeta-trainer/drawings-practice/tv-radio-studio",        icon: "📺", title: "Теле- и радиостудии",             subtitle: "Хабар Астана, Room-in-Room Rw=65 дБ, Arri SkyPanel, бесшумная HVAC NR≤25, EBU 3253", level: "L5", exercises: 4,  color: "fuchsia" },

  // ── Медицина и АПК-инфраструктура ──
  { id: "dental-clinics",         category: "special",   href: "/smeta-trainer/drawings-practice/dental-clinics",         icon: "🦷", title: "Стоматологич. клиники премиум",   subtitle: "Damen Dental 6 каб., A-dec 500 + КТ NewTom 5G, ISO 8 для имплантологии, СанПиН 4.01-007", level: "L5", exercises: 4,  color: "pink"    },
  { id: "poultry-farms",          category: "special",   href: "/smeta-trainer/drawings-practice/poultry-farms",          icon: "🐔", title: "Птицефабрики (бройлеры)",         subtitle: "Шымкент-Кус 500 000 гол/год, Big Dutchman, климат 32→20°C, BSL птичий грипп",          level: "L5", exercises: 4,  color: "yellow"  },
  { id: "fruit-cold-storage",     category: "special",   href: "/smeta-trainer/drawings-practice/fruit-cold-storage",     icon: "🍎", title: "Плодоовощехранилища РГС ULO",     subtitle: "Алматинский Сад 5000 т, ULO O₂=1.5%/CO₂=2%, Janny MT, DCA HarvestWatch, FAO ISO 8328", level: "L5", exercises: 4,  color: "amber"   },

  // ── Магистральные ВОС, ТЭЦ, изотопы ──
  { id: "water-purification-large", category: "utilities", href: "/smeta-trainer/drawings-practice/water-purification-large", icon: "💧", title: "Магистральные ВОС муниципальные", subtitle: "Аккуль Алматы 500 000 м³/сут, DAF+UF Memcor+RO+УФ Wedeco, WHO 4th ed + AWWA",     level: "L5", exercises: 4,  color: "blue"    },
  { id: "district-heating",         category: "utilities", href: "/smeta-trainer/drawings-practice/district-heating",         icon: "🔥", title: "ТЭЦ и магистральная теплосеть",   subtitle: "Алматы ТЭЦ-1 380 МВт+1200 Гкал/ч, Babcock&Wilcox+SST-700, Ø1500 EN 13941",   level: "L5", exercises: 4,  color: "red"     },
  { id: "isotope-medical",          category: "utilities", href: "/smeta-trainer/drawings-practice/isotope-medical",          icon: "⚛️", title: "Циклотроны и изотопы (PET)",      subtitle: "ИЯФ Алматы Cyclone-30 IBA 30 МэВ, F-18/Ga-68, BPE+Heavy Concrete, IAEA SSG-46", level: "L5", exercises: 4,  color: "violet"  },

  // ── Образование, цирк, кино ──
  { id: "kindergarten-detsad",    category: "practice",  href: "/smeta-trainer/drawings-practice/kindergarten-detsad",    icon: "🧸", title: "Детские сады ДДУ",                subtitle: "ПДОП-150 мест Минпросвещ., 6 групп, KOMPAN + EPDM площадки, СанПиН РК 4.01-010", level: "L5", exercises: 4,  color: "yellow"  },
  { id: "circus-amphitheater",    category: "practice",  href: "/smeta-trainer/drawings-practice/circus-amphitheater",    icon: "🎪", title: "Цирки и амфитеатры",              subtitle: "Алматинский Гос. Цирк 2000 мест, манеж Ø13 м, Trafostore 24 лебёдки, FII",       level: "L5", exercises: 4,  color: "purple"  },
  { id: "cinema-multiplex",       category: "practice",  href: "/smeta-trainer/drawings-practice/cinema-multiplex",       icon: "🎬", title: "Мультиплексы и кинотеатры",       subtitle: "Chaplin 14 залов + IMAX Laser dual, Christie CP4440-RGB, Dolby Atmos 64-кан., DCI", level: "L5", exercises: 4,  color: "red"     },

  // ── Здравоохранение и сервис ──
  { id: "maternity-perinatal",    category: "practice",  href: "/smeta-trainer/drawings-practice/maternity-perinatal",    icon: "🤱", title: "Перинатальные центры и роддома",  subtitle: "РНЦМД Астана 350 коек, NICU III Drager Babyleo, операц. ISO 5, Code Pink Joint Comm", level: "L5", exercises: 4,  color: "pink"    },
  { id: "spa-wellness",           category: "practice",  href: "/smeta-trainer/drawings-practice/spa-wellness",           icon: "🌿", title: "СПА-курорты и термальные центры", subtitle: "Sary-Agash +60°C минер., 3 термальных бассейна, кедровые бочки, ESPA + DIN EN 15288",  level: "L5", exercises: 4,  color: "teal"    },
  { id: "veterinary-clinics",     category: "practice",  href: "/smeta-trainer/drawings-practice/veterinary-clinics",     icon: "🐾", title: "Ветеринарные клиники 24/7",       subtitle: "Vetlife Алматы 3000 м², PetCT Toshiba + IDEXX лаб., AAHA + OIE biosafety zoonoses",  level: "L5", exercises: 4,  color: "lime"    },

  // ── Наука, образование, спорт-2 ──
  { id: "national-library",       category: "practice",  href: "/smeta-trainer/drawings-practice/national-library",       icon: "📚", title: "Национальные библиотеки",         subtitle: "НАБ РК Foster 30 000 м², 1.5 млн томов, Bruynzeel Compactus + РГС O₂=3%, ISO 11799",  level: "L5", exercises: 4,  color: "indigo"  },
  { id: "ski-resort-snow",        category: "practice",  href: "/smeta-trainer/drawings-practice/ski-resort-snow",        icon: "⛷️", title: "Лыжные трамплины и биатлон",      subtitle: "Алатау K-90/K-125, Profiltex охлаждаемый Inrun, биатлон 30 мишеней Megalink ESA, FIS+IBU", level: "L5", exercises: 4,  color: "sky"     },
  { id: "summer-camp",            category: "practice",  href: "/smeta-trainer/drawings-practice/summer-camp",            icon: "⛺", title: "Детские оздоровит. лагеря",       subtitle: "Балдаурен Боровое 600 мест, 4 корпуса × 150 детей, ФОК+эстрада, СанПиН РК 4.01-015",   level: "L5", exercises: 4,  color: "lime"    },

  // ── Туризм, культура, наука-2 ──
  { id: "glamping-eco-tourism",   category: "practice",  href: "/smeta-trainer/drawings-practice/glamping-eco-tourism",   icon: "⛺", title: "Глэмпинги и эко-отели",           subtitle: "Charyn Canyon 20 юнитов, off-grid СЭС+LiFePO₄, Phoenix Composting, GSTC", level: "L5", exercises: 4,  color: "emerald" },
  { id: "art-conservatory",       category: "practice",  href: "/smeta-trainer/drawings-practice/art-conservatory",       icon: "🎼", title: "Консерватории муз./художеств.",   subtitle: "Курмангазы 18 000 м² 4 фак., shoebox концертн. зал RT60 1.8 с, Steinway D",  level: "L5", exercises: 4,  color: "violet"  },
  { id: "planetarium-science",    category: "practice",  href: "/smeta-trainer/drawings-practice/planetarium-science",    icon: "🪐", title: "Планетарии и научные музеи",      subtitle: "Алматы Ø22 м tilt 30°, 6× Carl Zeiss VELVET 4K HDR Laser, Dolby Atmos, IPS",   level: "L5", exercises: 4,  color: "blue"    },

  // ── IT-инфраструктура и образование 2.0 ──
  { id: "tech-park-incubator",    category: "practice",  href: "/smeta-trainer/drawings-practice/tech-park-incubator",    icon: "💻", title: "Технопарки и IT-инкубаторы",      subtitle: "Astana Hub 26 000 м², фальшпол 250 мм + 2600 Floor Box, WELL v2 Platinum, Stratasys F900", level: "L5", exercises: 4,  color: "cyan"    },
  { id: "coworking-flex-office",  category: "practice",  href: "/smeta-trainer/drawings-practice/coworking-flex-office",  icon: "🏢", title: "Коворкинги и гибкие офисы",       subtitle: "Multispace Алматы 280 мест, Framery O phone booths, VLAN per tenant, ANSI/ASA S12.60",  level: "L5", exercises: 4,  color: "orange"  },
  { id: "edutech-school-modern",  category: "practice",  href: "/smeta-trainer/drawings-practice/edutech-school-modern",  icon: "🎓", title: "EduTech-школы IB/Cambridge",      subtitle: "Quantum Алматы 800 учащ., 48 Promethean ActivPanel 75 inch, Stratasys F123 STEM, IB World",  level: "L5", exercises: 4,  color: "blue"    },

  // ── Финансы, спорт-2, наука-3 ──
  { id: "stock-exchange-fintech", category: "special",   href: "/smeta-trainer/drawings-practice/stock-exchange-fintech", icon: "📈", title: "Биржи и финтех-центры",           subtitle: "AIX/KASE 240 Bloomberg Terminal, Tier IV co-location, Dark Fiber NYSE/LSE, MiFID II",  level: "L5", exercises: 4,  color: "emerald" },
  { id: "stadium-large-football", category: "special",   href: "/smeta-trainer/drawings-practice/stadium-large-football", icon: "🏟️", title: "Большие стадионы 50 000+ мест",   subtitle: "Asgard 50 000 bowl, ETFE крыша 25 000 м², Desso GrassMaster + подогрев, FIFA Cat 4", level: "L5", exercises: 4,  color: "orange"  },
  { id: "research-lab-bsl4",      category: "special",   href: "/smeta-trainer/drawings-practice/research-lab-bsl4",      icon: "🦠", title: "BSL-4 лаборатории макс. биозащ.",  subtitle: "КНИИОИ Алматы, suit lab −30 Па тройн. HEPA H14, Trelleborg pos-pressure, ВОЗ 4th ed", level: "L5", exercises: 4,  color: "red"     },
  { id: "agriculture-research-institute", category: "special", href: "/smeta-trainer/drawings-practice/agriculture-research-institute", icon: "🌱", title: "Агро-НИИ + генбанки растений",   subtitle: "КазНИИЗР Алмалыбак 7000 сортов, Venlo 1 га Priva, генбанк −18/−180 °C 6000 м³, FAO ITPGRFA", level: "L5", exercises: 4,  color: "lime"    },
  { id: "vertical-farm-hydroponic", category: "special", href: "/smeta-trainer/drawings-practice/vertical-farm-hydroponic", icon: "🌿", title: "Vertical Farm CEA hydroponic",   subtitle: "Almaty Vertical 1000 м²×12 уровней NFT/DWC, LED Philips GreenPower, recirculation 95% Cornell CEA", level: "L5", exercises: 4,  color: "emerald" },
  { id: "honey-apiary-bee-genetics", category: "special", href: "/smeta-trainer/drawings-practice/honey-apiary-bee-genetics", icon: "🐝", title: "Пчеловодство + селекция",          subtitle: "Катон-Карагай 1000 ульев Buckfast hybrid, Lega medogonka, BLUP-селекция, FAO Bee Health + OIE", level: "L5", exercises: 4,  color: "amber"   },
  { id: "forest-nursery-saplings", category: "special",  href: "/smeta-trainer/drawings-practice/forest-nursery-saplings", icon: "🌲", title: "Лесопитомники саженцев",          subtitle: "«Жетысу» 5 млн container Plantek 81F, mycorrhiza Suillus, Жасыл Қазақстан 2 млрд, FAO Forest Reproductive", level: "L5", exercises: 4,  color: "green"   },
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
