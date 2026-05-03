import type { Lsr } from "./types";

export interface LevelDef {
  num: number;
  role: string;
  title: string;
  icon: string;
  timeHours: number;
  objective: string;
  description: string;
  zachetCriteria: string;
  /** ID урока в курсе smeta-rk-kurs для перехода из LMS. */
  lessonRef?: string;
}

export const LEVELS: LevelDef[] = [
  {
    num: 1,
    role: "С нуля",
    title: "Читаю смету",
    icon: "📖",
    timeHours: 4,
    objective: "Снять страх перед сметным документом. Понять структуру ЛСР.",
    description: "Перед вами готовая ЛСР на отделочные работы крыла А школы №47. Изучите её и ответьте на 15 вопросов. Зачёт: ≥12 правильных ответов.",
    zachetCriteria: "≥ 12 из 15 правильных ответов",
    lessonRef: "lesson-2-1",
  },
  {
    num: 2,
    role: "Пользователь",
    title: "Составляю ЛСР",
    icon: "✍️",
    timeHours: 12,
    objective: "Самостоятельно составить ЛСР на отделочные работы крыла Б.",
    description: "Составьте ЛСР «Отделочные работы крыла Б школы №47»: подсчитайте объёмы, внесите позиции, примените коэффициент действующего объекта, выберите индексы.",
    zachetCriteria: "Все позиции дефектной ведомости + ВОР с формулами + коэффициент",
    lessonRef: "lesson-2-2",
  },
  {
    num: 3,
    role: "ПТО",
    title: "Веду исполнительные",
    icon: "📋",
    timeHours: 16,
    objective: "Вести актирование выполненных работ — КС-2 за 6 месяцев.",
    description: "Вы — инженер ПТО. Работы по крылу Б идут с июня по ноябрь. По журналу работ составьте КС-2 за каждый месяц. В августе — допработы по дефектному акту.",
    zachetCriteria: "6 КС-2 + КС-3 нарастающим итогом + доп. смета",
    lessonRef: "lesson-2-3",
  },
  {
    num: 4,
    role: "Проектировщик",
    title: "Полный комплект",
    icon: "📐",
    timeHours: 24,
    objective: "Подготовить полный комплект сметной документации под госэкспертизу.",
    description: "Составьте полный комплект: несколько ЛСР (отделка, кровля, сантех, электро), объектную смету, сводный сметный расчёт по 12 главам.",
    zachetCriteria: "Комплект из 4 ЛСР + объектная смета + ССР с заполненными главами",
    lessonRef: "lesson-2-4",
  },
  {
    num: 5,
    role: "Эксперт",
    title: "Нахожу ошибки",
    icon: "🔍",
    timeHours: 8,
    objective: "Провести экспертизу смети с заложенными ошибками.",
    description: "В этой смете специально заложено 7 ошибок — от грубых до технических. Найдите все, опишите и дайте заключение. Зачёт: найти ≥5 ошибок с обоснованием.",
    zachetCriteria: "Найти ≥ 5 из 7 ошибок с нормативным обоснованием",
    lessonRef: "lesson-2-5",
  },
];

// Готовая ЛСР крыла А для чтения (уровень 1)
// Реальные учебные объёмы: крыло А = крыло Б (симметричное здание)
export const LEVEL1_LSR: Lsr = {
  id: "lsr-wing-a-readonly",
  title: "ЛСР — Отделочные работы крыла А школы №47, г. Алматы",
  objectId: "school-47-wing-b",
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  meta: {
    strojkaTitle: "Капитальный ремонт СОШ №47, г. Алматы",
    strojkaCode: "02-2026-ПВП 20",
    objectTitle: "Учебный корпус, крыло А — классные комнаты 1–4 этаж",
    objectCode: "2-01",
    lsrNumber: "2-01-01-01",
    worksTitle: "Демонтажные и отделочные работы крыла А",
    osnovanje: "РП Том 2. Альбом 1. Черт. ОР-01..04",
    priceDate: "декабрь 2025 г.",
    author: "Мырзахметова М.Б.",
  },
  sections: [
    {
      id: "s1-demont",
      title: "Раздел 1. Демонтажные работы",
      category: "демонтажные",
      positions: [
        { id: "p1", rateCode: "ДЕМ-15-01-001", volume: 28.80, coefficients: [], formula: "32 кл × 90 м² = 2880 м²; 2880/100 = 28.80 (100 м²)", drawingRef: "ОР-01, 02" },
        { id: "p2", rateCode: "ДЕМ-11-02-001", volume: 18.00, coefficients: [], formula: "32 кл × 48.75 м² + коридоры 240 м² = 1800 м²; /100 = 18.00", drawingRef: "ОР-01" },
        { id: "p3", rateCode: "ДЕМ-06-01-001", volume: 64, coefficients: [], formula: "32 кл × 2 окна/кл = 64 шт", drawingRef: "ОР-03" },
        { id: "p4", rateCode: "ДЕМ-06-02-001", volume: 32, coefficients: [], formula: "32 кл × 1 дверь/кл = 32 шт", drawingRef: "ОР-03" },
      ],
    },
    {
      id: "s2-shtuk",
      title: "Раздел 2. Штукатурно-шпатлёвочные работы",
      category: "отделочные",
      positions: [
        { id: "p5", rateCode: "ОТД-13-01-001", volume: 26.99, coefficients: [], formula: "(32 × 90.33) / 100 = 28.91 — уже оштукатурены 2 стены; нетто = 26.99 (100 м²)", drawingRef: "ОР-02" },
        { id: "p6", rateCode: "ОТД-15-02-003", volume: 26.99, coefficients: [], formula: "Площадь под шпатлёвку = площадь под окраску = 2699 м² / 100 = 26.99", drawingRef: "ОР-02" },
      ],
    },
    {
      id: "s3-otdelka",
      title: "Раздел 3. Окраска",
      category: "отделочные",
      positions: [
        { id: "p7", rateCode: "ОТД-15-04-001", volume: 26.99, coefficients: [], formula: "Стены нетто: 32 × (90 − 3.78 − 1.89) = 2699 м² / 100 = 26.99", drawingRef: "ОР-02" },
        { id: "p8", rateCode: "ОТД-15-06-005", volume: 217.6, coefficients: [], formula: "Откосы окон: 64 × (2.1+1.8)×2 × 0.15 = 74.9 м² + двери 32 × 2.1×2×0.15 = 20.2 м²; потолки откосов: 98.5 м²", drawingRef: "ОР-03" },
      ],
    },
    {
      id: "s4-poly",
      title: "Раздел 4. Полы",
      category: "отделочные",
      positions: [
        { id: "p9", rateCode: "ОТД-11-02-001", volume: 18.00, coefficients: [], formula: "1800 м² (весь этаж) / 100 = 18.00", drawingRef: "ОР-01" },
        { id: "p10", rateCode: "ОТД-11-04-002", volume: 15.60, coefficients: [], formula: "Только классы: 32 × 48.75 = 1560 м²; /100 = 15.60", drawingRef: "ОР-01" },
      ],
    },
    {
      id: "s5-okna",
      title: "Раздел 5. Окна и двери",
      category: "отделочные",
      positions: [
        { id: "p11", rateCode: "ОТД-06-02-001", volume: 143.36, coefficients: [], formula: "64 окна × 1.4×1.6 = 143.36 м²", drawingRef: "ОР-03" },
        { id: "p12", rateCode: "ОТД-06-01-001", volume: 32, coefficients: [], formula: "32 двери", drawingRef: "ОР-03" },
      ],
    },
  ],
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
};

