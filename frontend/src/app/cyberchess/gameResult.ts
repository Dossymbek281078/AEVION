/* Исход сохранённой партии одной функцией.

   Было три разных классификации в трёх местах, и одна из них — в панели статистики
   по контролям — считала победы как `result.includes("win")`. Строка поражения
   «Checkmate — AI wins» тоже содержит "win", поэтому такая партия попадала И в
   победы, И в поражения; ничьи там считаются как total−w−l и уходили в МИНУС, а
   процент побед был завышен. Плюс «Time out» и «You resigned» не подходили ни под
   один фильтр и молча зачислялись в ничьи.

   Каноном взята та классификация, что уже стояла в расчёте серий: она верна для
   всех строк, которые ставит sOver(...). */
export function gameResultOf(result: string): "W" | "L" | "D" {
  if (result.includes("You win") || result.includes("win!")) return "W";
  if (result.includes("Draw") || result.includes("draw") || result.includes("Stalemate")) return "D";
  return "L";
}
