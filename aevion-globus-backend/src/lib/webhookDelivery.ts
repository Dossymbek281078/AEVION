import { checkPublicUrl } from "./publicUrlOnly";
import { isInternalHost } from "./internalHost";
import crypto from "crypto";
import pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

// Shared HMAC-SHA256 webhook delivery primitive used by every AEVION module
// that pushes events to third-party endpoints (QRight, Planet, future: Awards,
// Bureau). The original per-module copies were 99% identical — extracting them
// here keeps the wire contract uniform: same header (X-AEVION-Signature),
// same algorithm (HMAC-SHA256 hex over the raw request body), same 5-second
// timeout, same fire-and-forget logging.
//
// Receivers verify by recomputing HMAC-SHA256(secret, requestBody) and
// comparing against the X-AEVION-Signature header (`sha256=<hex>`).

export type WebhookDeliveryConfig = {
  // Per-module table names (e.g. QRightWebhook + QRightWebhookDelivery).
  webhookTable: string;
  deliveryTable: string;
  // Column on the delivery table that stores the entity FK (e.g. objectId on
  // QRight, certificateId on Planet). Pass null to omit.
  entityColumn: string | null;
  // User-Agent string the receiver sees. Lets ops trace by module.
  userAgent: string;
};

export type DeliveryAttempt = {
  webhookId: string;
  url: string;
  secret: string;
  body: string;          // raw JSON; HMAC is computed over this exact byte stream
  eventType: string;
  entityId: string | null;
  isRetry: boolean;
};

export type DeliveryResult = {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
};

// Best-effort. NEVER throws — even an outright DB failure while writing the
// delivery log is swallowed (warn-logged). The caller's primary flow (revoke,
// finalize, etc.) must not be blocked by a slow or 5xx receiver.
export async function deliverWebhook(
  pool: PgPoolInstance,
  cfg: WebhookDeliveryConfig,
  opts: DeliveryAttempt
): Promise<DeliveryResult> {
  const sig = crypto.createHmac("sha256", opts.secret).update(opts.body).digest("hex");
  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;

  // 28.08.2026: адрес вебхука приходит от пользователя (QRight, Planet и
  // другие зовут эту функцию с `opts.url` из тела запроса), а внутренние
  // адреса при регистрации не блокировались: у QRight проверялся только
  // протокол, у Planet — только длина. Проверка стоит ЗДЕСЬ намеренно: это
  // единственное место, где происходит само обращение, и оно общее для всех
  // вызывающих. Гейт на входе не защищает то, что уже сохранено.
  //
  // Отдушина как у остальных вебхуков: в тестах и локальной разработке адрес
  // петли законен — тест поднимает свой сервер и слушает доставку.
  const allowInternal =
    process.env.ALLOW_INTERNAL_WEBHOOKS === "1" || process.env.NODE_ENV === "test";
  if (!allowInternal) {
    // ДВА слоя, и второй сильнее первого.
    //
    // Первый — быстрый и без сети: адрес, записанный внутренним ЯВНО
    // (127.0.0.1, 10.x, 169.254.169.254). Он отсекает очевидное мгновенно.
    //
    // Второй — checkPublicUrl: разрешает имя и смотрит АДРЕСА, в которые оно
    // ведёт. Без него `evil.example.com`, указывающий на 127.0.0.1, проходил
    // бы насквозь: проверка по строке имени этого не видит. Слабость моей
    // первой версии нашла соседняя вкладка на своей ручке, здесь тот же изъян
    // был ровно такой же.
    let internalByName = true;
    try {
      internalByName = isInternalHost(new URL(opts.url).hostname);
    } catch {
      internalByName = true; // адрес не разбирается — не идём
    }
    if (internalByName) {
      return { ok: false, statusCode: null, error: "target_not_allowed" };
    }
    const verdict = await checkPublicUrl(opts.url);
    if (!verdict.ok) {
      return { ok: false, statusCode: null, error: "target_not_allowed" };
    }
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": cfg.userAgent,
        "X-AEVION-Event": opts.eventType,
        "X-AEVION-Signature": `sha256=${sig}`,
      },
      body: opts.body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    statusCode = r.status;
    ok = r.ok;
    if (!r.ok) error = `HTTP ${r.status}`;
  } catch (err) {
    error = (err as Error).message.slice(0, 500);
  }

  // Persist delivery log. If entityColumn is set we include the FK; otherwise
  // we drop the column from the INSERT entirely.
  const entityFragment = cfg.entityColumn ? `, "${cfg.entityColumn}"` : "";
  const entityValue = cfg.entityColumn ? `, $9` : "";
  const params: unknown[] = [
    crypto.randomUUID(),
    opts.webhookId,
    opts.eventType,
    opts.body,
    statusCode,
    ok,
    error,
    opts.isRetry,
  ];
  if (cfg.entityColumn) params.push(opts.entityId);

  pool
    .query(
      `INSERT INTO "${cfg.deliveryTable}"
         ("id", "webhookId", "eventType", "requestBody", "statusCode", "ok", "error", "isRetry"${entityFragment})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8${entityValue})`,
      params
    )
    .catch((e: Error) => {
      console.warn(`[webhook] ${cfg.deliveryTable} insert failed:`, e.message);
    });

  if (ok) {
    pool
      .query(
        `UPDATE "${cfg.webhookTable}" SET "lastDeliveredAt" = NOW(), "lastError" = NULL WHERE "id" = $1`,
        [opts.webhookId]
      )
      .catch((e: Error) => {
        // Раньше здесь было `.catch(() => {})`. Отметка о доставке —
        // единственное, по чему потом судят, дошёл ли вебхук; если запись
        // не прошла, таблица показывает ПРОШЛОЕ состояние как настоящее.
        // Соседняя запись в этой же функции уже пишет в журнал при отказе —
        // непоследовательность внутри одного места и выдала дефект.
        console.warn(`[webhook] отметка «успех» не записана для ${opts.webhookId}:`, e.message);
      });
  } else {
    pool
      .query(
        `UPDATE "${cfg.webhookTable}" SET "lastFailedAt" = NOW(), "lastError" = $2 WHERE "id" = $1`,
        [opts.webhookId, error || "delivery failed"]
      )
      .catch((e: Error) => {
        // Раньше здесь было `.catch(() => {})`. Отметка о доставке —
        // единственное, по чему потом судят, дошёл ли вебхук; если запись
        // не прошла, таблица показывает ПРОШЛОЕ состояние как настоящее.
        // Соседняя запись в этой же функции уже пишет в журнал при отказе —
        // непоследовательность внутри одного места и выдала дефект.
        console.warn(`[webhook] отметка «доставлено» не записана для ${opts.webhookId}:`, e.message);
      });
  }
  return { ok, statusCode, error };
}
