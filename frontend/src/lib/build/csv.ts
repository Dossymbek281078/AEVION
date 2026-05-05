// Tiny client-side CSV emitter for export bundles. We deliberately avoid
// pulling a CSV library — quoting + escape rules below are RFC 4180.

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  // Union of all keys across rows so column order is stable even when
  // optional fields are missing on some rows.
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  const escape = (v: unknown): string => {
    if (v == null) return "";
    let s: string;
    if (v instanceof Date) s = v.toISOString();
    else if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = keys.map(escape).join(",");
  const body = rows
    .map((r) => keys.map((k) => escape((r as Record<string, unknown>)[k])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
