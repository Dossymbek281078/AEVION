/* AEVION CyberChess — Russian labels for puzzle themes.

   Puzzle records carry a `theme` string that the UI used to render verbatim.
   Most of the corpus comes from the Lichess puzzle set, whose theme field is a
   camelCase identifier, so 40 of the 69 distinct themes — over 5,000 puzzles —
   surfaced to the player as `kingsideAttack`, `advancedPawn`, `crushing` and so
   on, sitting in a list next to properly translated Russian names.

   Anything not in the map is returned unchanged: the corpus already contains
   Russian themes ("Вилка", "Мат в 2"), and an unknown id is better shown raw
   than swallowed. */

const THEME_RU: Record<string, string> = {
  // Оценка позиции
  advantage: "Перевес",
  crushing: "Разгром",
  equality: "Уравнение",
  mate: "Мат",
  master: "Партия мастеров",
  long: "Длинная комбинация",

  // Тактические мотивы
  fork: "Вилка",
  attraction: "Завлечение",
  deflection: "Отвлечение",
  clearance: "Освобождение поля",
  interference: "Перекрытие",
  intermezzo: "Промежуточный ход",
  discoveredAttack: "Вскрытое нападение",
  discoveredCheck: "Вскрытый шах",
  doubleCheck: "Двойной шах",
  capturingDefender: "Взятие защитника",
  hangingPiece: "Висящая фигура",
  advancedPawn: "Продвинутая пешка",
  exposedKing: "Открытый король",
  kingsideAttack: "Атака на королевском фланге",
  attackingF2F7: "Удар по f2/f7",
  collinearMove: "Ход по одной линии",
  "collinear move": "Ход по одной линии",
  defensiveMove: "Защитный ход",
  "defensive move": "Защитный ход",

  // Матовые построения
  backRankMate: "Мат по последней горизонтали",
  arabianMate: "Арабский мат",
  anastasiaMate: "Мат Анастасии",
  bodenMate: "Мат Бодена",
  balestraMate: "Мат Балестра",
  cornerMate: "Мат в углу",
  dovetailMate: "Мат «ласточкин хвост»",
  doubleBishopMate: "Мат двумя слонами",
  epauletteMate: "Эполетный мат",
  hookMate: "Мат крюком",
  killBoxMate: "Мат коробкой",
  blindSwineMate: "Мат «слепые свиньи»",

  // Эндшпиль
  bishopEndgame: "Слоновый эндшпиль",
  knightEndgame: "Коневой эндшпиль",

  // Стадия партии — рендерится тем же чипом, что и тема (см. заголовок пазла,
  // где мапится [phase, theme]), поэтому переводится этой же функцией.
  Opening: "Дебют",
  Middlegame: "Миттельшпиль",
  Endgame: "Эндшпиль",
};

/** Human-readable Russian label for a puzzle theme. Unknown ids pass through. */
export function themeLabel(theme: string | undefined | null): string {
  if (!theme) return "";
  return THEME_RU[theme] ?? theme;
}

/** Exported for tests — how many ids the map covers. */
export const THEME_RU_KEYS = Object.keys(THEME_RU);
