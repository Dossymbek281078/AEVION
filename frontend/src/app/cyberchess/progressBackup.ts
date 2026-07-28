/* Резервная копия прогресса игрока — весь CyberChess одним файлом.
 *
 * Зачем. В отличие от Lichess и Chess.com у нас нет аккаунтов: ВЕСЬ прогресс —
 * рейтинг, кошелёк Chessy, достижения, серии, решённые пазлы, репертуар, база
 * знаний тренера, история партий — лежит в localStorage одного браузера. Очистка
 * данных сайта, режим инкогнито, переустановка системы или переход на другой
 * компьютер стирают всё без следа и без предупреждения. Это самая дорогая
 * структурная слабость модуля, и чинится она без бэкенда.
 *
 * Что здесь. Сбор всех наших ключей в один JSON и обратная заливка с проверками.
 * Функции чистые: работа с хранилищем передаётся параметром, поэтому всё
 * проверяется тестами без браузера.
 */

/* Префиксы НАШИХ ключей. Их два, и это не мелочь: изначально здесь стоял только
   "aevion", а под "cc_" в CyberChess лежит 28 ключей — среди них весь дебютный
   репертуар (`cc_opening_repertoire_v1`), калибровка FIDE, серия входов и счётчики
   достижений. То есть «резервная копия всего прогресса» молча не сохраняла часть
   того, что сама же обещала в интерфейсе, а «Сбросить ВСЁ» столько же оставляла
   на диске. Проверять список надо грепом по localStorage, а не памятью. */
const PREFIXES = ["aevion", "cc_"] as const;

/** Верхняя граница файла — защита от заливки чужого многомегабайтного JSON. */
const MAX_BYTES = 8 * 1024 * 1024;

export type ProgressBackup = {
  v: 1;
  app: "cyberchess";
  exportedAt: string;
  keys: Record<string, string>;
};

/** Минимальный интерфейс хранилища — ровно то, что нужно, и легко подменяется в тесте. */
export type KeyValueStore = {
  length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

const isOurs = (k: string) => PREFIXES.some((p) => k.startsWith(p));

/** Все наши ключи, что сейчас в хранилище. Перечисление, а не список в коде:
 *  список ключей руками стареет молча — в настройках такой список из 14 имён
 *  стоял за кнопкой «Сбросить ВСЁ» при 85 реально используемых ключах. */
export function ourKeys(store: KeyValueStore): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && isOurs(k)) out.push(k);
  }
  return out;
}

/** Собирает все наши ключи в объект резервной копии. */
export function collectProgress(store: KeyValueStore, now: string): ProgressBackup {
  const keys: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !isOurs(k)) continue;
    const v = store.getItem(k);
    if (typeof v === "string") keys[k] = v;
  }
  return { v: 1, app: "cyberchess", exportedAt: now, keys };
}

export type ParseResult =
  | { ok: true; backup: ProgressBackup }
  | { ok: false; reason: string };

/**
 * Разбирает содержимое файла. Отвергает всё, что не наша резервная копия —
 * сообщением, которое можно показать человеку, а не молчанием.
 */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BYTES) return { ok: false, reason: "Файл слишком большой" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Это не JSON" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "Ожидался объект резервной копии" };
  }
  const r = raw as Record<string, unknown>;
  if (r.app !== "cyberchess") return { ok: false, reason: "Копия не от CyberChess" };
  if (r.v !== 1) return { ok: false, reason: `Неизвестная версия копии: ${String(r.v)}` };
  const keys = r.keys;
  if (typeof keys !== "object" || keys === null || Array.isArray(keys)) {
    return { ok: false, reason: "В копии нет раздела с данными" };
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys as Record<string, unknown>)) {
    // Чужой ключ в файле — не повод отвергнуть копию целиком, но записывать его нельзя:
    // иначе подсунутый файл пишет во что угодно в домене.
    if (!isOurs(k) || typeof v !== "string") continue;
    clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return { ok: false, reason: "В копии нет данных CyberChess" };
  return {
    ok: true,
    backup: {
      v: 1,
      app: "cyberchess",
      exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : "",
      keys: clean,
    },
  };
}

export type ApplyMode = "replace" | "merge";

export type ApplyReport = { written: number; kept: number; removed: number };

/**
 * Заливает копию в хранилище.
 *  replace — состояние становится в точности как в копии: наши ключи, которых в
 *            копии нет, удаляются. Так восстанавливают «как было».
 *  merge   — копия дополняет текущее: существующие ключи не трогаются. Так
 *            переносят прогресс на машину, где уже что-то наиграно.
 * Чужие ключи не трогаются никогда, ни в одном режиме.
 */
export function applyProgress(store: KeyValueStore, backup: ProgressBackup, mode: ApplyMode): ApplyReport {
  const existing: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && isOurs(k)) existing.push(k);
  }
  let written = 0;
  let kept = 0;
  let removed = 0;
  for (const [k, v] of Object.entries(backup.keys)) {
    if (mode === "merge" && store.getItem(k) !== null) {
      kept++;
      continue;
    }
    store.setItem(k, v);
    written++;
  }
  if (mode === "replace") {
    for (const k of existing) {
      if (!(k in backup.keys)) {
        store.removeItem(k);
        removed++;
      }
    }
  }
  return { written, kept, removed };
}

/** Имя файла — с датой, чтобы копии не перетирали друг друга в папке «Загрузки». */
export function backupFilename(now: string): string {
  const day = now.slice(0, 10) || "unknown";
  return `cyberchess-progress-${day}.json`;
}