// ЛСР с заложенными ошибками для уровня 5
export const LEVEL5_LSR: Lsr = {
  id: "lsr-expert-wing-a-errors",
  title: "ЛСР — Отделочные и электромонтажные работы крыла В (с ошибками)",
  objectId: "school-47-wing-b",
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  meta: {
    strojkaTitle: "Капитальный ремонт СОШ №47, г. Алматы",
    strojkaCode: "02-2026-ПВП 20",
    objectTitle: "Учебный корпус, крыло В",
    objectCode: "2-03",
    lsrNumber: "2-03-01-01",
    worksTitle: "Отделочные и электромонтажные работы",
    priceDate: "декабрь 2025 г.",
    author: "Байжанов А.К.",
  },
  sections: [
    {
      id: "se1",
      title: "Раздел 1. Демонтажные работы",
      category: "общестроительные", // ОШИБКА err-02: должно быть "демонтажные"
      positions: [
        { id: "pe1", rateCode: "ДЕМ-15-01-001", volume: 28.80, coefficients: [], formula: "32 × 90 = 2880 / 100 (без вычета проёмов)", drawingRef: "ВС-01" },
        { id: "pe2", rateCode: "ДЕМ-11-02-001", volume: 18.00, coefficients: [], formula: "1800 / 100", drawingRef: "ВС-01" },
      ],
    },
    {
      id: "se2",
      title: "Раздел 2. Штукатурно-шпатлёвочные работы",
      category: "отделочные",
      positions: [
        { id: "pe3", rateCode: "ОТД-13-01-001", volume: 28.80, coefficients: [], formula: "32 × 90 = 2880 / 100 (без вычета проёмов — ОШИБКА err-01)", drawingRef: "ВС-02" },
        { id: "pe4", rateCode: "ОТД-15-02-003", volume: 28.80, coefficients: [], formula: "28.80", drawingRef: "ВС-02" },
      ],
    },
    {
      id: "se3",
      title: "Раздел 3. Окраска и облицовка",
      category: "отделочные",
      positions: [
        { id: "pe5", rateCode: "ОТД-15-04-001", volume: 28.80, coefficients: [], formula: "28.80 (100 м²)", drawingRef: "ВС-02" },
        { id: "pe6", rateCode: "ОТД-15-02-003", volume: 28.80, coefficients: [], formula: "ОШИБКА err-03: дублирует раздел 2", drawingRef: "ВС-02" },
      ],
    },
    {
      id: "se4",
      title: "Раздел 4. Полы",
      category: "отделочные",
      positions: [
        { id: "pe7", rateCode: "ОТД-11-02-001", volume: 18.00, coefficients: [], formula: "1800 / 100", drawingRef: "ВС-01" },
        { id: "pe8", rateCode: "ОТД-11-04-002", volume: 15.60, coefficients: [], formula: "1560 / 100", drawingRef: "ВС-01" },
      ],
    },
    {
      id: "se5",
      title: "Раздел 5. Электромонтажные работы",
      category: "электромонтажные",
      positions: [
        // ОШИБКА err-05: volume должен быть в "100 м" (1.5), здесь стоит 150 штук
        { id: "pe9", rateCode: "ЭЛ-21-04-007", volume: 150, coefficients: [], formula: "150 шт кабеля (ОШИБКА: ед.изм. должна быть м, объём — 150 м = 1.5 (100 м))", drawingRef: "ЭС-01" },
        { id: "pe10", rateCode: "ЭЛ-21-02-001", volume: 96, coefficients: [], formula: "32 кл × 3 розетки = 96 шт", drawingRef: "ЭС-01" },
        { id: "pe11", rateCode: "ЭЛ-21-03-001", volume: 64, coefficients: [], formula: "32 кл × 2 светильника = 64 шт", drawingRef: "ЭС-01" },
      ],
    },
  ],
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
};
