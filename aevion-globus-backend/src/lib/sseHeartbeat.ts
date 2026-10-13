import type { Response } from "express";

/**
 * Пульс SSE-потока: строка-комментарий `: hb` раз в everyMs, пока поток открыт.
 *
 * Повод (13.10.2026, путь гостя DevHub): сборка сайта зовёт модель без потока —
 * между «calling_model» и результатом клиент не получает ни байта 30–120 с.
 * Промежуточные прокси закрывают молчащее соединение, и человек видит обрыв
 * вместо ответа. Комментарии EventSource игнорирует, разметку событий не ломают.
 * Отказ записи (сокет закрыт) глотается намеренно — это уборка, а не действие (§16).
 */
export function sseHeartbeat(res: Response, everyMs = 15_000): () => void {
  const t = setInterval(() => {
    try { res.write(": hb\n\n"); } catch { /* сокет закрыт */ }
  }, everyMs);
  if (typeof (t as { unref?: () => void }).unref === "function") (t as { unref: () => void }).unref();
  let stopped = false;
  return () => { if (!stopped) { stopped = true; clearInterval(t); } };
}
