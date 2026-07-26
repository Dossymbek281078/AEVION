/**
 * Учёт скидок, которые мы пообещали и НЕ применили.
 *
 * Зачем: на каналах с фиксированной ценой (LemonSqueezy без
 * `LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE=1`, Gumroad по permalink) наша сумма со
 * скидкой до счёта не доходит — покупателю показали «−$21.80», а списали полную
 * цену. До 2026-07-26 этого никто не считал: расхождение не логировалось и не
 * попадало ни в один дашборд. Здесь оно становится числом, на которое можно
 * смотреть: сколько сессий, на каком канале, на какую сумму.
 *
 * Пишется только АГРЕГАТ: канал, тариф, сумма упущенной скидки, время. Никаких
 * email и id — та же позиция, что у lib/paywallDenyLog.ts, чей паттерн этот
 * файл повторяет намеренно (DB-optional, best-effort, fire-and-forget): нет
 * доступной базы → запись no-op, чтение падает на счётчики в памяти процесса.
 * Второй способ делать то же самое здесь не нужен.
 */
import { getPool } from "./dbPool";

const PRUNE_DAYS = 180;

/**
 * Состояние доступности базы + КОГДА проверяли.
 *
 * Раньше здесь стоял одноразовый флаг `ensured`: первая неудачная попытка
 * выключала запись метрики НАВСЕГДА — до редеплоя. А неудачная первая попытка
 * это не гипотеза: 2026-07-26 в живом прогоне первый запрос к Postgres после
 * старта процесса падал (холодный пул), и это же наблюдение заставило добавить
 * ретрай в lib/appSubscriptions.ts. То есть один блип на старте — и расхождений
 * «обещали/списали» мы бы не видели весь срок жизни процесса, ничего при этом
 * не заметив.
 *
 * Теперь: успех кэшируется навсегда (дёшево), неудача — не более чем на минуту.
 *
 * ⚠️ Тот же одноразовый флаг есть в lib/paywallDenyLog.ts (чужой код, шаблон
 * которого я здесь повторял). Там ровно та же дыра — стоит поправить владельцу.
 */
let dbUsable: boolean | null = null;
let lastEnsureAt = 0;
const ENSURE_RETRY_MS = 60_000;

/** Счётчики в памяти процесса: и фолбэк, и быстрый ответ «с момента старта». */
const mem = {
  bootedAt: new Date().toISOString(),
  sessions: 0,
  withIncentive: 0,
  notHonoured: 0,
  droppedUsd: 0,
  byProvider: new Map<string, { notHonoured: number; droppedUsd: number }>(),
};

