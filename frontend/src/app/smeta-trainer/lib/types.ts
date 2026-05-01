// Типы учебного корпуса AI-тренажёра сметного дела РК.
// Структура упрощённая, отражает основные понятия СНБ РК — без полной нормативной строгости.

export type Currency = "KZT";

/** Категория работ — для подбора нормативов НР/СП и фильтра расценок. */
export type WorkCategory =
  | "общестроительные"
  | "ремонтно-строительные"
  | "монтаж-оборудования"
  | "электромонтажные"
  | "сантехнические"
  | "отделочные"
  | "земляные"
  | "кровельные"
  | "демонтажные";

/** Единица измерения нормы. Учебный набор — расширим по мере необходимости. */
export type Unit = "м²" | "м³" | "м" | "100 м²" | "100 м³" | "100 м" | "т" | "шт" | "кг";

/** Один ресурс в составе расценки: труд, машины или материал. */
export interface Resource {
  kind: "труд" | "машины" | "материал";
  /** Идентификатор материала / типа машины / профессии (ссылка на справочник, опционально). */
  refId?: string;
  /** Название (всегда заполнено для самодостаточности). */
  name: string;
  /** Расход на единицу нормы. */
  qtyPerUnit: number;
  /** Единица измерения ресурса. */
  unit: string;
  /** Цена за единицу ресурса в базисном уровне (тенге). */
  basePrice: number;
  /** Часть зарплаты машиниста (только для kind === "машины"). */
  machinistWageRate?: number;
}

/** Расценка — атомарная единица сметы. Учебный аналог ГЭСН/ЕРЕР. */
export interface Rate {
  /** Шифр (учебный, формат «ROOT-NN-SS-K»). */
  code: string;
  /** Полное наименование работы. */
  title: string;
  /** Категория работ — для нормативов НР/СП. */
  category: WorkCategory;
  /** Единица измерения нормы. */
  unit: Unit;
  /** Развёрнутый состав работ (текстом). */
  composition: string[];
  /** Ресурсы на одну единицу нормы. */
  resources: Resource[];
  /** Базисная стоимость единицы нормы (рассчитывается из resources × basePrice). */
  baseCostPerUnit: number;
  /** Подсказки для технической части — типичные коэффициенты. */
  technicalNotes?: string;
}

/** Нормативные коэффициенты НР/СП для категории работ. */
export interface OverheadRules {
  category: WorkCategory;
  /** % НР от ФОТ (или прямых затрат — см. base). */
  overheadPct: number;
  /** % СП от ФОТ (или прямых затрат). */
  profitPct: number;
  /** База начисления для этой категории. */
  base: "ФОТ" | "ПЗ";
  /** Ссылка на нормативный документ (учебная). */
  source: string;
}

/** Индексы пересчёта на учебный квартал. */
export interface IndexSet {
  /** Регион РК (учебно). */
  region: string;
  /** Метка квартала: например «2026-Q2». */
  quarter: string;
  /** Индекс к ФОТ. */
  toFOT: number;
  /** Индекс к ЭМ (без ЗП машинистов). */
  toEM: number;
  /** Индекс к материалам. */
  toMaterials: number;
  /** Опциональный общий индекс СМР (упрощённый способ). */
  toSMR?: number;
}

/** Геометрия объекта — для AI-проверок (например, корректность вычета проёмов). */
export interface RoomGeometry {
  kind: "room";
  length: number;
  width: number;
  height: number;
  openings: { kind: "window" | "door"; width: number; height: number; count: number }[];
}

/** Учебный объект (объект строительства / ремонта). */
export interface LearningObject {
  id: string;
  title: string;
  type: "новое-строительство" | "реконструкция" | "капремонт" | "текущий-ремонт" | "реставрация" | "снос";
  region: string;
  /** Описание для студента. */
  description: string;
  /** Привязка к уроку курса (ID урока в smeta-rk-kurs). */
  lessonRef?: string;
  /** Геометрия объекта (опциональна, для AI-проверок). */
  geometry?: RoomGeometry;
  /** Связанные документы (ВОР, чертежи — пока в учебной форме). */
  attachments: { kind: "vor" | "drawing" | "photo" | "kp" | "defect-act"; title: string; url?: string }[];
}

