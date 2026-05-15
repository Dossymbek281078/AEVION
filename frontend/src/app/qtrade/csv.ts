// CSV builder for closed trades. Pure (no DOM), so unit-testable.
// Excel-friendly: CRLF newlines, leading BOM, quoted-when-needed cells.

import type { ClosedPosition } from "./marketSim";

export const TRADES_CSV_HEADER = [
  "id",
  "pair",
  "side",
  "qty",
  "entryPrice",
  "exitPrice",
  "entryTs",
  "exitTs",
  "holdMs",
  "realizedPnl",
  "realizedPct",
  "tags",
  "notes",
] as const;

const NEEDS_QUOTE_RE = /[",\r\n]/;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (NEEDS_QUOTE_RE.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isoTs(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

export function buildTradesCsv(closed: ClosedPosition[]): string {
  const lines: string[] = [TRADES_CSV_HEADER.join(",")];
  for (const c of closed) {
    const tags = (c.tags ?? []).join(" ");
    const row = [
      c.id,
      c.pair,
      c.side,
      c.qty,
      c.entryPrice,
      c.exitPrice,
      isoTs(c.entryTs),
      isoTs(c.exitTs),
      Math.max(0, (c.exitTs ?? 0) - (c.entryTs ?? 0)),
      c.realizedPnl,
      c.realizedPct,
      tags,
      c.notes ?? "",
    ].map(csvCell);
    lines.push(row.join(","));
  }
  // CRLF for Excel compatibility, BOM for UTF-8 detection
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `qtrade-trades-${stamp}.csv`;
}

// Browser download helper. Returns true if dispatched.
export function downloadTradesCsv(closed: ClosedPosition[]): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (closed.length === 0) return false;
  try {
    const csv = buildTradesCsv(closed);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
