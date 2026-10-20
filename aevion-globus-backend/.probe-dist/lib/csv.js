"use strict";
/**
 * Минимальный CSV для экспортов MVP (RFC4180-совместимое экранирование кавычек)
 * ПЛЮС защита того, кто файл откроет.
 *
 * Удвоение кавычек закрывает структуру файла, но не читателя: значение,
 * начинающееся с `=`, `+`, `-`, `@` или управляющего символа, Excel и Google
 * Sheets трактуют как ФОРМУЛУ и исполняют при открытии. В выгрузках AEVION лежат
 * поля, которые заполняет посторонний — имя соискателя и сообщение, email и город
 * лида, referrer и utm-метки, заголовки объектов QRight и самый прямой случай:
 * `user_agent` в выгрузке просмотров QContract, который задаёт любой HTTP-клиент.
 * Открывает файл администратор, то есть путь «чужой ввод → машина админа»
 * существовал целиком (найдено 26.07.2026).
 *
 * Гасим ведущей одинарной кавычкой — стандартная мера против formula injection.
 * Обычные значения не страдают: `ivan@mail.ru` не начинается с `@`, поэтому под
 * правило не попадает, а текст с запятыми и кавычками экранируется как раньше.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvNeutralizeFormula = csvNeutralizeFormula;
exports.csvEscape = csvEscape;
exports.csvFromRows = csvFromRows;
/** Символы, с которых начинается формула в Excel / Google Sheets. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** Гасит формулу, не трогая остальное. Выделено отдельно, чтобы этой же защитой
 *  могли пользоваться экспорты со своим форматированием ячейки. */
function csvNeutralizeFormula(s) {
    return FORMULA_START.test(s) ? `'${s}` : s;
}
function csvEscape(v) {
    const s = csvNeutralizeFormula(v == null ? "" : String(v));
    const escaped = s.replace(/"/g, "\"\"");
    return `"${escaped}"`;
}
function csvFromRows(rows) {
    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