/** Позиция в смете студента. */
export interface SmetaPosition {
  /** Уникальный id внутри сметы (для перетаскивания, удаления). */
  id: string;
  rateCode: string;
  /** Объём в единицах нормы (т.е. если норма «1 м³», объём кладки 5.7 — это 5.7). */
  volume: number;
  /** Применённые коэффициенты (мультипликативно). */
  coefficients: AppliedCoefficient[];
  /** Заметка студента (откуда объём, обоснование). */
  note?: string;
}

/** Применённый коэффициент условий производства работ. */
export interface AppliedCoefficient {
  kind: "стеснённые" | "действующий-объект" | "высота" | "охранные-зоны" | "выходные" | "социальный-объект";
  /** Числовое значение, например 1.15. */
  value: number;
  /** Документ-обоснование (учебно — текст). */
  justification: string;
}

/** Раздел сметы — группировка позиций по виду работ. */
export interface SmetaSection {
  id: string;
  title: string;
  category: WorkCategory;
  positions: SmetaPosition[];
}

/** Реквизиты шапки ЛСР по НДЦС РК 8.01-08-2022 Форма 4*. */
export interface LsrMeta {
  strojkaTitle?: string;
  strojkaCode?: string;
  objectTitle?: string;
  objectCode?: string;
  lsrNumber?: string;
  /** Основание: РП, альбом, чертёж. */
  osnovanje?: string;
  /** "Наименование работ" в шапке. */
  worksTitle?: string;
  /** Дата уровня цен: "декабрь 2025 г." */
  priceDate?: string;
  /** Составил (ФИО студента). */
  author?: string;
}

/** Локальная сметная расчёт — основная единица студенческой работы. */
export interface Lsr {
  id: string;
  title: string;
  objectId: string;
  /** Метод расчёта. */
  method: "базисно-индексный" | "ресурсный";
  /** Применяемый набор индексов (квартал + регион). */
  indexQuarter: string;
  indexRegion: string;
  sections: SmetaSection[];
  /** Реквизиты шапки (студент заполняет в учебных целях). */
  meta?: LsrMeta;
  /** Создано/изменено для UI. */
  createdAt: string;
  updatedAt: string;
}

/** Результат расчёта одной позиции — детально, для отображения и AI-анализа. */
export interface PositionCalc {
  position: SmetaPosition;
  rate: Rate;
  /** Базисные суммы. */
  base: {
    fot: number;
    em: number;
    emMachinistWage: number;
    materials: number;
    direct: number;
  };
  /** Применённый суммарный коэффициент. */
  appliedCoefMultiplier: number;
  /** Текущие суммы после индексов и коэффициентов. */
  current: {
    fot: number;
    em: number;
    materials: number;
    direct: number;
  };
  /** Текущая стоимость единицы нормы (current.direct / volume). */
  unitPrice: number;
}

/** Результат расчёта раздела. */
export interface SectionCalc {
  section: SmetaSection;
  positions: PositionCalc[];
  /** Сумма прямых затрат раздела (после индексов и коэф.). */
  direct: number;
  /** Суммарный ФОТ раздела (после индексов). */
  fot: number;
  /** НР, СП, итог раздела. */
  overhead: number;
  profit: number;
  total: number;
}

/** Результат расчёта всей ЛСР. */
export interface LsrCalc {
  lsr: Lsr;
  sections: SectionCalc[];
  /** Сумма ПЗ + НР + СП без НДС и лимитированных. */
  totalBeforeVat: number;
  /** НДС. */
  vat: number;
  /** Итог с НДС. */
  totalWithVat: number;
}

/** AI-замечание / совет студенту. */
export interface AiNotice {
  id: string;
  severity: "info" | "warning" | "error";
  /** Сценарий, который сработал. */
  scenario: string;
  /** К какой позиции / разделу относится. */
  context: { positionId?: string; sectionId?: string };
  title: string;
  message: string;
  /** Что предлагает сделать AI. */
  suggestion?: string;
  /** Ссылка на пункт нормативки (учебная). */
  reference?: string;
}
