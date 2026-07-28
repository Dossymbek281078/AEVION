/* Проверка сообщений чата зрителей.
 *
 * Текст пишут посторонние люди, а список приходил в компонент приведением типа:
 * `setMessages(data.messages as ChatMessage[])`. Приведение ничего не проверяет,
 * поэтому элемент с нестроковым `text` доходил до разметки как есть — React
 * отказывается рендерить объект и роняет всю панель чата, а не одно сообщение.
 *
 * Здесь список чистится: элементы неправильной формы выбрасываются, текст и имя
 * ограничиваются по длине. Функция чистая — проверяется без браузера.
 */

export type ChatMessage = {
  id: string;
  author: string;
  text: string;
  ts: number;
  isHost?: boolean;
};

/** Длиннее этого сообщение не показываем: одна строка не должна разносить панель. */
const TEXT_MAX = 500;
/** И имя тоже. */
const AUTHOR_MAX = 32;

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);

/**
 * Оставляет только пригодные сообщения. Одно кривое сообщение выбрасывается,
 * остальные показываются — раньше оно уносило с собой всю панель.
 */
export function sanitizeChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const m = item as Record<string, unknown>;
    if (typeof m.text !== "string" || !m.text.trim()) continue;
    const id = typeof m.id === "string" && m.id ? m.id : `${out.length}-${String(m.ts ?? "")}`;
    out.push({
      id,
      author: typeof m.author === "string" && m.author.trim() ? cut(m.author.trim(), AUTHOR_MAX) : "Зритель",
      text: cut(m.text, TEXT_MAX),
      ts: typeof m.ts === "number" && Number.isFinite(m.ts) ? m.ts : 0,
      isHost: m.isHost === true,
    });
  }
  return out;
}
