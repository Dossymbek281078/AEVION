"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvEscape = csvEscape;
exports.csvFromRows = csvFromRows;
/**
 * Минимальный CSV для экспортов MVP (RFC4180-совместимое экранирование кавычек).
 */
function csvEscape(v) {
    const s = v == null ? "" : String(v);
    const escaped = s.replace(/"/g, "\"\"");
    return `"${escaped}"`;
}
function csvFromRows(rows) {
    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
