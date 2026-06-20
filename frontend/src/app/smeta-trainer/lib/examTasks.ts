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
        { id: "rp1", rateCode: "ЭСНСб15-01.Д-001", volume: 1.08, coefficients: [], formula: "(9×6)×2 / 100 = 1.08" },
        { id: "rp2", rateCode: "ЭСНСб11-02.Д-001", volume: 1.08, coefficients: [], formula: "(9×6)×2 / 100 = 1.08" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Штукатурка/окраска стен", category: "отделочные",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб15-13-01-001", volume: 1.85, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" }], formula: "(2×(9+6)×3.3)×2 − 12.74 = 185.26 / 100 = 1.85" },
        { id: "rp4", rateCode: "ЭСНСб15-15-04-001", volume: 1.85, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" }], formula: "185.26 / 100 = 1.85" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Полы", category: "отделочные",
      positions: [
        { id: "rp5", rateCode: "ЭСНСб15-11-04-002", volume: 1.08, coefficients: [], formula: "108 / 100 = 1.08" },
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
        { id: "sp1", rateCode: "ЭСНСб15-01.Д-001", volume: 1.08, coefficients: [], formula: "108 / 100" },
        { id: "sp2", rateCode: "ЭСНСб11-02.Д-001", volume: 1.08, coefficients: [], formula: "108 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Отделка стен", category: "отделочные",
      positions: [
        { id: "sp3", rateCode: "ЭСНСб15-13-01-001", volume: 1.98, coefficients: [], formula: "(2×(9+6)×3.3)×2 / 100 — без вычета проёмов" },
        { id: "sp4", rateCode: "ЭСНСб15-15-04-001", volume: 1.98, coefficients: [], formula: "1.98 (брутто)" },
      ],
    },
    {
      id: "stu-s3", title: "Раздел 3. Полы", category: "отделочные",
      positions: [
        { id: "sp5", rateCode: "ЭСНСб15-11-04-002", volume: 1.08, coefficients: [], formula: "108 / 100" },
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
        { id: "rp1", rateCode: "ЭСНСб12-12-03-001", volume: 3.75, coefficients: [], formula: "15×25 = 375 / 100 = 3.75 (пароизоляция)" },
        { id: "rp2", rateCode: "ЭСНСб12-12-02-001", volume: 3.75, coefficients: [], formula: "375 / 100 = 3.75 (утепление 100мм)" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Кровельный ковёр", category: "кровельные",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб12-12-01-001", volume: 3.75, coefficients: [], formula: "375 / 100 = 3.75 (2 слоя наплавляемого)" },
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
        { id: "sp1", rateCode: "ЭСНСб12-12-03-001", volume: 3.75, coefficients: [], formula: "375 / 100" },
        // ОШИБКА: пропущено утепление (ЭСНСб12-12-02-001)
        { id: "sp2", rateCode: "ЭСНСб12-12-01-001", volume: 3.75, coefficients: [], formula: "375 / 100" },
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
        { id: "rp1", rateCode: "ЭСНСб01-01-01-002", volume: 1.20, coefficients: [], formula: "8×10×1.5 = 120 м³ / 100 = 1.20" },
        { id: "rp2", rateCode: "ЭСНСб01-01-03-001", volume: 0.40, coefficients: [], formula: "Обратная засыпка пазух ~40 м³ / 100 = 0.40" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Подготовка и опалубка", category: "общестроительные",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб06-05-03-001", volume: 8.00, coefficients: [], formula: "80 м² × 0.1 = 8.0 м³ (подготовка)" },
        { id: "rp4", rateCode: "ЭСНСб06-05-02-001", volume: 14.4, coefficients: [], formula: "(8+10)×2×0.4 = 14.4 м² (опалубка по периметру)" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Армирование и бетон", category: "общестроительные",
      positions: [
        { id: "rp5", rateCode: "ЭСНСб06-06-01-001", volume: 2.40, coefficients: [], formula: "75 кг/м³ × 32 м³ ≈ 2.4 т" },
        { id: "rp6", rateCode: "ЭСНСб06-05-01-001", volume: 32.0, coefficients: [], formula: "80 м² × 0.4 = 32 м³" },
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
        { id: "sp1", rateCode: "ЭСНСб01-01-01-001", volume: 1.20, coefficients: [], formula: "8×10×1.5 / 100" },
        { id: "sp2", rateCode: "ЭСНСб01-01-03-001", volume: 0.40, coefficients: [], formula: "Засыпка 40 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Бетон", category: "общестроительные",
      // ОШИБКА: пропущена опалубка (formworkMissing должно сработать)
      positions: [
        { id: "sp3", rateCode: "ЭСНСб06-05-03-001", volume: 8.00, coefficients: [], formula: "80 × 0.1 = 8" },
        { id: "sp4", rateCode: "ЭСНСб06-06-01-001", volume: 2.40, coefficients: [], formula: "2.4 т" },
        { id: "sp5", rateCode: "ЭСНСб06-05-01-001", volume: 32.0, coefficients: [], formula: "80 × 0.4 = 32" },
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
        { id: "rp1", rateCode: "ЭСНСб21-21-04-007", volume: 120, coefficients: [], formula: "120 м кабеля ВВГнг 3×2.5" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Установочные изделия", category: "электромонтажные",
      positions: [
        { id: "rp2", rateCode: "ЭСНСб21-21-02-001", volume: 12, coefficients: [], formula: "12 розеток" },
        { id: "rp3", rateCode: "ЭСНСб21-21-06-001", volume: 6, coefficients: [], formula: "6 выключателей" },
        { id: "rp4", rateCode: "ЭСНСб21-21-03-001", volume: 8, coefficients: [], formula: "8 светильников LED" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Распределительный щит", category: "электромонтажные",
      positions: [
        { id: "rp5", rateCode: "ЭСНСб21-21-05-001", volume: 1, coefficients: [], formula: "1 щит на 12 автоматов" },
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
        { id: "sp1", rateCode: "ЭСНСб21-21-04-007", volume: 45, coefficients: [], formula: "По прямой между приборами" },
        { id: "sp2", rateCode: "ЭСНСб21-21-02-001", volume: 12, coefficients: [], formula: "12 розеток" },
        { id: "sp3", rateCode: "ЭСНСб21-21-06-001", volume: 6, coefficients: [], formula: "6 выключателей" },
        { id: "sp4", rateCode: "ЭСНСб21-21-03-001", volume: 8, coefficients: [], formula: "8 светильников" },
        { id: "sp5", rateCode: "ЭСНСб21-21-05-001", volume: 1, coefficients: [], formula: "1 щит" },
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
        { id: "rp1", rateCode: "ЭСНСб17-16-03-001", volume: 0.24, coefficients: [], formula: "24 м (ХВС 12 + ГВС 12) / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Сантехприборы", category: "сантехнические",
      positions: [
        { id: "rp2", rateCode: "ЭСНСб17-16-04-001", volume: 1, coefficients: [], formula: "1 унитаз" },
        { id: "rp3", rateCode: "ЭСНСб17-16-05-001", volume: 1, coefficients: [], formula: "1 умывальник" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Облицовка", category: "отделочные",
      positions: [
        { id: "rp4", rateCode: "ЭСНСб15-15-05-001", volume: 0.205, coefficients: [], formula: "2×(2.0+1.8)×2.7 = 20.5 м² / 100" },
        { id: "rp5", rateCode: "ЭСНСб15-11-03-001", volume: 0.036, coefficients: [], formula: "2.0×1.8 = 3.6 м² / 100" },
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
        { id: "sp1", rateCode: "ЭСНСб17-16-03-001", volume: 0.12, coefficients: [], formula: "ХВС 12 м / 100 (забыли ГВС)" },
        { id: "sp2", rateCode: "ЭСНСб17-16-04-001", volume: 1, coefficients: [], formula: "1 унитаз" },
        { id: "sp3", rateCode: "ЭСНСб17-16-05-001", volume: 1, coefficients: [], formula: "1 умывальник" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Плитка", category: "отделочные",
      positions: [
        { id: "sp4", rateCode: "ЭСНСб15-15-05-001", volume: 0.205, coefficients: [], formula: "20.5 / 100" },
        { id: "sp5", rateCode: "ЭСНСб15-11-03-001", volume: 0.036, coefficients: [], formula: "3.6 / 100" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 6 — Подвесной потолок Армстронг в офисе (Отделка, средняя)
 * ========================================================================= */
const T6_OBJECT: LearningObject = {
  id: "exam-office-suspended-ceiling",
  title: "Подвесной потолок Армстронг в офисе 100 м²",
  type: "капремонт",
  region: REGION,
  description:
    "Open-space офис 10 × 10 м, высота 3.6 м. Заказчик: подвесной потолок типа Армстронг (плита 600×600) на металлическом каркасе, монтаж осветительных модулей встроенных. Перед монтажом — окраска стен и стяжка пола.",
  attachments: [],
};
const T6_REFERENCE = mkLsr({
  id: "exam-t6-ref",
  title: "Эталон — Армстронг офиса",
  objectId: T6_OBJECT.id,
  lsrNumber: "exam-t6",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Подготовка", category: "отделочные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб15-13-01-001", volume: 1.44, coefficients: [], formula: "Стены: 2×(10+10)×3.6 = 144 м² / 100" },
        { id: "rp2", rateCode: "ЭСНСб15-15-04-001", volume: 1.44, coefficients: [], formula: "Окраска 144 / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Потолок", category: "отделочные",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб15-15-07-001", volume: 1.00, coefficients: [], formula: "10×10 = 100 м² / 100" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Светильники", category: "электромонтажные",
      positions: [
        { id: "rp4", rateCode: "ЭСНСб21-21-03-001", volume: 25, coefficients: [], formula: "25 встроенных LED светильников 600×600" },
      ],
    },
  ],
});
const T6_STARTER = mkLsr({
  id: "exam-t6-student",
  title: "Моё решение",
  objectId: T6_OBJECT.id,
  lsrNumber: "exam-t6",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Отделка", category: "отделочные",
      // ОШИБКА: окраска без штукатурки (нет подготовки поверхности)
      positions: [
        { id: "sp1", rateCode: "ЭСНСб15-15-04-001", volume: 1.44, coefficients: [], formula: "144 / 100" },
        { id: "sp2", rateCode: "ЭСНСб15-15-07-001", volume: 1.00, coefficients: [], formula: "100 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Электрика", category: "электромонтажные",
      positions: [
        { id: "sp3", rateCode: "ЭСНСб21-21-03-001", volume: 25, coefficients: [], formula: "25 светильников" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 7 — Скатная кровля частного дома с металлочерепицей (Кровля, средняя)
 * ========================================================================= */
const T7_OBJECT: LearningObject = {
  id: "exam-cottage-tile-roof",
  title: "Скатная кровля частного дома с металлочерепицей",
  type: "новое-строительство",
  region: REGION,
  description:
    "Двускатная кровля дома 8×12 м, уклон 30°. Площадь по скату = (площадь в плане 96 м²) ÷ cos(30°) ≈ 111 м². Пирог: пароизоляция → утепление 150 мм → гидроветрозащита → металлочерепица.",
  attachments: [],
};
const T7_REFERENCE = mkLsr({
  id: "exam-t7-ref",
  title: "Эталон — кровля частного дома",
  objectId: T7_OBJECT.id,
  lsrNumber: "exam-t7",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Подкровельный пирог", category: "кровельные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб12-12-03-001", volume: 1.11, coefficients: [], formula: "96/cos30° = 111 м² / 100" },
        { id: "rp2", rateCode: "ЭСНСб12-12-02-001", volume: 1.11, coefficients: [], formula: "111 / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Покрытие", category: "кровельные",
      positions: [
        { id: "rp3", rateCode: "ЭСН12-1112-0106-0102", volume: 111, coefficients: [], formula: "111 м² металлочерепицы (по скату)" },
      ],
    },
  ],
});
const T7_STARTER = mkLsr({
  id: "exam-t7-student",
  title: "Моё решение",
  objectId: T7_OBJECT.id,
  lsrNumber: "exam-t7",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Кровля", category: "кровельные",
      // ОШИБКА: площадь в плане без учёта уклона (96 вместо 111)
      positions: [
        { id: "sp1", rateCode: "ЭСНСб12-12-03-001", volume: 0.96, coefficients: [], formula: "8×12 = 96 / 100 (в плане)" },
        { id: "sp2", rateCode: "ЭСНСб12-12-02-001", volume: 0.96, coefficients: [], formula: "96 / 100" },
        { id: "sp3", rateCode: "ЭСН12-1112-0106-0102", volume: 96, coefficients: [], formula: "96 м² в плане" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 8 — Свайный фундамент промздания (Фундамент, сложная)
 * ========================================================================= */
const T8_OBJECT: LearningObject = {
  id: "exam-industrial-pile-foundation",
  title: "Свайный фундамент промздания 24×36 м",
  type: "новое-строительство",
  region: REGION,
  description:
    "Производственный цех 24 × 36 м. Грунт слабый (II категория, грунтовые воды на 2.5 м). По проекту: забивные ж/б сваи С90.30 (90 шт, шаг 4 м), монолитный ростверк B25 высотой 0.6 м под колонны.",
  attachments: [],
};
const T8_REFERENCE = mkLsr({
  id: "exam-t8-ref",
  title: "Эталон — свайный фундамент",
  objectId: T8_OBJECT.id,
  lsrNumber: "exam-t8",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Земляные работы", category: "земляные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб01-01-01-002", volume: 5.18, coefficients: [], formula: "24×36×0.6 = 518 м³ (под ростверк) / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Сваи", category: "общестроительные",
      positions: [
        { id: "rp2", rateCode: "ЭСНСб06-07-01-001", volume: 90, coefficients: [], formula: "90 свай С90.30 шагом 4 м" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Ростверк", category: "общестроительные",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб06-05-02-001", volume: 86.4, coefficients: [], formula: "(24+36)×2×0.6 опалубка = 72 + внутр. 14.4 = 86.4 м²" },
        { id: "rp4", rateCode: "ЭСНСб06-06-01-001", volume: 3.20, coefficients: [], formula: "75 кг/м³ × 43 м³ ≈ 3.2 т" },
        { id: "rp5", rateCode: "ЭСНСб06-05-01-001", volume: 43.2, coefficients: [], formula: "(24×36)×0.05 = 43.2 м³ (ростверк h=0.6 контур)" },
      ],
    },
  ],
});
const T8_STARTER = mkLsr({
  id: "exam-t8-student",
  title: "Моё решение",
  objectId: T8_OBJECT.id,
  lsrNumber: "exam-t8",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Земля", category: "земляные",
      positions: [
        { id: "sp1", rateCode: "ЭСНСб01-01-01-002", volume: 5.18, coefficients: [], formula: "518 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Фундамент", category: "общестроительные",
      // ОШИБКА: занижено количество свай (60 вместо 90)
      positions: [
        { id: "sp2", rateCode: "ЭСНСб06-07-01-001", volume: 60, coefficients: [], formula: "60 свай (шаг 6 м вместо 4 м)" },
        { id: "sp3", rateCode: "ЭСНСб06-05-02-001", volume: 86.4, coefficients: [], formula: "86.4 опалубка" },
        { id: "sp4", rateCode: "ЭСНСб06-06-01-001", volume: 3.20, coefficients: [], formula: "3.2 т" },
        { id: "sp5", rateCode: "ЭСНСб06-05-01-001", volume: 43.2, coefficients: [], formula: "43.2 м³" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 9 — Электрика школьного коридора (Электромонтаж, средняя)
 * ========================================================================= */
const T9_OBJECT: LearningObject = {
  id: "exam-school-corridor-electrical",
  title: "Электрика школьного коридора с антивандальной защитой",
  type: "капремонт",
  region: REGION,
  description:
    "Коридор школы 30 × 3 м (90 м²), действующее здание. Замена освещения: 12 LED светильников антивандальных, 4 выключателя проходных, аварийные выходные знаки, общая длина кабеля 180 м (с запасом).",
  attachments: [],
};
const T9_REFERENCE = mkLsr({
  id: "exam-t9-ref",
  title: "Эталон — электрика коридора",
  objectId: T9_OBJECT.id,
  lsrNumber: "exam-t9",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Кабельная разводка", category: "электромонтажные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб21-21-04-007", volume: 180, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" }], formula: "180 м кабеля" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Светильники", category: "электромонтажные",
      positions: [
        { id: "rp2", rateCode: "ЭСНСб21-21-03-001", volume: 12, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Действующий объект" }], formula: "12 LED антивандальных" },
        { id: "rp3", rateCode: "ЭСНСб21-21-06-001", volume: 4, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Действующий объект" }], formula: "4 проходных выключателя" },
      ],
    },
  ],
});
const T9_STARTER = mkLsr({
  id: "exam-t9-student",
  title: "Моё решение",
  objectId: T9_OBJECT.id,
  lsrNumber: "exam-t9",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Электрика", category: "электромонтажные",
      // ОШИБКА: не применён К=1.15 действующего объекта
      positions: [
        { id: "sp1", rateCode: "ЭСНСб21-21-04-007", volume: 180, coefficients: [], formula: "180 м" },
        { id: "sp2", rateCode: "ЭСНСб21-21-03-001", volume: 12, coefficients: [], formula: "12 светильников" },
        { id: "sp3", rateCode: "ЭСНСб21-21-06-001", volume: 4, coefficients: [], formula: "4 выключателя" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 10 — Котельная коттеджа (Сантехника, сложная)
 * ========================================================================= */
const T10_OBJECT: LearningObject = {
  id: "exam-cottage-boiler-heating",
  title: "Котельная и система отопления коттеджа",
  type: "новое-строительство",
  region: REGION,
  description:
    "Коттедж 180 м², 2 этажа. Газовый настенный котёл 24 кВт + бойлер-косвенник 200 л. Радиаторное отопление: 12 чугунных радиаторов, трубы 40 м (подача+обратка от котла).",
  attachments: [],
};
const T10_REFERENCE = mkLsr({
  id: "exam-t10-ref",
  title: "Эталон — отопление коттеджа",
  objectId: T10_OBJECT.id,
  lsrNumber: "exam-t10",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Котельная", category: "монтаж-оборудования",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб07-12-01-001", volume: 1, coefficients: [], formula: "1 газовый котёл 24 кВт" },
        { id: "rp2", rateCode: "ЭСНСб07-12-09-001", volume: 1, coefficients: [], formula: "1 бак-аккумулятор 200 л (косвенник)" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Трубопроводы", category: "сантехнические",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб17-16-01-001", volume: 0.80, coefficients: [], formula: "40 м подача + 40 м обратка = 80 м / 100" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Радиаторы", category: "сантехнические",
      positions: [
        { id: "rp4", rateCode: "ЭСНСб17-16-02-001", volume: 12, coefficients: [], formula: "12 чугунных радиаторов" },
      ],
    },
  ],
});
const T10_STARTER = mkLsr({
  id: "exam-t10-student",
  title: "Моё решение",
  objectId: T10_OBJECT.id,
  lsrNumber: "exam-t10",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Отопление", category: "сантехнические",
      // ОШИБКА: учтена только подача (40 м), забыли обратку
      positions: [
        { id: "sp1", rateCode: "ЭСНСб07-12-01-001", volume: 1, coefficients: [], formula: "1 котёл" },
        { id: "sp2", rateCode: "ЭСНСб07-12-09-001", volume: 1, coefficients: [], formula: "1 бойлер" },
        { id: "sp3", rateCode: "ЭСНСб17-16-01-001", volume: 0.40, coefficients: [], formula: "40 м труб (только подача)" },
        { id: "sp4", rateCode: "ЭСНСб17-16-02-001", volume: 12, coefficients: [], formula: "12 радиаторов" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 11 — Ремонт кухни под ключ (комплексное, сложная)
 * ========================================================================= */
const T11_OBJECT: LearningObject = {
  id: "exam-kitchen-renovation",
  title: "Ремонт кухни под ключ в квартире",
  type: "текущий-ремонт",
  region: REGION,
  description:
    "Кухня 3.0 × 4.0 × 2.7 м, окно 1.4×1.6 и дверь 0.8×2.1. Комплексный ремонт: демонтаж старой плитки и стяжки, новая стяжка, плитка фартука 5 м², плитка пола, окраска свободных стен, замена смесителя и розеток.",
  geometry: {
    kind: "room",
    length: 4.0,
    width: 3.0,
    height: 2.7,
    openings: [
      { kind: "window", width: 1.4, height: 1.6, count: 1 },
      { kind: "door", width: 0.8, height: 2.1, count: 1 },
    ],
  },
  attachments: [],
};
const T11_REFERENCE = mkLsr({
  id: "exam-t11-ref",
  title: "Эталон — кухня под ключ",
  objectId: T11_OBJECT.id,
  lsrNumber: "exam-t11",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Демонтаж", category: "демонтажные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб11-03.Д-001", volume: 0.12, coefficients: [], formula: "Пол 12 м² / 100 (плитка)" },
        { id: "rp2", rateCode: "ЭСНСб11-02.Д-001", volume: 0.12, coefficients: [], formula: "Стяжка 12 м² / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Полы", category: "отделочные",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб15-11-02-001", volume: 0.12, coefficients: [], formula: "12 / 100 (новая стяжка)" },
        { id: "rp4", rateCode: "ЭСНСб15-11-03-001", volume: 0.12, coefficients: [], formula: "12 / 100 (плитка пола)" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Стены", category: "отделочные",
      positions: [
        // Стены брутто: 2×(3+4)×2.7 = 37.8 м². Проёмы 1.4×1.6 + 0.8×2.1 = 3.92. Нетто 33.88
        // Минус фартук 5 м² (под плитку) = 28.88 → окраска 0.29 (100 м²)
        { id: "rp5", rateCode: "ЭСНСб15-13-01-001", volume: 0.289, coefficients: [], formula: "37.8 − проёмы 3.92 − фартук 5 = 28.88 / 100" },
        { id: "rp6", rateCode: "ЭСНСб15-15-04-001", volume: 0.289, coefficients: [], formula: "28.88 / 100" },
        { id: "rp7", rateCode: "ЭСНСб15-15-05-001", volume: 0.05, coefficients: [], formula: "Фартук 5 м² / 100" },
      ],
    },
    {
      id: "ref-s4", title: "Раздел 4. Электрика и сантехника", category: "электромонтажные",
      positions: [
        { id: "rp8", rateCode: "ЭСНСб21-21-02-001", volume: 6, coefficients: [], formula: "6 розеток" },
        { id: "rp9", rateCode: "ЭСНСб17-16-05-001", volume: 1, coefficients: [], formula: "Новый смеситель + умывальник" },
      ],
    },
  ],
});
const T11_STARTER = mkLsr({
  id: "exam-t11-student",
  title: "Моё решение",
  objectId: T11_OBJECT.id,
  lsrNumber: "exam-t11",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Демонтаж", category: "демонтажные",
      positions: [
        { id: "sp1", rateCode: "ЭСНСб11-03.Д-001", volume: 0.12, coefficients: [], formula: "12 / 100" },
        { id: "sp2", rateCode: "ЭСНСб11-02.Д-001", volume: 0.12, coefficients: [], formula: "12 / 100" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Полы", category: "отделочные",
      positions: [
        // ОШИБКА: пропущена новая стяжка перед плиткой
        { id: "sp3", rateCode: "ЭСНСб15-11-03-001", volume: 0.12, coefficients: [], formula: "12 / 100" },
      ],
    },
    {
      id: "stu-s3", title: "Раздел 3. Стены", category: "отделочные",
      // ОШИБКА: не выделили фартук, всё в окраску. Объём 0.378 без вычета.
      positions: [
        { id: "sp4", rateCode: "ЭСНСб15-13-01-001", volume: 0.378, coefficients: [], formula: "37.8 / 100 (с фартуком, без проёмов)" },
        { id: "sp5", rateCode: "ЭСНСб15-15-04-001", volume: 0.378, coefficients: [], formula: "37.8 / 100" },
      ],
    },
    {
      id: "stu-s4", title: "Раздел 4. Электрика и сантехника", category: "электромонтажные",
      positions: [
        { id: "sp6", rateCode: "ЭСНСб21-21-02-001", volume: 6, coefficients: [], formula: "6 розеток" },
        { id: "sp7", rateCode: "ЭСНСб17-16-05-001", volume: 1, coefficients: [], formula: "1 смеситель" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 12 — Кровля склада 1000 м² (Кровля, сложная)
 * ========================================================================= */
const T12_OBJECT: LearningObject = {
  id: "exam-warehouse-roof",
  title: "Плоская кровля склада 1000 м²",
  type: "новое-строительство",
  region: REGION,
  description:
    "Склад 20 × 50 м (1000 м²), плоская кровля. Пирог: пароизоляция → утепление 150 мм → кровельный ковёр из 2 слоёв наплавляемого. Стальной профлист по фермам (несущая основа).",
  attachments: [],
};
const T12_REFERENCE = mkLsr({
  id: "exam-t12-ref",
  title: "Эталон — кровля склада",
  objectId: T12_OBJECT.id,
  lsrNumber: "exam-t12",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Несущая основа", category: "кровельные",
      positions: [
        { id: "rp1", rateCode: "ЭСН12-1112-0107-0103", volume: 1000, coefficients: [], formula: "1000 м² профлист" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Пирог", category: "кровельные",
      positions: [
        { id: "rp2", rateCode: "ЭСНСб12-12-03-001", volume: 10.0, coefficients: [], formula: "1000 / 100 пароизоляция" },
        { id: "rp3", rateCode: "ЭСНСб12-12-02-001", volume: 10.0, coefficients: [], formula: "1000 / 100 утепление" },
        { id: "rp4", rateCode: "ЭСНСб12-12-01-001", volume: 10.0, coefficients: [], formula: "1000 / 100 наплавляемое 2 слоя" },
      ],
    },
  ],
});
const T12_STARTER = mkLsr({
  id: "exam-t12-student",
  title: "Моё решение",
  objectId: T12_OBJECT.id,
  lsrNumber: "exam-t12",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Кровля", category: "кровельные",
      // ОШИБКА: единица для профлиста — м², студент написал 10 как будто это 100 м²
      positions: [
        { id: "sp1", rateCode: "ЭСН12-1112-0107-0103", volume: 10, coefficients: [], formula: "10 (100 м²)?" },
        { id: "sp2", rateCode: "ЭСНСб12-12-03-001", volume: 10.0, coefficients: [], formula: "1000 / 100" },
        { id: "sp3", rateCode: "ЭСНСб12-12-02-001", volume: 10.0, coefficients: [], formula: "1000 / 100" },
        { id: "sp4", rateCode: "ЭСНСб12-12-01-001", volume: 10.0, coefficients: [], formula: "1000 / 100" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 13 — Монолитный подвал жилого дома (Фундамент, сложная)
 * ========================================================================= */
const T13_OBJECT: LearningObject = {
  id: "exam-monolithic-basement",
  title: "Монолитный подвал жилого дома",
  type: "новое-строительство",
  region: REGION,
  description:
    "Дом 12 × 10 м, подвал глубиной 2.8 м. Стены 250 мм из бетона B25 W8, перекрытие подвала 200 мм. Гидроизоляция наружных стен битумной мастикой.",
  attachments: [],
};
const T13_REFERENCE = mkLsr({
  id: "exam-t13-ref",
  title: "Эталон — монолитный подвал",
  objectId: T13_OBJECT.id,
  lsrNumber: "exam-t13",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Земля", category: "земляные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб01-01-01-002", volume: 3.36, coefficients: [], formula: "12×10×2.8 = 336 / 100" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Стены и перекрытие", category: "общестроительные",
      positions: [
        // Стены: (12+10)×2×2.8 = 123.2 м² внешняя × 0.25 = 30.8 м³
        { id: "rp2", rateCode: "ЭСНСб06-05-02-001", volume: 246.4, coefficients: [], formula: "Опалубка стен (2 стороны): 123.2 × 2 = 246.4 м²" },
        { id: "rp3", rateCode: "ЭСНСб06-06-01-001", volume: 2.5, coefficients: [], formula: "Арматура ~80 кг/м³ × 30.8 = 2.5 т" },
        { id: "rp4", rateCode: "ЭСНСб06-05-05-001", volume: 30.8, coefficients: [], formula: "30.8 м³ стены подвала" },
        { id: "rp5", rateCode: "ЭСНСб06-05-06-001", volume: 24.0, coefficients: [], formula: "120 м² × 0.2 = 24 м³ перекрытие" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Гидроизоляция", category: "кровельные",
      positions: [
        { id: "rp6", rateCode: "ЭСНСб26-11-01-001", volume: 123.2, coefficients: [], formula: "Наружная поверхность стен 123.2 м²" },
      ],
    },
  ],
});
const T13_STARTER = mkLsr({
  id: "exam-t13-student",
  title: "Моё решение",
  objectId: T13_OBJECT.id,
  lsrNumber: "exam-t13",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Подвал", category: "общестроительные",
      // ОШИБКА: пропущена гидроизоляция наружных стен (для подвала — критично)
      positions: [
        { id: "sp1", rateCode: "ЭСНСб01-01-01-002", volume: 3.36, coefficients: [], formula: "336 / 100" },
        { id: "sp2", rateCode: "ЭСНСб06-05-02-001", volume: 246.4, coefficients: [], formula: "246.4 опалубка" },
        { id: "sp3", rateCode: "ЭСНСб06-06-01-001", volume: 2.5, coefficients: [], formula: "2.5 т" },
        { id: "sp4", rateCode: "ЭСНСб06-05-05-001", volume: 30.8, coefficients: [], formula: "30.8 м³" },
        { id: "sp5", rateCode: "ЭСНСб06-05-06-001", volume: 24.0, coefficients: [], formula: "24 м³" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 14 — Электрика высотки с коэф. высоты (Электромонтаж, сложная)
 * ========================================================================= */
const T14_OBJECT: LearningObject = {
  id: "exam-high-rise-electrical",
  title: "Электромонтаж в 12-этажном жилом доме",
  type: "новое-строительство",
  region: REGION,
  description:
    "12-этажный жилой дом, монтаж стояков питания и этажных щитков. Высота 36 м — нужен коэффициент работы на высоте по СН РК (К=1.2). 12 этажных щитов на 24 автомата, 360 м кабеля стояков ВВГ 5×16.",
  attachments: [],
};
const T14_REFERENCE = mkLsr({
  id: "exam-t14-ref",
  title: "Эталон — электрика высотки",
  objectId: T14_OBJECT.id,
  lsrNumber: "exam-t14",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Стояки", category: "электромонтажные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб21-21-04-007", volume: 360, coefficients: [{ kind: "высота", value: 1.20, justification: "Работа на высоте ≥ 8 м, СН РК 8.02-12" }], formula: "360 м стояков" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Этажные щиты", category: "электромонтажные",
      positions: [
        { id: "rp2", rateCode: "ЭСНСб21-21-05-001", volume: 12, coefficients: [{ kind: "высота", value: 1.20, justification: "Высота ≥ 8 м" }], formula: "12 этажных щитов" },
      ],
    },
  ],
});
const T14_STARTER = mkLsr({
  id: "exam-t14-student",
  title: "Моё решение",
  objectId: T14_OBJECT.id,
  lsrNumber: "exam-t14",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Электромонтаж", category: "электромонтажные",
      // ОШИБКА: не применён коэффициент высоты
      positions: [
        { id: "sp1", rateCode: "ЭСНСб21-21-04-007", volume: 360, coefficients: [], formula: "360 м" },
        { id: "sp2", rateCode: "ЭСНСб21-21-05-001", volume: 12, coefficients: [], formula: "12 щитов" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 15 — Тёплый пол + ванна в коттедже (Сантехника, сложная)
 * ========================================================================= */
const T15_OBJECT: LearningObject = {
  id: "exam-warm-floor-bathroom",
  title: "Тёплый пол и ванная коттеджа",
  type: "новое-строительство",
  region: REGION,
  description:
    "Ванная коттеджа 4×2.5 м с тёплым водяным полом. Циркуляционный насос Grundfos, коллектор. Установка ванны, унитаза, умывальника + плитка стен и пола. Трубы PEX 80 м (петли тёплого пола).",
  attachments: [],
};
const T15_REFERENCE = mkLsr({
  id: "exam-t15-ref",
  title: "Эталон — тёплый пол",
  objectId: T15_OBJECT.id,
  lsrNumber: "exam-t15",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Тёплый пол", category: "сантехнические",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб17-16-03-001", volume: 0.80, coefficients: [], formula: "80 м PEX / 100" },
        { id: "rp2", rateCode: "ЭСНСб07-12-10-001", volume: 1, coefficients: [], formula: "1 циркуляционный насос Grundfos" },
      ],
    },
    {
      id: "ref-s2", title: "Раздел 2. Сантехприборы", category: "сантехнические",
      positions: [
        { id: "rp3", rateCode: "ЭСНСб17-16-04-001", volume: 1, coefficients: [], formula: "1 унитаз" },
        { id: "rp4", rateCode: "ЭСНСб17-16-05-001", volume: 1, coefficients: [], formula: "1 умывальник" },
      ],
    },
    {
      id: "ref-s3", title: "Раздел 3. Облицовка", category: "отделочные",
      positions: [
        // Стены: 2×(4+2.5)×2.7 = 35.1 м² нетто (без проёмов для упрощения) → 0.351
        { id: "rp5", rateCode: "ЭСНСб15-15-05-001", volume: 0.351, coefficients: [], formula: "35.1 / 100" },
        { id: "rp6", rateCode: "ЭСНСб15-11-03-001", volume: 0.10, coefficients: [], formula: "4×2.5 = 10 м² / 100" },
      ],
    },
  ],
});
const T15_STARTER = mkLsr({
  id: "exam-t15-student",
  title: "Моё решение",
  objectId: T15_OBJECT.id,
  lsrNumber: "exam-t15",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Сантехника", category: "сантехнические",
      // ОШИБКА: пропущен циркуляционный насос (без него тёплый пол не работает!)
      positions: [
        { id: "sp1", rateCode: "ЭСНСб17-16-03-001", volume: 0.80, coefficients: [], formula: "80 / 100" },
        { id: "sp2", rateCode: "ЭСНСб17-16-04-001", volume: 1, coefficients: [], formula: "1 унитаз" },
        { id: "sp3", rateCode: "ЭСНСб17-16-05-001", volume: 1, coefficients: [], formula: "1 умывальник" },
      ],
    },
    {
      id: "stu-s2", title: "Раздел 2. Облицовка", category: "отделочные",
      positions: [
        { id: "sp4", rateCode: "ЭСНСб15-15-05-001", volume: 0.351, coefficients: [], formula: "35.1 / 100" },
        { id: "sp5", rateCode: "ЭСНСб15-11-03-001", volume: 0.10, coefficients: [], formula: "10 / 100" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 16 — Дубль материала (batch D: duplicate-material)
 * ========================================================================= */
const T16_OBJECT: LearningObject = {
  id: "exam-laminate-dup",
  title: "СОШ №47, замена покрытия пола в кабинете",
  type: "капремонт",
  region: REGION,
  description: "Кабинет 6.0 × 5.0 × 3.0 м. Укладка ламината 33 класса по готовой стяжке, 30 м².",
  geometry: { kind: "room", length: 6.0, width: 5.0, height: 3.0, openings: [] },
  attachments: [],
};
const LAMINATE_RES = [
  { kind: "труд" as const, name: "Плотник-отделочник 5 разряда", qtyPerUnit: 14, unit: "чел.-ч", basePrice: 1500 },
  { kind: "материал" as const, name: "Ламинат 33 класс", qtyPerUnit: 105, unit: "м²", basePrice: 2800 },
  { kind: "материал" as const, name: "Подложка 3 мм", qtyPerUnit: 102, unit: "м²", basePrice: 320 },
  { kind: "материал" as const, name: "Плинтус ПВХ", qtyPerUnit: 35, unit: "м", basePrice: 380 },
];
const T16_REFERENCE = mkLsr({
  id: "exam-t16-ref", title: "Эталон — ламинат", objectId: T16_OBJECT.id, lsrNumber: "exam-t16",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Полы", category: "отделочные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб15-11-04-002", volume: 0.30, coefficients: [], formula: "30 / 100 = 0.30" },
      ],
    },
  ],
});
const T16_STARTER = mkLsr({
  id: "exam-t16-student", title: "Моё решение", objectId: T16_OBJECT.id, lsrNumber: "exam-t16",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Полы", category: "отделочные",
      positions: [
        {
          id: "sp1", rateCode: "ЭСНСб15-11-04-002", volume: 0.30, coefficients: [],
          formula: "30 / 100 = 0.30",
          note: "Поправил состав ресурсов под факт",
          // BUG: «Ламинат 33 класс» добавлен дважды — стоимость материала задвоена.
          resourceOverrides: [
            LAMINATE_RES[0],
            LAMINATE_RES[1],
            { ...LAMINATE_RES[1] },
            LAMINATE_RES[2],
            LAMINATE_RES[3],
          ],
        },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 17 — Двойной индекс по материалу (batch D: index-double)
 * ========================================================================= */
const T17_OBJECT: LearningObject = {
  id: "exam-index-double",
  title: "СОШ №47, штукатурка стен лаборатории",
  type: "капремонт",
  region: REGION,
  description: "Лаборатория 8.0 × 6.0 × 3.3 м. Штукатурка стен по маякам, 120 м² (нетто).",
  geometry: { kind: "room", length: 8.0, width: 6.0, height: 3.3, openings: [] },
  attachments: [],
};
const PLASTER_RES_BASE = [
  { kind: "труд" as const, name: "Штукатур 4 разряда", qtyPerUnit: 42, unit: "чел.-ч", basePrice: 1300 },
  { kind: "машины" as const, name: "Растворонасос", qtyPerUnit: 2, unit: "маш.-ч", basePrice: 950 },
  { kind: "материал" as const, name: "Раствор цементно-известковый М100", qtyPerUnit: 2.5, unit: "м³", basePrice: 16500 },
];
const T17_REFERENCE = mkLsr({
  id: "exam-t17-ref", title: "Эталон — штукатурка", objectId: T17_OBJECT.id, lsrNumber: "exam-t17",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Штукатурка", category: "отделочные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб15-13-01-001", volume: 1.20, coefficients: [], formula: "120 / 100 = 1.20" },
      ],
    },
  ],
});
const T17_STARTER = mkLsr({
  id: "exam-t17-student", title: "Моё решение", objectId: T17_OBJECT.id, lsrNumber: "exam-t17",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Штукатурка", category: "отделочные",
      positions: [
        {
          id: "sp1", rateCode: "ЭСНСб15-13-01-001", volume: 1.20, coefficients: [],
          formula: "120 / 100 = 1.20",
          // BUG: цена раствора введена в ТЕКУЩЕМ уровне (≈ базис ×8.7), без обоснования —
          // при базисно-индексном методе индекс применится повторно.
          resourceOverrides: [
            PLASTER_RES_BASE[0],
            PLASTER_RES_BASE[1],
            { ...PLASTER_RES_BASE[2], basePrice: 143000 },
          ],
        },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 18 — Двойной коэффициент условий (batch D: coef-double)
 * ========================================================================= */
const T18_OBJECT: LearningObject = {
  id: "exam-coef-double",
  title: "СОШ №47, окраска коридора в действующем здании",
  type: "капремонт",
  region: REGION,
  description: "Коридор 18.0 × 2.4 × 3.0 м. Окраска стен в 2 слоя, 120 м². Школа функционирует.",
  geometry: { kind: "room", length: 18.0, width: 2.4, height: 3.0, openings: [] },
  attachments: [],
};
const T18_REFERENCE = mkLsr({
  id: "exam-t18-ref", title: "Эталон — окраска", objectId: T18_OBJECT.id, lsrNumber: "exam-t18",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Окраска", category: "отделочные",
      positions: [
        {
          id: "rp1", rateCode: "ЭСНСб15-15-04-001", volume: 1.20,
          coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует (СН РК 8.02-10)" }],
          formula: "120 / 100 = 1.20",
        },
      ],
    },
  ],
});
const T18_STARTER = mkLsr({
  id: "exam-t18-student", title: "Моё решение", objectId: T18_OBJECT.id, lsrNumber: "exam-t18",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Окраска", category: "отделочные",
      positions: [
        {
          id: "sp1", rateCode: "ЭСНСб15-15-04-001", volume: 1.20,
          // BUG: применены и «стеснённые», и «действующий-объект» — перекрывающиеся
          // по смыслу условия, удорожание задваивается (1.15 × 1.15 = 1.32).
          coefficients: [
            { kind: "стеснённые", value: 1.15, justification: "Работа в узком коридоре" },
            { kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" },
          ],
          formula: "120 / 100 = 1.20",
        },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 19 — Неверная категория раздела → НР/СП (overhead-mismatch)
 * ========================================================================= */
const T19_OBJECT: LearningObject = {
  id: "exam-overhead-mismatch",
  title: "СОШ №47, демонтаж отделки кабинета",
  type: "капремонт",
  region: REGION,
  description: "Кабинет 6.0 × 5.0 × 3.0 м. Демонтаж старой штукатурки и стяжки перед ремонтом.",
  geometry: { kind: "room", length: 6.0, width: 5.0, height: 3.0, openings: [] },
  attachments: [],
};
const T19_REFERENCE = mkLsr({
  id: "exam-t19-ref", title: "Эталон — демонтаж", objectId: T19_OBJECT.id, lsrNumber: "exam-t19",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Демонтажные работы", category: "демонтажные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб15-01.Д-001", volume: 0.30, coefficients: [], formula: "30 / 100 = 0.30" },
        { id: "rp2", rateCode: "ЭСНСб11-02.Д-001", volume: 0.30, coefficients: [], formula: "30 / 100 = 0.30" },
      ],
    },
  ],
});
const T19_STARTER = mkLsr({
  id: "exam-t19-student", title: "Моё решение", objectId: T19_OBJECT.id, lsrNumber: "exam-t19",
  sections: [
    {
      // BUG: раздел демонтажа ошибочно отнесён к «общестроительным» (НР=90% вместо 70%).
      id: "stu-s1", title: "Раздел 1. Демонтажные работы", category: "общестроительные",
      positions: [
        { id: "sp1", rateCode: "ЭСНСб15-01.Д-001", volume: 0.30, coefficients: [], formula: "30 / 100 = 0.30" },
        { id: "sp2", rateCode: "ЭСНСб11-02.Д-001", volume: 0.30, coefficients: [], formula: "30 / 100 = 0.30" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 20 — Высотные работы без лесов (scaffolding-missing)
 * ========================================================================= */
const T20_OBJECT: LearningObject = {
  id: "exam-scaffolding-missing",
  title: "СОШ №47, штукатурка спортзала (высота 4.5 м)",
  type: "капремонт",
  region: REGION,
  description: "Спортзал 12.0 × 9.0 × 4.5 м. Штукатурка стен на высоте — нужны строительные леса.",
  geometry: { kind: "room", length: 12.0, width: 9.0, height: 4.5, openings: [] },
  attachments: [],
};
const T20_REFERENCE = mkLsr({
  id: "exam-t20-ref", title: "Эталон — штукатурка + леса", objectId: T20_OBJECT.id, lsrNumber: "exam-t20",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Отделка стен", category: "отделочные",
      positions: [
        { id: "rp1", rateCode: "ЭСНСб15-13-01-001", volume: 1.89, coefficients: [], formula: "2×(12+9)×4.5 = 189 / 100 = 1.89" },
        { id: "rp2", rateCode: "ЭСНСб08-01-01-001", volume: 189, coefficients: [], formula: "Леса по площади стен = 189 м²" },
      ],
    },
  ],
});
const T20_STARTER = mkLsr({
  id: "exam-t20-student", title: "Моё решение", objectId: T20_OBJECT.id, lsrNumber: "exam-t20",
  sections: [
    {
      // BUG: штукатурка на высоте 4.5 м, но позиция на строительные леса пропущена.
      id: "stu-s1", title: "Раздел 1. Отделка стен", category: "отделочные",
      positions: [
        { id: "sp1", rateCode: "ЭСНСб15-13-01-001", volume: 1.89, coefficients: [], formula: "2×(12+9)×4.5 = 189 / 100 = 1.89" },
      ],
    },
  ],
});

/* =========================================================================
 *  ЗАДАНИЕ 21 — Коэффициент условий без обоснования (coef-unjustified)
 * ========================================================================= */
const T21_OBJECT: LearningObject = {
  id: "exam-coef-unjustified",
  title: "СОШ №47, штукатурка лестничной клетки",
  type: "капремонт",
  region: REGION,
  description: "Лестничная клетка, штукатурка стен 95 м². Студент применил коэффициент стеснённости, но без документа-обоснования.",
  geometry: { kind: "room", length: 6.0, width: 2.5, height: 6.3, openings: [] },
  attachments: [],
};
const T21_REFERENCE = mkLsr({
  id: "exam-t21-ref", title: "Эталон — штукатурка", objectId: T21_OBJECT.id, lsrNumber: "exam-t21",
  sections: [
    {
      id: "ref-s1", title: "Раздел 1. Штукатурка", category: "отделочные",
      positions: [
        {
          id: "rp1", rateCode: "ЭСНСб15-13-01-001", volume: 0.95,
          coefficients: [{ kind: "стеснённые", value: 1.15, justification: "ППР, схема стеснённых условий лестничной клетки (СН РК 8.02-05)" }],
          formula: "95 / 100 = 0.95",
        },
      ],
    },
  ],
});
const T21_STARTER = mkLsr({
  id: "exam-t21-student", title: "Моё решение", objectId: T21_OBJECT.id, lsrNumber: "exam-t21",
  sections: [
    {
      id: "stu-s1", title: "Раздел 1. Штукатурка", category: "отделочные",
      positions: [
        {
          id: "sp1", rateCode: "ЭСНСб15-13-01-001", volume: 0.95,
          // BUG: коэффициент стеснённости применён, но обоснование пустое —
          // без ППР/акта экспертиза снимет коэффициент, смета завышена на 15%.
          coefficients: [{ kind: "стеснённые", value: 1.15, justification: "" }],
          formula: "95 / 100 = 0.95",
        },
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
      "Монолитная плита требует опалубку по периметру (ЭСНСб06-05-02-001)",
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
  {
    id: "office-suspended-ceiling",
    title: "Подвесной потолок Армстронг в офисе",
    category: "Отделка",
    difficulty: "средняя",
    durationMin: 25,
    icon: "🪟",
    hiddenError: "Окраска стен без штукатурки (нет подготовки поверхности)",
    object: T6_OBJECT,
    reference: T6_REFERENCE,
    starter: T6_STARTER,
    hints: [
      "Перед окраской — штукатурка (ЭСНСб15-13-01-001) и шпатлёвка",
      "Подвесной потолок Армстронг — отдельная позиция (ЭСНСб15-15-07-001)",
    ],
  },
  {
    id: "cottage-tile-roof",
    title: "Скатная кровля частного дома (металлочерепица)",
    category: "Кровля",
    difficulty: "средняя",
    durationMin: 25,
    icon: "🏘",
    hiddenError: "Площадь по плану без коэффициента уклона (cos 30° = 0.866 — увеличивает на 15%)",
    object: T7_OBJECT,
    reference: T7_REFERENCE,
    starter: T7_STARTER,
    hints: [
      "Площадь скатной кровли = (площадь в плане) ÷ cos(угла уклона)",
      "Для уклона 30°: 96 / 0.866 ≈ 111 м²",
    ],
  },
  {
    id: "industrial-pile-foundation",
    title: "Свайный фундамент промздания 24×36 м",
    category: "Фундамент",
    difficulty: "сложная",
    durationMin: 35,
    icon: "🏗",
    hiddenError: "Шаг свай 6 м вместо проектных 4 м — 60 свай вместо 90",
    object: T8_OBJECT,
    reference: T8_REFERENCE,
    starter: T8_STARTER,
    hints: [
      "При шаге 4 м на 24×36 м получается 7×13 = 91 ≈ 90 свай",
      "Шаг свай — критичный параметр, нельзя «округлить» в большую сторону без расчёта",
    ],
  },
  {
    id: "school-corridor-electrical",
    title: "Электрика школьного коридора (антивандальный свет)",
    category: "Электромонтаж",
    difficulty: "средняя",
    durationMin: 20,
    icon: "🏫",
    hiddenError: "Не применён К=1.15 действующего объекта (СН РК 8.02-10)",
    object: T9_OBJECT,
    reference: T9_REFERENCE,
    starter: T9_STARTER,
    hints: [
      "Школа функционирует — ко всем электромонтажным работам К=1.15",
      "Коэффициент применяется ко всем позициям, не только к избранным",
    ],
  },
  {
    id: "cottage-boiler-heating",
    title: "Котельная и отопление коттеджа",
    category: "Сантехника",
    difficulty: "сложная",
    durationMin: 30,
    icon: "🔥",
    hiddenError: "Учтена только подача (40 м), забыли обратку — итого 80 м",
    object: T10_OBJECT,
    reference: T10_REFERENCE,
    starter: T10_STARTER,
    hints: [
      "Любой замкнутый контур отопления = подача + обратка (двойная длина)",
      "Студенты часто учитывают только подачу — частая ошибка проектировщика",
    ],
  },
  {
    id: "kitchen-renovation",
    title: "Ремонт кухни под ключ",
    category: "Отделка",
    difficulty: "сложная",
    durationMin: 40,
    icon: "🍳",
    hiddenError: "Пропущена новая стяжка перед плиткой пола; фартук под плиткой не выделен из площади под окраску",
    object: T11_OBJECT,
    reference: T11_REFERENCE,
    starter: T11_STARTER,
    hints: [
      "После демонтажа старой стяжки нужно устроить новую (ЭСНСб15-11-02-001)",
      "Фартук кухни — отдельная плитка (ЭСНСб15-15-05-001), а окрашивается только остаток стены",
    ],
  },
  {
    id: "warehouse-roof",
    title: "Кровля склада 1000 м²",
    category: "Кровля",
    difficulty: "сложная",
    durationMin: 25,
    icon: "🏭",
    hiddenError: "Неправильная единица для профлиста — указано 10 (как 100 м²), а должно быть 1000 м²",
    object: T12_OBJECT,
    reference: T12_REFERENCE,
    starter: T12_STARTER,
    hints: [
      "Внимательно к единицам! Профлист в м², утепление в 100 м²",
      "Профлист 1000 м² ≠ 10 × «100 м²» — это разные расценки, нужно смотреть unit",
    ],
  },
  {
    id: "monolithic-basement",
    title: "Монолитный подвал жилого дома",
    category: "Фундамент",
    difficulty: "сложная",
    durationMin: 35,
    icon: "🏛",
    hiddenError: "Пропущена гидроизоляция наружных стен подвала (ЭСНСб26-11-01-001)",
    object: T13_OBJECT,
    reference: T13_REFERENCE,
    starter: T13_STARTER,
    hints: [
      "Подвал без гидроизоляции = плесень и протечки. Обязательная позиция!",
      "Гидроизоляция битумной мастикой по наружной поверхности стен (123.2 м²)",
    ],
  },
  {
    id: "high-rise-electrical",
    title: "Электромонтаж в 12-этажном доме",
    category: "Электромонтаж",
    difficulty: "сложная",
    durationMin: 25,
    icon: "🏢",
    hiddenError: "Не применён коэффициент работы на высоте (К=1.20 при ≥ 8 м)",
    object: T14_OBJECT,
    reference: T14_REFERENCE,
    starter: T14_STARTER,
    hints: [
      "Высота здания 36 м → К=1.20 на все верхолазные работы (СН РК 8.02-12)",
      "Коэффициент применяется к каждой позиции, выполняемой выше 8 м",
    ],
  },
  {
    id: "warm-floor-bathroom",
    title: "Тёплый водяной пол в ванной коттеджа",
    category: "Сантехника",
    difficulty: "сложная",
    durationMin: 30,
    icon: "♨️",
    hiddenError: "Пропущен циркуляционный насос — без него тёплый пол не функционирует",
    object: T15_OBJECT,
    reference: T15_REFERENCE,
    starter: T15_STARTER,
    hints: [
      "Тёплый водяной пол требует циркуляционного насоса (ЭСНСб07-12-10-001)",
      "Это не дополнительная позиция, а обязательная — без неё система не работает",
    ],
  },
  {
    id: "laminate-duplicate-material",
    title: "Ламинат в кабинете — состав ресурсов",
    category: "Отделка",
    difficulty: "средняя",
    durationMin: 15,
    icon: "🪵",
    hiddenError: "Материал «Ламинат 33 класс» добавлен в состав ресурсов дважды — стоимость задвоена",
    object: T16_OBJECT,
    reference: T16_REFERENCE,
    starter: T16_STARTER,
    hints: [
      "Откройте редактор состава ресурсов позиции — нет ли одинаковых строк материала?",
      "Расход материала задаётся одной строкой; повтор удваивает стоимость материала в ПЗ",
    ],
  },
  {
    id: "plaster-index-double",
    title: "Штукатурка лаборатории — цена раствора",
    category: "Отделка",
    difficulty: "сложная",
    durationMin: 20,
    icon: "🧱",
    hiddenError: "Цена раствора введена в текущем уровне — при базисно-индексном методе индекс задваивается",
    object: T17_OBJECT,
    reference: T17_REFERENCE,
    starter: T17_STARTER,
    hints: [
      "Метод базисно-индексный: в состав ресурсов вносят БАЗИСНУЮ цену, индекс ×8.7 применит калькулятор",
      "Если ввести текущую цену, она умножится на индекс ещё раз — переоценка в ~8.7 раза",
    ],
  },
  {
    id: "painting-coef-double",
    title: "Окраска коридора — коэффициенты условий",
    category: "Отделка",
    difficulty: "средняя",
    durationMin: 15,
    icon: "🖌️",
    hiddenError: "Применены и «стеснённые», и «действующий-объект» — перекрывающиеся условия задваивают удорожание",
    object: T18_OBJECT,
    reference: T18_REFERENCE,
    starter: T18_STARTER,
    hints: [
      "«Стеснённые» и «действующий-объект» описывают по сути одно — стеснённость на работающем объекте",
      "Оставьте один коэффициент; перемножение 1.15 × 1.15 завышает стоимость на 32% вместо 15%",
    ],
  },
  {
    id: "demolition-section-overhead",
    title: "Демонтаж кабинета — категория раздела",
    category: "Отделка",
    difficulty: "сложная",
    durationMin: 18,
    icon: "🏷️",
    hiddenError: "Раздел демонтажа отнесён к «общестроительным» — НР/СП начислены по 90% вместо 70%",
    object: T19_OBJECT,
    reference: T19_REFERENCE,
    starter: T19_STARTER,
    hints: [
      "НР/СП начисляются по категории раздела: для демонтажа — НР=70%/СП=45%, для общестроя — НР=90%/СП=60%",
      "Категория раздела должна соответствовать работам внутри (СН РК 8.02-07)",
    ],
  },
  {
    id: "gym-scaffolding-missing",
    title: "Штукатурка спортзала — леса",
    category: "Отделка",
    difficulty: "средняя",
    durationMin: 15,
    icon: "🪜",
    hiddenError: "Штукатурка на высоте 4.5 м без позиции на строительные леса",
    object: T20_OBJECT,
    reference: T20_REFERENCE,
    starter: T20_STARTER,
    hints: [
      "При высоте > 4 м внутри помещения нужны строительные леса/подмости (СН РК 1.03-05)",
      "Добавьте позицию «Монтаж и демонтаж наружных трубчатых строительных лесов» (ЭСНСб08-01-01-001)",
    ],
  },
  {
    id: "stairwell-coef-unjustified",
    title: "Штукатурка лестничной клетки — обоснование коэффициента",
    category: "Отделка",
    difficulty: "средняя",
    durationMin: 12,
    icon: "📎",
    hiddenError: "Коэффициент стеснённости 1.15 применён без документа-обоснования",
    object: T21_OBJECT,
    reference: T21_REFERENCE,
    starter: T21_STARTER,
    hints: [
      "Коэффициенты условий производства применяются только при наличии подтверждающего документа",
      "Укажите в обосновании ППР/акт обследования со схемой стеснённых условий (СН РК 8.02-05)",
    ],
  },
];

export function findExamTask(id: string): ExamTask | undefined {
  return EXAM_TASKS.find((t) => t.id === id);
}
