/**
 * Человекочитаемые названия AI-сценариев — для аналитики и отчётов.
 * Коды сценариев (n.scenario) криптичны; преподавателю и студенту нужны
 * понятные ярлыки + краткое описание типовой ошибки.
 */

export interface ScenarioLabel {
  label: string;
  short: string;
}

export const SCENARIO_LABELS: Record<string, ScenarioLabel> = {
  "missing-opening-subtraction": { label: "Не вычтены проёмы", short: "Площадь стен взята брутто, без вычета окон/дверей." },
  "double-count": { label: "Двойной счёт", short: "Одна работа учтена дважды в разных позициях." },
  "missing-coefficient": { label: "Забыт коэффициент", short: "Не применён К условий производства (действующий объект и т.п.)." },
  "winter-surcharge": { label: "Забыто зимнее удорожание", short: "Нет надбавки за работы при отрицательной температуре." },
  "index-mismatch": { label: "Неверный индекс", short: "Применён не тот индекс пересчёта." },
  "index-stale": { label: "Устаревший индекс", short: "Использован индекс прошлого квартала." },
  "overhead-mismatch": { label: "Неверные НР/СП", short: "Норматив накладных/прибыли не по виду работ." },
  "height-coefficient": { label: "Забыт коэф. высоты", short: "Нет К=1.20 для работ выше 8 м." },
  "wrong-unit": { label: "Неверная единица", short: "Путаница «м²» и «100 м²» — ошибка в 100 раз." },
  "missing-preparation": { label: "Забыта подготовка", short: "Окраска без штукатурки/шпатлёвки." },
  "soil-category-mismatch": { label: "Неверная категория грунта", short: "Расценка землеработ не по категории грунта." },
  "formwork-missing": { label: "Забыта опалубка", short: "Бетон без опалубки." },
  "transport-missing": { label: "Забыты перевозки", short: "Нет позиции на доставку грузов." },
  "demolition-doubled": { label: "Демонтаж задвоен", short: "Демонтаж учтён повторно." },
  "scaffolding-missing": { label: "Забыты леса", short: "Высотные работы без лесов/подмостей." },
  "dismantling-coef-missing": { label: "Забыт коэф. разборки", short: "Демонтаж без понижающего коэффициента." },
  "waste-factor-missing": { label: "Забыт коэф. отходов", short: "Материал без учёта отходов/потерь." },
  "duplicate-material": { label: "Дубль материала", short: "Один материал добавлен в позицию дважды." },
  "material-price-unjustified": { label: "Цена без обоснования", short: "Индивидуальная цена материала без ссылки на прайс/КП." },
  "coef-double": { label: "Двойной коэффициент", short: "Перекрывающиеся/повторённые коэффициенты условий." },
  "index-double": { label: "Двойной индекс", short: "Текущая цена материала умножается на индекс повторно." },
};

export function scenarioLabel(code: string): ScenarioLabel {
  return SCENARIO_LABELS[code] ?? { label: code, short: "" };
}

/**
 * Сценарии «batch D» — детекторы ресурсной части и коэффициентов (урок 2.6),
 * добавленные после первичной серии. Используются в аналитике куратора, чтобы
 * отдельно отслеживать частоту новых типов ошибок и покрытие банка экзаменов.
 */
export const NEW_DETECTOR_SCENARIOS: string[] = [
  "duplicate-material",
  "material-price-unjustified",
  "coef-double",
  "index-double",
];
