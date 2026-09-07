/**
 * QSpace — состав («пирог») конструкций для чернового слоя.
 *
 * Основатель просил показать «как и где и что должно проходить» на черновой
 * стадии. Кабели и трубы уже строятся (planModel.ts); здесь — второй вопрос
 * той же стадии: из чего состоит пол, стена и потолок по слоям, и какая от
 * этого набегает толщина.
 *
 * Числа — типовые толщины по практике ремонта, а не нормативные требования
 * конкретного СНиП/СП: у каждого слоя названа роль, чтобы прораб мог сверить.
 * Именно поэтому структура возвращает `note` у каждого слоя — число без
 * объяснения нечем проверить.
 */

export interface StructureLayer {
  /** порядок снизу вверх (для пола) или изнутри наружу (для стены) */
  name: string;
  thicknessMm: number;
  note: string;
}

export interface Structure {
  id: string;
  title: string;
  layers: StructureLayer[];
}

/** Суммарная толщина пирога, мм. */
export function totalMm(s: Structure): number {
  return s.layers.reduce((sum, l) => sum + l.thicknessMm, 0);
}

/**
 * Пол по перекрытию. Толщина стяжки взята под трубы тёплого пола и
 * разводку; без тёплого пола стяжка обычно тоньше — это сказано в note.
 */
export const FLOOR_WET: Structure = {
  id: "floor-wet",
  title: "Пол: стяжка по перекрытию",
  layers: [
    { name: "Перекрытие", thicknessMm: 0, note: "основание, в высоту помещения не входит" },
    { name: "Звукоизоляция", thicknessMm: 5, note: "подложка под стяжку, гасит ударный шум" },
    { name: "Стяжка", thicknessMm: 60, note: "60 мм под трубы тёплого пола; без него достаточно 40" },
    { name: "Подложка", thicknessMm: 3, note: "под ламинат/паркетную доску; под плитку не нужна" },
    { name: "Покрытие", thicknessMm: 12, note: "паркетная доска или ламинат; плитка с клеем ~15" },
  ],
};

/** Перегородка из газоблока — типовая межкомнатная. */
export const WALL_BLOCK: Structure = {
  id: "wall-block",
  title: "Перегородка: газоблок",
  layers: [
    { name: "Штукатурка", thicknessMm: 10, note: "выравнивание, сторона комнаты" },
    { name: "Газоблок", thicknessMm: 100, note: "несущая часть перегородки" },
    { name: "Штукатурка", thicknessMm: 10, note: "выравнивание, сторона соседней комнаты" },
    { name: "Шпаклёвка + отделка", thicknessMm: 3, note: "под покраску; под обои — 2" },
  ],
};

/** Перегородка каркасная — быстрее и легче, внутрь уходят коммуникации. */
export const WALL_FRAME: Structure = {
  id: "wall-frame",
  title: "Перегородка: каркас с ГКЛ",
  layers: [
    { name: "ГКЛ", thicknessMm: 12.5, note: "лист гипсокартона, сторона комнаты" },
    { name: "Каркас + минвата", thicknessMm: 75, note: "профиль 75 мм; внутри проходят кабели" },
    { name: "ГКЛ", thicknessMm: 12.5, note: "лист гипсокартона, обратная сторона" },
    { name: "Шпаклёвка + отделка", thicknessMm: 3, note: "проклейка швов обязательна" },
  ],
};

/** Потолок натяжной — самый частый выбор, съедает высоту. */
export const CEILING_STRETCH: Structure = {
  id: "ceiling-stretch",
  title: "Потолок: натяжной",
  layers: [
    { name: "Перекрытие", thicknessMm: 0, note: "основание" },
    { name: "Зазор под светильники", thicknessMm: 60, note: "встроенные светильники требуют 50–70" },
    { name: "Полотно", thicknessMm: 1, note: "ПВХ или ткань" },
  ],
};

export const STRUCTURES: Structure[] = [FLOOR_WET, WALL_BLOCK, WALL_FRAME, CEILING_STRETCH];

/**
 * Сколько высоты помещения съедают пол и потолок вместе.
 *
 * Практический смысл: человек считает высоту «2.70», а после ремонта получает
 * меньше — и узнаёт об этом, когда шкаф не встаёт. Слой «Перекрытие» в счёт
 * не идёт (это основание, а не добавка), поэтому его толщина 0.
 */
export function heightLostMm(floor: Structure, ceiling: Structure): number {
  return totalMm(floor) + totalMm(ceiling);
}

/** Итоговая чистовая высота помещения, м. */
export function finishedHeightM(rawHeightM: number, floor: Structure, ceiling: Structure): number {
  return rawHeightM - heightLostMm(floor, ceiling) / 1000;
}
