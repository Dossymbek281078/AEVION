/**
 * Исходник БЕЗ комментариев — для сторожей, которые ищут по коду.
 *
 * Сторож «такая строка должна БЫТЬ» удовлетворяется совпадением в комментарии:
 * закомментируй проверяемое место — и он останется зелёным, охраняя пустоту.
 * Поймано мутацией 21.08.2026 на двух сторожах сразу.
 *
 * Копия помощника из бэкенда: наборы тестов раздельные, общего места нет.
 * Разбор — aevion-globus-backend/tests/helpers/sourceCode.ts.
 */
export function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trimStart();
      if (t.startsWith("//") || t.startsWith("*")) return "";
      const i = line.indexOf("//");
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join("\n");
}
