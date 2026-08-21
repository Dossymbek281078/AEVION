import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";

/**
 * Локальное хранилище MVP-модулей (QTrade и т.д.).
 * Переопределите AEVION_DATA_DIR для Docker/прода.
 */
export function getAevionDataDir(): string {
  const raw = process.env.AEVION_DATA_DIR;
  if (raw && raw.trim()) return path.resolve(raw.trim());
  return path.join(process.cwd(), ".aevion-data");
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const full = path.join(getAevionDataDir(), relativePath);
  try {
    const raw = await fs.promises.readFile(full, "utf8");
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.error(`[jsonFileStore] повреждён JSON, сброс к fallback: ${relativePath}`);
      return fallback;
    }
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string"
        ? (e as { code: string }).code
        : "";
    if (code === "ENOENT") return fallback;
    throw e;
  }
}

// Незавершённые temp-файлы: подметаем один раз на путь за процесс.
//
// Запись идёт через temp → rename. Если процесс умер между этими шагами
// (деплой, перезапуск, падение), temp остаётся навсегда — а в нём ПОЛНАЯ
// копия данных файла, включая секреты вебхуков. Найден такой после обычного
// прогона тестов: `qtrade.json.<pid>.<ts>.<rand>.tmp` рядом с `qtrade.json`.
//
// Один readdir на файл за жизнь процесса — этого достаточно, чтобы мусор не
// копился месяцами, и незаметно по цене. Возраст: старше 10 минут, чтобы не
// тронуть чужую запись, идущую прямо сейчас в соседнем процессе.
const sweptPaths = new Set<string>();
const TMP_MAX_AGE_MS = 10 * 60_000;

async function sweepStaleTemps(dir: string, base: string): Promise<void> {
  const key = path.join(dir, base);
  if (sweptPaths.has(key)) return;
  sweptPaths.add(key);
  try {
    const now = Date.now();
    for (const entry of await fs.promises.readdir(dir)) {
      if (!entry.startsWith(`${base}.`) || !entry.endsWith(".tmp")) continue;
      const victim = path.join(dir, entry);
      try {
        const st = await fs.promises.stat(victim);
        if (now - st.mtimeMs > TMP_MAX_AGE_MS) await fs.promises.unlink(victim);
      } catch {
        // Файл уже унесли или переименовали — это нормальная гонка, не ошибка.
      }
    }
  } catch {
    // Каталога ещё нет либо он недоступен: подметать нечего.
  }
}

