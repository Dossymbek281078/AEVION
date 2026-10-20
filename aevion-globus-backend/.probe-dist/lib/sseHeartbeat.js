"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseHeartbeat = sseHeartbeat;
/**
 * Пульс SSE-потока: строка-комментарий `: hb` раз в everyMs, пока поток открыт.
 *
 * Повод (13.10.2026, путь гостя DevHub): сборка сайта зовёт модель без потока —
 * между «calling_model» и результатом клиент не получает ни байта 30–120 с.
 * Промежуточные прокси закрывают молчащее соединение, и человек видит обрыв
 * вместо ответа. Комментарии EventSource игнорирует, разметку событий не ломают.
 * Отказ записи (сокет закрыт) глотается намеренно — это уборка, а не действие (§16).
 */
function sseHeartbeat(res, everyMs = 15000) {
    const t = setInterval(() => {
        try {
            res.write(": hb\n\n");
        }
        catch { /* сокет закрыт */ }
    }, everyMs);
    if (typeof t.unref === "function")
        t.unref();
    let stopped = false;
    return () => { if (!stopped) {
        stopped = true;
        clearInterval(t);
    } };
}