async function ensureTable(): Promise<boolean> {
  if (dbUsable === true) return true;
  if (dbUsable === false && Date.now() - lastEnsureAt < ENSURE_RETRY_MS) return false;
  lastEnsureAt = Date.now();
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "discount_integrity_log" (
        "id"          BIGSERIAL PRIMARY KEY,
        "ts"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "provider"    TEXT NOT NULL,
        "tier"        TEXT NOT NULL,
        "droppedUsd"  NUMERIC(10,2) NOT NULL,
        "quotedUsd"   NUMERIC(10,2) NOT NULL
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS "discount_integrity_log_provider_ts_idx" ON "discount_integrity_log" ("provider", "ts");`,
    );
    try {
      await pool.query(`DELETE FROM "discount_integrity_log" WHERE "ts" < NOW() - INTERVAL '${PRUNE_DAYS} days'`);
    } catch {
      /* best-effort */
    }
    dbUsable = true;
  } catch (e: any) {
    dbUsable = false;
    console.warn(`[discountIntegrity] DB unavailable — persistence off: ${e?.message || e}`);
  }
  return dbUsable === true;
}

/** Одна сессия чекаута. Never throws, never blocks the response path. */
export function recordCheckoutSession(input: {
  provider: string;
  tier: string;
  incentiveUsd: number;
  quotedUsd: number;
  honoured: boolean;
}): void {
  mem.sessions++;
  if (input.incentiveUsd > 0) mem.withIncentive++;
  const dropped = input.incentiveUsd > 0 && !input.honoured;
  if (!dropped) return;

  mem.notHonoured++;
  mem.droppedUsd = Math.round((mem.droppedUsd + input.incentiveUsd) * 100) / 100;
  const slot = mem.byProvider.get(input.provider) ?? { notHonoured: 0, droppedUsd: 0 };
  slot.notHonoured++;
  slot.droppedUsd = Math.round((slot.droppedUsd + input.incentiveUsd) * 100) / 100;
  mem.byProvider.set(input.provider, slot);

  void (async () => {
    try {
      if (!(await ensureTable())) return;
      await getPool().query(
        `INSERT INTO "discount_integrity_log" ("provider","tier","droppedUsd","quotedUsd") VALUES ($1,$2,$3,$4)`,
        [input.provider, input.tier, input.incentiveUsd, input.quotedUsd],
      );
    } catch {
      /* best-effort — drop silently */
    }
  })();
}

export interface IntegritySummary {
  windowDays: number;
  /** "db" — цифры за окно из базы; "memory" — только с момента старта процесса. */
  source: "db" | "memory";
  /** Заполнено только при source="memory" — чтобы цифру не прочитали как «за всё время». */
  bootedAt?: string;
  sessions: number;
  withIncentive: number;
  notHonoured: number;
  droppedUsdTotal: number;
  notHonouredRatio: number;
  byProvider: Array<{ provider: string; notHonoured: number; droppedUsd: number }>;
}

function memSummary(windowDays: number): IntegritySummary {
  return {
    windowDays,
    source: "memory",
    bootedAt: mem.bootedAt,
    sessions: mem.sessions,
    withIncentive: mem.withIncentive,
    notHonoured: mem.notHonoured,
    droppedUsdTotal: mem.droppedUsd,
    notHonouredRatio: mem.withIncentive > 0 ? Math.round((mem.notHonoured / mem.withIncentive) * 1000) / 1000 : 0,
    byProvider: [...mem.byProvider.entries()].map(([provider, v]) => ({ provider, ...v })),
  };
}

/**
 * Сводка за N дней. Из базы, если она доступна; иначе — счётчики с момента
 * старта процесса, и `source: "memory"` + `bootedAt` говорят об этом прямо.
 *
 * ВАЖНО: `sessions`/`withIncentive` считаются только в памяти (в базу пишутся
 * лишь расхождения — писать строку на каждую успешную сессию значило бы
 * складывать в таблицу мусор). Поэтому при source="db" эти два поля остаются
 * «с момента старта», а notHonoured/droppedUsd — за окно. Расхождение природы
 * полей отмечено в ответе, чтобы никто не поделил одно на другое и не получил
 * бессмысленную долю.
 */
export async function integritySummary(windowDays: number): Promise<IntegritySummary> {
  const days = Math.max(1, Math.min(365, Math.floor(windowDays) || 30));
  if (!(await ensureTable())) return memSummary(days);
  try {
    const pool = getPool();
    // Пул нетипизирован (см. lib/dbPool.ts) — приводим rows так же, как это
    // делает lib/paywallDenyLog.ts, а не через generic у query().
    const result = await pool.query(
      `SELECT "provider", COUNT(*)::text AS n, COALESCE(SUM("droppedUsd"),0)::text AS dropped
         FROM "discount_integrity_log"
        WHERE "ts" > NOW() - ($1 || ' days')::interval
        GROUP BY "provider"
        ORDER BY 3 DESC`,
      [String(days)],
    );
    const rows = result.rows as Array<{ provider: string; n: string; dropped: string }>;
    const byProvider = rows.map((r) => ({
      provider: r.provider,
      notHonoured: Number(r.n),
      droppedUsd: Math.round(Number(r.dropped) * 100) / 100,
    }));
    const notHonoured = byProvider.reduce((acc, r) => acc + r.notHonoured, 0);
    const droppedUsdTotal = Math.round(byProvider.reduce((acc, r) => acc + r.droppedUsd, 0) * 100) / 100;
    return {
      windowDays: days,
      source: "db",
      sessions: mem.sessions,
      withIncentive: mem.withIncentive,
      notHonoured,
      droppedUsdTotal,
      notHonouredRatio: mem.withIncentive > 0 ? Math.round((notHonoured / mem.withIncentive) * 1000) / 1000 : 0,
      byProvider,
    };
  } catch (e: any) {
    console.warn(`[discountIntegrity] read failed, falling back to memory: ${e?.message || e}`);
    return memSummary(days);
  }
}
