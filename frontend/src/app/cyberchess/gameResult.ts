/* Исход сохранённой партии одной функцией.

   Было три разных классификации в трёх местах, и одна из них — в панели статистики
   по контролям — считала победы как `result.includes("win")`. Строка поражения
   «Checkmate — AI wins» тоже содержит "win", поэтому такая партия попадала И в
   победы, И в поражения; ничьи там считаются как total−w−l и уходили в МИНУС, а
   процент побед был завышен. Плюс «Time out» и «You resigned» не подходили ни под
   один фильтр и молча зачислялись в ничьи.

   Каноном взята та классификация, что уже стояла в расчёте серий: она верна для
   всех строк, которые ставит sOver(...). */
/* Список строк ниже — полный набор того, что реально передаётся в sOver(...):
   "Checkmate! You win! 🏆", "Checkmate — AI wins", "Stalemate",
   "Threefold repetition", "Insufficient material", "50-move draw",
   "AI timed out — you win!", "Draw agreed", "Time out", "You resigned",
   "Ничья (договорились)", "<соперник> сдался — Вы победили!".

   Первая версия этой функции знала не все: тройное повторение, недостаток
   материала и русская «Ничья (договорились)» уходили в поражения, а победа в
   партии с живым соперником («сдался — Вы победили!») — тоже в поражения.
   Здесь считается рейтинг и серии, поэтому промах стоит игроку рейтинга. */
export function gameResultOf(result: string): "W" | "L" | "D" {
  const r = result.toLowerCase();
  if (r.includes("you win") || r.includes("win!") || r.includes("вы победили")) return "W";
  if (
    r.includes("draw") ||
    r.includes("stalemate") ||
    r.includes("repetition") ||
    r.includes("insufficient") ||
    r.includes("ничья") ||
    r.includes("пат")
  ) return "D";
  return "L";
}
