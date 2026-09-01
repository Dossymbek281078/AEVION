/**
 * Вырезает комментарии всех трёх видов: строчные, блочные и JSX.
 *
 * Нужно сторожам, которые ищут слова в ТЕКСТЕ ДЛЯ ЧЕЛОВЕКА: пояснение к коду
 * человек не читает и диктор не произносит, а «AI Voice Coach» или
 * «CPI-бейдж» в комментарии — это название, а не подпись. Без вырезания
 * сторож краснеет на пояснениях, и его начинают отключать.
 *
 * Маркеры собраны из кусков намеренно: написанные целиком, они закрыли бы
 * комментарий этого же файла.
 */
const OTKR = "/" + "*";
const ZAKR = "*" + "/";
const NL = String.fromCharCode(10);

export function bezKommentariev(kod: string): string {
  const bezBlochnyh = kod
    .split(OTKR)
    .map((k, i) => (i === 0 ? k : k.slice(k.indexOf(ZAKR) + 2)))
    .join(" ");
  return bezBlochnyh
    .split(NL)
    .filter((l) => !l.trim().startsWith("//"))
    .join(NL);
}
