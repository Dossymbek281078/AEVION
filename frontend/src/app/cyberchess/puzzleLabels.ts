/**
 * Подписи задач по-русски: тема и фаза партии.
 *
 * Замер 01.09.2026 по банку public/puzzles.json (10 818 задач):
 *   фаза   — по-английски у ВСЕХ: Middlegame 6767, Endgame 3557, Opening 494
 *   тема   — машинный идентификатор у 5079 из 10 818 (47%): advancedPawn,
 *            backRankMate, hangingPiece, kingsideAttack и так далее
 *
 * Человек видел на экране «Endgame» и «master» вместо «Эндшпиль» и названия
 * приёма. Тема — то, что подсказывает, ЧТО искать в позиции; идентификатор из
 * чужой базы не подсказывает ничего.
 *
 * Незнакомое значение показываем КАК ЕСТЬ, а не прочерком: незнакомая метка
 * честнее пустоты — по ней хотя бы видно, о чём задача, и в карту надо
 * дописать строку.
 */

const FAZA: Record<string, string> = {
  Opening: "Дебют",
  Middlegame: "Миттельшпиль",
  Endgame: "Эндшпиль",
};

/** Идентификаторы приёмов из открытой базы задач — в русские названия. */
const TEMA: Record<string, string> = {
  advancedPawn: "Продвинутая пешка",
  advantage: "Достижение перевеса",
  anastasiaMate: "Мат Анастасии",
  arabianMate: "Арабский мат",
  attackingF2F7: "Удар по f2/f7",
  attraction: "Завлечение",
  backRankMate: "Мат по последней горизонтали",
  balestraMate: "Мат балестра",
  bishopEndgame: "Слоновый эндшпиль",
  blindSwineMate: "Мат «слепые свиньи»",
  bodenMate: "Мат Бодена",
  capturingDefender: "Уничтожение защитника",
  clearance: "Освобождение поля",
  "collinear move": "Ход по одной линии",
  collinearMove: "Ход по одной линии",
  cornerMate: "Мат в углу",
  crushing: "Разгром",
  "defensive move": "Защитный ход",
  defensiveMove: "Защитный ход",
  deflection: "Отвлечение",
  discoveredAttack: "Вскрытое нападение",
  discoveredCheck: "Вскрытый шах",
  doubleBishopMate: "Мат двумя слонами",
  doubleCheck: "Двойной шах",
  dovetailMate: "Мат «ласточкин хвост»",
  epauletteMate: "Эполетный мат",
  equality: "Уравнение",
  exposedKing: "Открытый король",
  fork: "Вилка",
  hangingPiece: "Висящая фигура",
  hookMate: "Мат крючком",
  interference: "Перекрытие",
  intermezzo: "Промежуточный ход",
  killBoxMate: "Мат «коробка»",
  kingsideAttack: "Атака на королевском фланге",
  knightEndgame: "Коневой эндшпиль",
  long: "Длинная комбинация",
  master: "Партия мастера",
  mate: "Мат",
};

/** Тема задачи по-русски. Незнакомую отдаём как есть. */
export function temaZadachiRu(t: string | undefined | null): string {
  if (!t) return "";
  return TEMA[t] ?? t;
}

/** Фаза партии по-русски. Незнакомую отдаём как есть. */
export function fazaRu(f: string | undefined | null): string {
  if (!f) return "";
  return FAZA[f] ?? f;
}
