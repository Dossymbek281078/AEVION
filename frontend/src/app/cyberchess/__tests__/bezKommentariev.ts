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
    .map(obrezatHvost)
    .join(NL);
}

/**
 * Строчный комментарий В КОНЦЕ строки кода. Прежняя версия убирала только
 * строки, начинающиеся с «//», и потому оставляла `const a = 1; // sample data`
 * целиком — сторож краснел на пояснении, а описание функции обещало, что
 * строчные комментарии вырезаются. Обещание и поведение разошлись молча.
 *
 * Осторожно с двумя случаями, где «//» не комментарий:
 *   https://… — перед ним двоеточие;
 *   "a//b"    — внутри строки, кавычек до него нечётное число.
 */
function obrezatHvost(stroka: string): string {
  const KAV = ['"', "'", "`"];
  for (let i = 0; i + 1 < stroka.length; i++) {
    if (stroka[i] !== "/" || stroka[i + 1] !== "/") continue;
    if (i > 0 && stroka[i - 1] === ":") continue;
    let vnutri = false;
    let otkryta = "";
    for (let j = 0; j < i; j++) {
      const c = stroka[j];
      if (!KAV.includes(c)) continue;
      if (j > 0 && stroka[j - 1] === String.fromCharCode(92)) continue;
      if (!vnutri) { vnutri = true; otkryta = c; }
      else if (c === otkryta) { vnutri = false; }
    }
    if (vnutri) continue;
    return stroka.slice(0, i);
  }
  return stroka;
}
