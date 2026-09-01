/*
 * Отличить ОТРИСОВКУ и УПОТРЕБЛЕНИЕ имени от простого упоминания.
 *
 * Заведено 01.09.2026, после того как признак «имя есть в файле» дважды за
 * день соврал в двух разных сторожах этой ветки — и оба раза в сторону
 * ложного «всё хорошо» на денежном пути.
 *
 * Модуль общий намеренно: копия признака у каждого сторожа расходится с
 * оригиналом молча, и разницу видно только при сравнении.
 *
 * Разбор позиционный, без регулярок на классах символов: класс, собранный
 * строкой, у нас уже терял обратный слэш и делал сторожа пустым — он
 * компилировался, что-то находил и отвечал ровным нулём.
 */

function isWordChar(c: string): boolean {
  return c !== "" && /[A-Za-z0-9_]/.test(c);
}

/** Позиции имени, у которых СПРАВА граница слова (то есть не опечатка). */
function* boundedAt(text: string, name: string): Generator<number> {
  for (let from = 0; ; ) {
    const at = text.indexOf(name, from);
    if (at < 0) return;
    from = at + name.length;
    if (!isWordChar(text[from] ?? "")) yield at;
  }
}

/**
 * Отрисовывается ли компонент с таким именем.
 *
 * Граница нужна только СПРАВА. Слева имя почти всегда с приставкой: настоящая
 * кнопка апгрейда называется `PaddleUpgradeButton`, и голого `UpgradeButton` в
 * приложении нет ни одного — потребуй точного имени, сторож покраснел бы на
 * девяти исправных модулях. А справа `includes` совпадает и с
 * `UpgradeButtonX`: отрисовки с таким именем не существует, кнопка исчезла бы,
 * сторож остался бы зелёным.
 */
export function renders(text: string, name: string): boolean {
  for (const at of boundedAt(text, name)) {
    let start = at;
    while (start > 0 && isWordChar(text[start - 1])) start -= 1;
    if (text[start - 1] === "<") return true;
  }
  return false;
}

/**
 * Употребляется ли ИМЕННО это имя (переменная, поле, ключ).
 *
 * В отличие от компонента, здесь граница нужна с ОБЕИХ сторон: `payboxLive` и
 * `payboxLiveDraft` — разные вещи, приставке взяться неоткуда.
 */
export function usesIdentifier(text: string, name: string): boolean {
  for (const at of boundedAt(text, name)) {
    if (!isWordChar(text[at - 1] ?? "")) return true;
  }
  return false;
}