async function writeUnlocked(relativePath: string, data: unknown): Promise<void> {
  const dir = getAevionDataDir();
  const full = path.join(dir, relativePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await sweepStaleTemps(dir, path.basename(relativePath));
  // Имя temp-файла собиралось из pid и миллисекунды — два писателя в одну
  // миллисекунду брали ОДИН путь, и второй rename падал с ENOENT: файл уже
  // унесли. Случайный хвост убирает совпадение.
  const tmp = `${full}.${process.pid}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
  const json = JSON.stringify(data);
  await fs.promises.writeFile(tmp, json, "utf8");
  await renameWithRetry(tmp, full);
}

/**
 * Переименование с коротким повтором при EPERM.
 *
 * ЗАПИСИ в один файл выстроены в очередь (withFileLock), а ЧТЕНИЯ — нет, и
 * это осознанно: сериализовать чтения значит платить пропускной способностью
 * за редкую коллизию. Но на Windows переименование поверх файла, который
 * прямо сейчас читают, падает с `EPERM: operation not permitted`.
 *
 * Замер 19.08.2026: в мультичате удаление беседы, идущее одновременно с
 * чтением списка, падало 500 — воспроизводилось 5 из 5. Комментарий двумя
 * абзацами выше этот случай ПРЕДСКАЗЫВАЛ, но закрыт он не был.
 *
 * На Linux (и в CI) такого нет — там переименование поверх открытого файла
 * разрешено, поэтому дефект видели только на машинах разработчиков, и каждая
 * сессия принимала его за свою поломку.
 *
 * Читатель отпускает файл за миллисекунды, поэтому лестницы задержек хватает
 * с запасом. Всё, что не EPERM/EACCES, пробрасывается сразу: молча повторять
 * незнакомую ошибку — значит прятать её.
 */
async function renameWithRetry(tmp: string, full: string): Promise<void> {
  const DELAYS_MS = [5, 15, 40, 100, 250];
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(tmp, full);
      return;
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string"
          ? (e as { code: string }).code
          : "";
      if ((code !== "EPERM" && code !== "EACCES") || attempt >= DELAYS_MS.length) throw e;
      await new Promise((r) => setTimeout(r, DELAYS_MS[attempt]));
    }
  }
}

/**
 * Атомарная запись: temp → rename (один файл на модуль).
 *
 * Записи в ОДИН файл выстраиваются в очередь. Не ради «чище»: на Windows
 * параллельный rename в занятый путь падает с EPERM, а до этого — с ENOENT
 * на совпавшем имени temp. Отказ при этом прилетал не в тот запрос, который
 * его вызвал, и, например, в chatHistory тихо глох в catch.
 */
export function writeJsonFile(relativePath: string, data: unknown): Promise<void> {
  return withFileLock(relativePath, () => writeUnlocked(relativePath, data));
}

// ─── Изменение файла целиком: read → мутация → write под замком ────────────
//
// Атомарна здесь только САМА запись (temp → rename). Пара «прочитал —
// изменил — записал» атомарной не была никогда: два параллельных обработчика
// читают один и тот же массив и оба пишут свою версию, второй затирает
// первого. Отказа при этом нет — оба запроса успешны, файл валиден, просто
// данных в нём меньше, чем записали.
//
// Живой случай 2026-08-10: веер мультичата пишет ответы трёх агентов через
// Promise.all — в ленте оседал один ответ из трёх. Postgres-ветки это не
// касается (каждый INSERT самостоятелен), поэтому на проде с DATABASE_URL
// баг невидим, а на любом стенде без БД — тихая потеря данных.
//
// Замок — на путь файла и в пределах процесса: этого достаточно, потому что
// файловое хранилище и есть однопроцессный fallback. Несколько процессов на
// один каталог данных не поддерживаются (и до этой правки не поддерживались).

const fileLocks = new Map<string, Promise<unknown>>();

/** Выполняет операцию, не пуская параллельную работу с ТЕМ ЖЕ файлом.
 *  Замок на путь, а не на всё хранилище: медленный модуль не должен
 *  тормозить остальные. */
async function withFileLock<T>(relativePath: string, op: () => Promise<T>): Promise<T> {
  const key = path.join(getAevionDataDir(), relativePath);
  const prev = fileLocks.get(key) ?? Promise.resolve();

  // Ждём предшественника независимо от того, чем он кончился: чужая ошибка
  // не должна ни отменять нашу запись, ни рвать очередь.
  const task = prev.then(op, op);
  const tail = task.then(
    () => undefined,
    () => undefined,
  );
  fileLocks.set(key, tail);

  try {
    return await task;
  } finally {
    // Убирает за собой только последний в очереди: если за нами уже встал
    // следующий, он заменил хвост, и удалять его нельзя. Без этой проверки
    // Map растёт на каждый файл и держит промисы до конца жизни процесса.
    if (fileLocks.get(key) === tail) fileLocks.delete(key);
  }
}

/**
 * Прочитать файл, изменить и записать обратно — не пуская параллельный
 * вызов между чтением и записью того же файла.
 *
 * `mutator` получает текущее значение и возвращает то, что надо записать
 * (можно менять на месте и вернуть его же). Возвращается записанное
 * значение — чтобы обработчику не приходилось читать файл повторно.
 *
 * Используйте вместо пары readJsonFile + writeJsonFile везде, где новое
 * значение зависит от старого: добавление в список, счётчик, перевод
 * средств. Для полной перезаписи (значение от старого не зависит)
 * writeJsonFile по-прежнему достаточно.
 */
export function updateJsonFile<T>(
  relativePath: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>,
): Promise<T> {
  return withFileLock(relativePath, async () => {
    const current = await readJsonFile<T>(relativePath, fallback);
    const next = await mutator(current);
    // Внутренняя запись, минуя публичную: та берёт тот же замок и встала бы
    // в очередь сама за собой.
    await writeUnlocked(relativePath, next);
    return next;
  });
}
