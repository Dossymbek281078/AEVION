/**
 * Одна поддельная база на все шахматные тесты.
 *
 * Зачем. За два дня подделки ТРИЖДЫ отстали от настоящего драйвера, и каждый
 * раз это скрывало дефект или ломало зелёный набор:
 *
 *   1. мок не возвращал `rowCount` — код начал считать записанные строки, и
 *      счётчик всюду показывал ноль;
 *   2. мок не отдавал поле эпохи, которое запрос стал просить у базы;
 *   3. заглушка модуля не экспортировала новый счётчик — роутер получил
 *      undefined.
 *
 * Пока каждый тест лепит свою подделку, это будет повторяться: расходятся они
 * поодиночке и молча. Здесь собраны УМОЛЧАНИЯ, одинаковые с настоящим pg, а
 * тест дописывает только то, что важно ему.
 *
 * Главное правило этого файла: подделка обязана отвечать ТАК ЖЕ, как база.
 * Мок, отвечающий иначе, красит тесты в любой цвет, кроме верного.
 */

export interface FakeQueryResult {
  rows: unknown[];
  /** Настоящий pg отдаёт rowCount ВСЕГДА. Забыть его — обычный источник лжи. */
  rowCount: number;
}

export type FakeHandler = (text: string, params: unknown[]) => FakeQueryResult | Promise<FakeQueryResult> | undefined;

export interface FakePgOptions {
  /** Ответы по порядку: первый вернувший результат и выигрывает. */
  handlers?: FakeHandler[];
  /** Запросы, которые должны бросать. Полезно для проверки путей отказа. */
  failOn?: RegExp | null;
  /** Задержка ответа: без неё «зелёный» тест часто зелен из-за мгновенности. */
  delayMs?: number;
  /** Журнал всех запросов — для проверок «спросили ли то, что нужно». */
  log?: Array<{ text: string; params: unknown[] }>;
}

/** Результат с корректным rowCount, посчитанным по строкам. */
export function rows(list: unknown[]): FakeQueryResult {
  return { rows: list, rowCount: list.length };
}

/** Ответ на запись: строк не возвращает, но rowCount у настоящей базы есть. */
export function written(n = 1): FakeQueryResult {
  return { rows: [], rowCount: n };
}

/**
 * Класс Pool, совместимый по поведению с pg.
 *
 * CREATE TABLE и всё нераспознанное отвечают пустым результатом С rowCount — не
 * `{ rows: [] }`, потому что именно эта разница уже стоила дня разбирательств.
 */
export function makeFakePool(opts: FakePgOptions = {}) {
  const { handlers = [], failOn = null, delayMs = 0, log } = opts;

  return class Pool {
    async query(text: string, params: unknown[] = []): Promise<FakeQueryResult> {
      log?.push({ text, params });
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      if (failOn && failOn.test(text)) throw new Error("connection terminated unexpectedly");
      for (const h of handlers) {
        const r = await h(text, params);
        if (r) return r;
      }
      return written(0);
    }
    on(): void {
      /* pg.Pool умеет подписки; тестам они не нужны, но метод должен быть */
    }
    async end(): Promise<void> {
      /* закрытие пула */
    }
  };
}
