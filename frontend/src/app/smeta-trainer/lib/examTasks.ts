import type { Lsr, LearningObject } from "./types";

/**
 * Банк экзаменационных заданий с эталонами и стартовыми шаблонами.
 * Каждое задание содержит типовую ошибку, которую студент должен заметить.
 */

export interface ExamTask {
  id: string;
  title: string;
  category: "Отделка" | "Кровля" | "Фундамент" | "Электромонтаж" | "Сантехника";
  difficulty: "лёгкая" | "средняя" | "сложная";
  durationMin: number;
  icon: string;
  /** Какую типовую ошибку «прячет» стартовый шаблон. */
  hiddenError: string;
  object: LearningObject;
  reference: Lsr;
  starter: Lsr;
  hints: string[];
}

const PRICE_DATE = "декабрь 2025 г.";
const QUARTER = "2026-Q2";
const REGION = "Алматы";

function mkLsr(args: { id: string; title: string; objectId: string; sections: Lsr["sections"]; lsrNumber: string }): Lsr {
  return {
    id: args.id,
    title: args.title,
    objectId: args.objectId,
    method: "базисно-индексный",
    indexQuarter: QUARTER,
    indexRegion: REGION,
    meta: { lsrNumber: args.lsrNumber, priceDate: PRICE_DATE, osnovanje: "Задание экзамена" },
    sections: args.sections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* =========================================================================
 *  ЗАДАНИЕ 1 — Отделка двух классов после протечки кровли (лёгкая)
 * ========================================================================= */
const T1_OBJECT: LearningObject = {
  id: "exam-school-47-classroom",
  title: "СОШ №47, восстановление двух классов",
  type: "капремонт",
  region: REGION,
  description:
    "Класс 305 + класс 306 на 3-м этаже. Каждый 9.0 × 6.0 × 3.3 м, 2 окна 1.4×1.6 и 1 дверь 0.9×2.1. Школа функционирует.",
  geometry: {
    kind: "room",
    length: 9.0,
    width: 6.0,
    height: 3.3,
    openings: [
      { kind: "window", width: 1.4, height: 1.6, count: 4 },
      { kind: "door", width: 0.9, height: 2.1, count: 2 },
    ],
  },
  attachments: [],
};

const T1_REFERENCE = mkLsr({
  id: "exam-t1-ref",
  title: "Эталон — отделка двух классов",
  objectId: T1_OBJECT.id,
  lsrNumber: "exam-t1",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Демонтаж", category: "демонтажные",
      positions: [
        { id: "rp1", rateCode: "ДЕМ-15-01-001", volume: 1.08, coefficients: [], formula: "(9×6)×2 / 100 = 1.08" },
        { id: "rp2", rateCode: "ДЕМ-11-02-001", volume: 1.08, coefficients: [], formula: "(9×6)×2 / 100 = 1.08" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Штукатурка/окраска стен", category: "отделочные",
      positions: [
        { id: "rp3", rateCode: "ОТД-13-01-001", volume: 1.85, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" }], formula: "(2×(9+6)×3.3)×2 − 12.74 = 185.26 / 100 = 1.85" },
        { id: "rp4", rateCode: "ОТД-15-04-001", volume: 1.85, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" }], formula: "185.26 / 100 = 1.85" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Полы", category: "отделочные",
      positions: [
        { id: "rp5", rateCode: "ОТД-11-04-002", volume: 1.08, coefficients: [], formula: "108 / 100 = 1.08" },
      ],
    },
  ],
});

const T1_STARTER = mkLsr({
  id: "exam-t1-student",
  title: "Моё решение",
  objectId: T1_OBJECT.id,
  lsrNumber: "exam-t1",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Демонтаж", category: "демонтажные",
      positions: [
        { id: "sp1", rateCode: "ДЕМ-15-01-001", volume: 1.08, coefficients: [], formula: "108 / 100" },
        { id: "sp2", rateCode: "ДЕМ-11-02-001", volume: 1.08, coefficients: [], formula: "108 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Отделка стен", category: "отделочные",
      positions: [
        { id: "sp3", rateCode: "ОТД-13-01-001", volume: 1.98, coefficients: [], formula: "(2×(9+6)×3.3)×2 / 100 — без вычета проёмов" },
        { id: "sp4", rateCode: "ОТД-15-04-001", volume: 1.98, coefficients: [], formula: "1.98 (брутто)" },
      ],
    },
    {
      id: "stu-s3", title: "Раздел 3. Полы", category: "отделочные",
      positions: [
        { id: "sp5", rateCode: "ОТД-11-04-002", volume: 1.08, coefficients: [], formula: "108 / 100" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 2 — Замена плоской кровли спортзала (средняя)
 * ========================================================================= */
const T2_OBJECT: LearningObject = {
  id: "exam-school-gym-roof",
  title: "СОШ №47, замена плоской кровли спортзала",
  type: "капремонт",
  region: REGION,
  description:
    "Плоская кровля спортзала 15 × 25 м (375 м²) — старое покрытие демонтировано. Нужно: пароизоляция → утепление мин.ватой 100 мм → 2 слоя наплавляемого ковра.",
  attachments: [],
};

const T2_REFERENCE = mkLsr({
  id: "exam-t2-ref",
  title: "Эталон — кровля спортзала",
  objectId: T2_OBJECT.id,
  lsrNumber: "exam-t2",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Подготовительные слои", category: "кровельные",
      positions: [
        { id: "rp1", rateCode: "КРВ-12-03-001", volume: 3.75, coefficients: [], formula: "15×25 = 375 / 100 = 3.75 (пароизоляция)" },
        { id: "rp2", rateCode: "КРВ-12-02-001", volume: 3.75, coefficients: [], formula: "375 / 100 = 3.75 (утепление 100мм)" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Кровельный ковёр", category: "кровельные",
      positions: [
        { id: "rp3", rateCode: "КРВ-12-01-001", volume: 3.75, coefficients: [], formula: "375 / 100 = 3.75 (2 слоя наплавляемого)" },
      ],
    },
  ],
});

const T2_STARTER = mkLsr({
  id: "exam-t2-student",
  title: "Моё решение",
  objectId: T2_OBJECT.id,
  lsrNumber: "exam-t2",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Кровельный пирог", category: "кровельные",
      positions: [
        { id: "sp1", rateCode: "КРВ-12-03-001", volume: 3.75, coefficients: [], formula: "375 / 100" },
        // ОШИБКА: пропущено утепление (КРВ-12-02-001)
        { id: "sp2", rateCode: "КРВ-12-01-001", volume: 3.75, coefficients: [], formula: "375 / 100" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 3 — Фундамент частного дома 8×10 м (сложная)
 * ========================================================================= */
const T3_OBJECT: LearningObject = {
  id: "exam-cottage-foundation",
  title: "Частный дом 8×10 м, монолитная плита",
  type: "новое-строительство",
  region: REGION,
  description:
    "Жилой дом площадью 80 м² (8×10), монолитная фундаментная плита толщиной 400 мм. Грунт II категории, глубина заложения 1.5 м. Сначала разработка котлована, потом подготовка 100 мм, армирование, бетонирование, обратная засыпка пазух.",
  attachments: [],
};

const T3_REFERENCE = mkLsr({
  id: "exam-t3-ref",
  title: "Эталон — фундамент дома",
  objectId: T3_OBJECT.id,
  lsrNumber: "exam-t3",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Земляные работы", category: "земляные",
      positions: [
        { id: "rp1", rateCode: "ЗЕМ-01-01-002", volume: 1.20, coefficients: [], formula: "8×10×1.5 = 120 м³ / 100 = 1.20" },
        { id: "rp2", rateCode: "ЗЕМ-01-03-001", volume: 0.40, coefficients: [], formula: "Обратная засыпка пазух ~40 м³ / 100 = 0.40" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Подготовка и опалубка", category: "общестроительные",
      positions: [
        { id: "rp3", rateCode: "ФУН-05-03-001", volume: 8.00, coefficients: [], formula: "80 м² × 0.1 = 8.0 м³ (подготовка)" },
        { id: "rp4", rateCode: "ФУН-05-02-001", volume: 14.4, coefficients: [], formula: "(8+10)×2×0.4 = 14.4 м² (опалубка по периметру)" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Армирование и бетон", category: "общестроительные",
      positions: [
        { id: "rp5", rateCode: "ФУН-06-01-001", volume: 2.40, coefficients: [], formula: "75 кг/м³ × 32 м³ ≈ 2.4 т" },
        { id: "rp6", rateCode: "ФУН-05-01-001", volume: 32.0, coefficients: [], formula: "80 м² × 0.4 = 32 м³" },
      ],
    },
  ],
});

const T3_STARTER = mkLsr({
  id: "exam-t3-student",
  title: "Моё решение",
  objectId: T3_OBJECT.id,
  lsrNumber: "exam-t3",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Земля", category: "земляные",
      // ОШИБКА: использована грунт I категории (хотя задание прямо говорит II)
      positions: [
        { id: "sp1", rateCode: "ЗЕМ-01-01-001", volume: 1.20, coefficients: [], formula: "8×10×1.5 / 100" },
        { id: "sp2", rateCode: "ЗЕМ-01-03-001", volume: 0.40, coefficients: [], formula: "Засыпка 40 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Бетон", category: "общестроительные",
      // ОШИБКА: пропущена опалубка (formworkMissing должно сработать)
      positions: [
        { id: "sp3", rateCode: "ФУН-05-03-001", volume: 8.00, coefficients: [], formula: "80 × 0.1 = 8" },
        { id: "sp4", rateCode: "ФУН-06-01-001", volume: 2.40, coefficients: [], formula: "2.4 т" },
        { id: "sp5", rateCode: "ФУН-05-01-001", volume: 32.0, coefficients: [], formula: "80 × 0.4 = 32" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 4 — Электромонтаж в офисе 60 м² (средняя)
 * ========================================================================= */
const T4_OBJECT: LearningObject = {
  id: "exam-office-electrical",
  title: "Электромонтаж офиса 60 м²",
  type: "текущий-ремонт",
  region: REGION,
  description:
    "Полная переразводка электрики в офисе 60 м² (3 комнаты по 5×4 м). По проекту: кабель ВВГнг 3×2.5 ~120 м (с запасом на штробы), 12 розеток, 6 выключателей, 8 светильников LED, 1 щит на 12 автоматов.",
  attachments: [],
};

const T4_REFERENCE = mkLsr({
  id: "exam-t4-ref",
  title: "Эталон — электрика офиса",
  objectId: T4_OBJECT.id,
  lsrNumber: "exam-t4",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Кабельные сети", category: "электромонтажные",
      positions: [
        { id: "rp1", rateCode: "ЭЛ-21-04-007", volume: 120, coefficients: [], formula: "120 м кабеля ВВГнг 3×2.5" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Установочные изделия", category: "электромонтажные",
      positions: [
        { id: "rp2", rateCode: "ЭЛ-21-02-001", volume: 12, coefficients: [], formula: "12 розеток" },
        { id: "rp3", rateCode: "ЭЛ-21-06-001", volume: 6, coefficients: [], formula: "6 выключателей" },
        { id: "rp4", rateCode: "ЭЛ-21-03-001", volume: 8, coefficients: [], formula: "8 светильников LED" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Распределительный щит", category: "электромонтажные",
      positions: [
        { id: "rp5", rateCode: "ЭЛ-21-05-001", volume: 1, coefficients: [], formula: "1 щит на 12 автоматов" },
      ],
    },
  ],
});

const T4_STARTER = mkLsr({
  id: "exam-t4-student",
  title: "Моё решение",
  objectId: T4_OBJECT.id,
  lsrNumber: "exam-t4",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Электромонтаж", category: "электромонтажные",
      // ОШИБКА: занижена длина кабеля (45 м вместо 120 м — типичный «по прямой» расчёт)
      positions: [
        { id: "sp1", rateCode: "ЭЛ-21-04-007", volume: 45, coefficients: [], formula: "По прямой между приборами" },
        { id: "sp2", rateCode: "ЭЛ-21-02-001", volume: 12, coefficients: [], formula: "12 розеток" },
        { id: "sp3", rateCode: "ЭЛ-21-06-001", volume: 6, coefficients: [], formula: "6 выключателей" },
        { id: "sp4", rateCode: "ЭЛ-21-03-001", volume: 8, coefficients: [], formula: "8 светильников" },
        { id: "sp5", rateCode: "ЭЛ-21-05-001", volume: 1, coefficients: [], formula: "1 щит" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 5 — Сантехника санузла в квартире (средняя)
 * ========================================================================= */
const T5_OBJECT: LearningObject = {
  id: "exam-bathroom-plumbing",
  title: "Сантехника санузла в квартире",
  type: "текущий-ремонт",
  region: REGION,
  description:
    "Совмещённый санузел 2.0 × 1.8 м, высота 2.7 м. Замена труб водопровода (ХВС и ГВС, по 12 м каждый контур = 24 м всего), установка унитаза, умывальника, плитка стен и пола.",
  attachments: [],
};

const T5_REFERENCE = mkLsr({
  id: "exam-t5-ref",
  title: "Эталон — сантехника санузла",
  objectId: T5_OBJECT.id,
  lsrNumber: "exam-t5",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Водопровод", category: "сантехнические",
      positions: [
        { id: "rp1", rateCode: "СНТ-16-03-001", volume: 0.24, coefficients: [], formula: "24 м (ХВС 12 + ГВС 12) / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Сантехприборы", category: "сантехнические",
      positions: [
        { id: "rp2", rateCode: "СНТ-16-04-001", volume: 1, coefficients: [], formula: "1 унитаз" },
        { id: "rp3", rateCode: "СНТ-16-05-001", volume: 1, coefficients: [], formula: "1 умывальник" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Облицовка", category: "отделочные",
      positions: [
        { id: "rp4", rateCode: "ОТД-15-05-001", volume: 0.205, coefficients: [], formula: "2×(2.0+1.8)×2.7 = 20.5 м² / 100" },
        { id: "rp5", rateCode: "ОТД-11-03-001", volume: 0.036, coefficients: [], formula: "2.0×1.8 = 3.6 м² / 100" },
      ],
    },
  ],
});

const T5_STARTER = mkLsr({
  id: "exam-t5-student",
  title: "Моё решение",
  objectId: T5_OBJECT.id,
  lsrNumber: "exam-t5",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Сантехника", category: "сантехнические",
      // ОШИБКА: учтён только один контур труб (12 м вместо 24 м — забыли ГВС)
      positions: [
        { id: "sp1", rateCode: "СНТ-16-03-001", volume: 0.12, coefficients: [], formula: "ХВС 12 м / 100 (забыли ГВС)" },
        { id: "sp2", rateCode: "СНТ-16-04-001", volume: 1, coefficients: [], formula: "1 унитаз" },
        { id: "sp3", rateCode: "СНТ-16-05-001", volume: 1, coefficients: [], formula: "1 умывальник" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Плитка", category: "отделочные",
      positions: [
        { id: "sp4", rateCode: "ОТД-15-05-001", volume: 0.205, coefficients: [], formula: "20.5 / 100" },
        { id: "sp5", rateCode: "ОТД-11-03-001", volume: 0.036, coefficients: [], formula: "3.6 / 100" },
      ],
    },
  ],
});

/* ========================================================================= */

export const EXAM_TASKS: ExamTask[] = [
  {
    id: "finishing-classroom",
    title: "Отделка двух классов после протечки",
    category: "Отделка",
    difficulty: "лёгкая",
    durationMin: 25,
    icon: "🎨",
    hiddenError: "Стены посчитаны брутто без вычета проёмов; нет коэффициента действующего объекта",
    object: T1_OBJECT,
    reference: T1_REFERENCE,
    starter: T1_STARTER,
    hints: [
      "Стены: проёмы (окна и двери) вычитаются из брутто-площади",
      "Школа функционирует — К=1.15 (СН РК 8.02-10)",
    ],
  },
  {
    id: "gym-flat-roof",
    title: "Замена плоской кровли спортзала",
    category: "Кровля",
    difficulty: "средняя",
    durationMin: 20,
    icon: "🏠",
    hiddenError: "Пропущено утепление между пароизоляцией и кровельным ковром",
    object: T2_OBJECT,
    reference: T2_REFERENCE,
    starter: T2_STARTER,
    hints: [
      "Стандартный пирог утеплённой кровли: пароизоляция → утеплитель → ковёр",
      "Все три слоя одинаковой площади 375 м²",
    ],
  },
  {
    id: "cottage-foundation",
    title: "Монолитный фундамент частного дома",
    category: "Фундамент",
    difficulty: "сложная",
    durationMin: 35,
    icon: "🧱",
    hiddenError: "Грунт I категории вместо II из задания; пропущена опалубка плиты",
    object: T3_OBJECT,
    reference: T3_REFERENCE,
    starter: T3_STARTER,
    hints: [
      "В задании указана II категория грунта — используйте соответствующий шифр",
      "Монолитная плита требует опалубку по периметру (ФУН-05-02-001)",
    ],
  },
  {
    id: "office-electrical",
    title: "Электромонтаж офиса 60 м²",
    category: "Электромонтаж",
    difficulty: "средняя",
    durationMin: 25,
    icon: "⚡",
    hiddenError: "Длина кабеля занижена — посчитана по прямой, без учёта штроб и петель",
    object: T4_OBJECT,
    reference: T4_REFERENCE,
    starter: T4_STARTER,
    hints: [
      "Кабель идёт по штробам по стенам и в потолке, длина 2-2.5× от прямой",
      "По проекту указано 120 м с запасом — используйте проектное значение",
    ],
  },
  {
    id: "bathroom-plumbing",
    title: "Сантехника санузла в квартире",
    category: "Сантехника",
    difficulty: "средняя",
    durationMin: 20,
    icon: "🚿",
    hiddenError: "Учтён только контур ХВС, забыли ГВС (горячее водоснабжение)",
    object: T5_OBJECT,
    reference: T5_REFERENCE,
    starter: T5_STARTER,
    hints: [
      "Прокладывают два независимых контура труб — ХВС и ГВС",
      "Суммарная длина = ХВС + ГВС = 12 + 12 = 24 м (объём в позиции — 0.24, ед. «100 м»)",
    ],
  },
];

export function findExamTask(id: string): ExamTask | undefined {
  return EXAM_TASKS.find((t) => t.id === id);
}
