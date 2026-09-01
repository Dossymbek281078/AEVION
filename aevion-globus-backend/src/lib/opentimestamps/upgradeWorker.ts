import { getPool } from "../dbPool";
import { upgradeProof } from "./anchor";

/**
 * Фоновое дообновление якорей OpenTimestamps.
 *
 * ЗАЧЕМ. При регистрации работы хеш уходит в календари OpenTimestamps, и ответ
 * приходит сразу — но НЕПОЛНЫЙ: подтверждение появляется, когда календарь
 * внесёт свою запись в блок биткойна, обычно через несколько часов. Забрать
 * полное доказательство умеет ручка POST /api/pipeline/ots/:certId/upgrade.
 *
 * Замер 28.08.2026: `upgradeProof` вызывался РОВНО В ОДНОМ месте — в этой самой
 * ручке, которую должен нажать сам человек, вернувшись на страницу. Ни
 * расписания, ни фоновой задачи, ни скрипта в .github/workflows не было.
 *
 * Следствие: сертификат оставался в состоянии `pending` бессрочно, пока автор
 * не вспомнит зайти. Якорь в биткойне при этом РЕАЛЬНО существовал — календарь
 * своё дело сделал; не хватало только нашего запроса. А любой, кто проверяет
 * сертификат — суд, работодатель, площадка, — видел на нашей же странице
 * «ожидает подтверждения». То есть самое сильное обещание продукта,
 * «доказательство, которое переживёт AEVION», выполнялось технически и НЕ
 * выполнялось на экране.
 *
 * ЧТО ЭТОТ МОДУЛЬ НЕ ДЕЛАЕТ. Он не пишет письма. Уведомление автора о том, что
 * его сертификат закреплён в блоке №N, — отдельное решение (кому, когда, с
 * каким текстом, и с оглядкой на суточный потолок почты). Здесь только то,
 * после чего письмо становится возможным: состояние в базе догоняет
 * действительность.
 */

const pool = getPool();

/**
 * Число из окружения, но БЕЗ NaN: `Number("zzz")` даёт NaN, а NaN проходит
 * сквозь сравнения молча и доезжает до SQL как `LIMIT NaN`. Мусор во входе — это
 * значение по умолчанию, а не поломка настройки.
 */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Как часто просыпаться. По умолчанию раз в полчаса. */
const TICK_MS = envInt("OTS_UPGRADE_TICK_MS", 30 * 60 * 1000, 60_000, 24 * 60 * 60 * 1000);

/** Сколько сертификатов трогать за один проход. */
const BATCH = envInt("OTS_UPGRADE_BATCH", 25, 1, 500);

/**
 * Насколько «остывшим» должен быть штамп, прежде чем спрашивать календарь.
 * Блок биткойна — около десяти минут, календари собирают пачками; спрашивать
 * через минуту после штампа значит гарантированно получить «ещё нет».
 *
 * Значение попадает в SQL ТЕКСТОМ (INTERVAL параметром не подставляется), и
 * поэтому проверяется строже, чем нужно нам: что угодно за пределами узкого
 * набора — это значение по умолчанию, а не попытка угадать намерение.
 */
const MIN_AGE = (() => {
  const raw = process.env.OTS_UPGRADE_MIN_AGE || "1 hour";
  return /^[0-9]{1,4} (minute|minutes|hour|hours|day|days)$/.test(raw) ? raw : "1 hour";
})();

export type SweepResult = {
  checked: number;
  upgraded: number;
  stillPending: number;
  failed: number;
};

/**
 * Один проход. Возвращает счётчики — именно возвращает, а не только пишет в
 * журнал: без этого проход нечем проверить тестом, и «работает» пришлось бы
 * принимать на слово.
 */
export async function sweepPendingAnchors(): Promise<SweepResult> {
  const out: SweepResult = { checked: 0, upgraded: 0, stillPending: 0, failed: 0 };

  let rows: Array<{ id: string; otsProof: Buffer | null }>;
  try {
    const q = await pool.query(
      `SELECT "id","otsProof"
         FROM "IPCertificate"
        WHERE "otsStatus" = 'pending'
          AND "otsProof" IS NOT NULL
          AND "otsStampedAt" < NOW() - INTERVAL '${MIN_AGE}'
        ORDER BY "otsStampedAt" ASC
        LIMIT $1`,
      [BATCH],
    );
    rows = q.rows as Array<{ id: string; otsProof: Buffer | null }>;
  } catch (err: unknown) {
    // Неудачное чтение — это НЕ «нечего дообновлять». Молчать здесь нельзя:
    // снаружи пустой проход неотличим от исправной работы.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[OT] upgrade sweep: не удалось прочитать очередь: ${msg}`);
    throw err;
  }

  for (const row of rows) {
    if (!row.otsProof) continue;
    out.checked++;
    try {
      const r = await upgradeProof(row.otsProof);
      if (r.upgraded && r.otsProof) {
        await pool.query(
          `UPDATE "IPCertificate"
              SET "otsProof" = $1,
                  "otsStatus" = $2,
                  "otsBitcoinBlockHeight" = $3,
                  "otsUpgradedAt" = NOW()
            WHERE "id" = $4`,
          [r.otsProof, r.status, r.bitcoinBlockHeight, row.id],
        );
        out.upgraded++;
        console.log(`[OT] cert=${row.id} upgraded height=${r.bitcoinBlockHeight} (фоновый проход)`);
      } else {
        out.stillPending++;
      }
    } catch (err: unknown) {
      // Один сертификат не должен ронять проход: календарь мог не ответить
      // именно про него. Но след обязателен — с ИМЕНЕМ, иначе он бесполезен.
      out.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[OT] cert=${row.id} дообновление не удалось: ${msg}`);
    }
  }

  if (out.checked > 0) {
    console.log(
      `[OT] upgrade sweep: проверено=${out.checked} закреплено=${out.upgraded} ` +
        `ещё ждёт=${out.stillPending} сбоев=${out.failed}`,
    );
  }
  return out;
}

let timer: NodeJS.Timeout | null = null;

/** Запуск. Идемпотентен: второй вызов ничего не делает. */
export function startOtsUpgradeWorker(): void {
  if (timer) return;
  if (String(process.env.OTS_UPGRADE_WORKER || "").toLowerCase() === "off") {
    console.log("[OT] фоновое дообновление якорей выключено (OTS_UPGRADE_WORKER=off)");
    return;
  }
  timer = setInterval(() => {
    void sweepPendingAnchors().catch(() => {
      /* причина уже в журнале, с именем сертификата или текстом ошибки базы */
    });
  }, TICK_MS);
  timer.unref?.();
  console.log(`[OT] фоновое дообновление якорей включено, раз в ${Math.round(TICK_MS / 60000)} мин`);
}

export function stopOtsUpgradeWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
