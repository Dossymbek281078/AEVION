/**
 * Минимальный CSV для экспортов MVP (RFC4180-совместимое экранирование кавычек).
 */
export function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  const escaped = s.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export function csvFromRows(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
