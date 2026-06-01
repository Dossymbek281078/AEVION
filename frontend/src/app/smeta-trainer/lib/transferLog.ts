"use client";

/**
 * Лог передач во вкладку с экзаменом — отдельно от журнала оценок (examJournal),
 * чтобы не засорять агрегаты попыток. Фиксирует каждый успешно применённый поток:
 *   • rate    — расценка из каталога / учебный аналог реальной позиции
 *   • value   — объём из калькулятора
 *   • formula — формула из шпаргалки
 *
 * Хранение локальное (localStorage). Показывается на /exam-journal отдельным блоком.
 */

const STORAGE_KEY = "smeta-trainer:transfer-log:v1";
const MAX_ENTRIES = 200;

export type TransferKind = "rate" | "value" | "formula";

export interface TransferEntry {
  id: string;
  kind: TransferKind;
  /** rateCode для rate, число для value, текст формулы для formula. */
  detail: string;
  /** Человекочитаемая подпись (наименование расценки / метка). */
  label?: string;
  examId: string;
  taskTitle?: string;
  timestamp: string;
}

function safeRead(): TransferEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TransferEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: TransferEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota */
  }
}

export function logTransfer(
  args: Omit<TransferEntry, "id" | "timestamp">,
): TransferEntry {
  const entry: TransferEntry = {
    id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...args,
  };
  const all = safeRead();
  all.push(entry);
  // держим хвост MAX_ENTRIES, чтобы не раздувать localStorage
  safeWrite(all.slice(-MAX_ENTRIES));
  return entry;
}

export function loadTransfers(): TransferEntry[] {
  return safeRead();
}

export interface TransferStats {
  total: number;
  byKind: Record<TransferKind, number>;
}

export function transferStats(): TransferStats {
  const all = safeRead();
  const byKind: Record<TransferKind, number> = { rate: 0, value: 0, formula: 0 };
  for (const e of all) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  return { total: all.length, byKind };
}

export function clearTransfers(): void {
  safeWrite([]);
}
