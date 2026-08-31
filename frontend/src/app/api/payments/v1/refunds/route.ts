import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  apiError,
  checkIdempotency,
  gateRequest,
  genId,
  getOrigin,
  signHmac,
  store,
  withCors,
  type ApiLink,
} from "../_lib";
import { kvListChecked, kvPush } from "../_persist";
import { logAudit } from "../_audit";
import { enqueueAttempt } from "../_webhook_queue";

const REFUNDS_KEY = "refunds.v1";
const REFUND_LIST_CAP = 500;

type ApiRefund = {
  id: string;
  link_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: "succeeded";
  created: number;
};

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const linkId = url.searchParams.get("link_id");

  // Отказ хранилища — это 503, а не пустой список. Довод тот же, что записан
  // у споров: продавец, увидев «возвратов нет», оформит возврат ВТОРОЙ РАЗ.
  // Пустая выдача при отказе неотличима от «их действительно нет».
  const read = await kvListChecked<ApiRefund>(REFUNDS_KEY);
  if (!read.ok) {
    return attachRateHeaders(
      withCors(
        apiError(
          "Refund storage is temporarily unreachable. Please retry.",
          503
        )
      ),
      gate.rateHeaders
    );
  }
  const items = read.value;
  const filtered = linkId ? items.filter((r) => r.link_id === linkId) : items;

  return attachRateHeaders(
    withCors(
      Response.json({
        object: "list",
        count: filtered.length,
        data: filtered.slice(0, 100),
      })
    ),
    gate.rateHeaders
  );
}

export async function POST(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const raw = await req.text();
  const idem = checkIdempotency(req, raw);
  if (idem.hit) {
    return attachRateHeaders(
      withCors(
        new Response(idem.cachedBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      ),
      gate.rateHeaders
    );
  }

  let body: { link_id?: string; amount?: number; reason?: string } | null = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return withCors(badRequest("Invalid JSON body."));
  }
  if (!body?.link_id) {
    return attachRateHeaders(
      withCors(badRequest("link_id is required.")),
      gate.rateHeaders
    );
  }

  const link: ApiLink | undefined = store.links.get(body.link_id);
  if (!link) {
    return attachRateHeaders(
      withCors(badRequest(`No payment link found for id ${body.link_id}.`, 404)),
      gate.rateHeaders
    );
  }
  if (link.status !== "paid") {
    return attachRateHeaders(
      withCors(badRequest(`Cannot refund a link with status "${link.status}".`, 409)),
      gate.rateHeaders
    );
  }

  // ⚠️ 29.08.2026: здесь стояло обычное kvList, и это был путь к ДВОЙНОМУ
  // возврату.
  //
  // Ниже из этого списка считается refundedSoFar, а из него remaining. Если
  // хранилище недоступно и чтение молча отдаёт пустой список, прошлых
  // возвратов «не существует»: refundedSoFar = 0, remaining = вся сумма, и
  // защита «уже возвращено полностью» не срабатывает. Деньги уходят второй
  // раз, а ответ выглядит обычным.
  //
  // Направление отказа выбираем по цене: отказ в возврате восстановим —
  // продавец повторит через минуту; двойной возврат не восстановим.
  // Поэтому НЕ ЗНАЕМ значит НЕ ДЕЛАЕМ.
  const priorRead = await kvListChecked<ApiRefund>(REFUNDS_KEY);
  if (!priorRead.ok) {
    return attachRateHeaders(
      withCors(
        apiError(
          "Cannot read prior refunds right now; refund not issued. Please retry.",
          503
        )
      ),
      gate.rateHeaders
    );
  }
  const prior = priorRead.value;

  // 31.08.2026. Журнал возвратов ОДИН на все ссылки ("refunds.v1") и kvPush
  // обрезает его до REFUND_LIST_CAP, выбрасывая САМЫЕ СТАРЫЕ записи. Значит у
  // ссылки, которая старше самой старой уцелевшей записи, её возврат мог быть
  // вытеснен — тогда refundedSoFar ниже считается нулём, remaining возвращается
  // к полной сумме, и полностью возвращённая ссылка возвращается ВТОРОЙ РАЗ.
  // Ответ при этом выглядит обычным: пропажа записи неотличима от «возвратов
  // не было». Воспроизведено тестом refundCapCannotHidePriorRefunds.
  //
  // Тот же класс, что и недоступное хранилище строкой выше: чтение, результат
  // которого идёт в вычисление ПРЕДЕЛА, а потеря данных делает предел БОЛЬШЕ.
  // Направление отказа то же и по той же цене: отказ обратим (продавец придёт
  // в поддержку), вторая выдача денег — нет.
  //
  // Проверка узкая намеренно. Возврат ссылки не может быть старше самой ссылки,
  // поэтому у ссылки НЕ старше окна все её возвраты заведомо целы — такие
  // проходят как раньше. Отказ включается только когда журнал полон И ссылка
  // старше окна, то есть ровно тогда, когда ответа у нас действительно нет.
  // Настоящее лечение — учёт по ссылке, который не обрезается; это меняет
  // хранилище и сделано отдельно.
  if (prior.length >= REFUND_LIST_CAP) {
    const oldestRetained = prior.reduce(
      (m, r) => (r.created < m ? r.created : m),
      Number.POSITIVE_INFINITY
    );
    if (link.created < oldestRetained) {
      return attachRateHeaders(
        withCors(
          apiError(
            "Refund history for this link may have been truncated; refund not issued. Please contact support.",
            409
          )
        ),
        gate.rateHeaders
      );
    }
  }
  const refundedSoFar = prior
    .filter((r) => r.link_id === link.id)
    .reduce((acc, r) => acc + r.amount, 0);
  const remaining = link.amount - refundedSoFar;
  if (remaining <= 0) {
    return attachRateHeaders(
      withCors(badRequest("Link has already been fully refunded.", 409)),
      gate.rateHeaders
    );
  }

  const requested = body.amount && body.amount > 0 ? body.amount : remaining;
  if (requested > remaining + 1e-9) {
    return attachRateHeaders(
      withCors(
        badRequest(
          `Requested amount ${requested} exceeds remaining refundable ${remaining}.`,
          409
        )
      ),
      gate.rateHeaders
    );
  }

  const refund: ApiRefund = {
    id: genId("rfd"),
    link_id: link.id,
    amount: requested,
    currency: link.currency,
    reason: (body.reason || "requested_by_customer").slice(0, 120),
    status: "succeeded",
    created: Date.now(),
  };

  await kvPush(REFUNDS_KEY, refund, REFUND_LIST_CAP);

  void logAudit(req, "refund.issued", refund.id, {
    link_id: refund.link_id,
    amount: refund.amount,
    currency: refund.currency,
    reason: refund.reason,
  });

  // fire & forget webhooks
  void fanoutRefundWebhook(refund, getOrigin(req));

  const responseBody = JSON.stringify(refund);
  idem.cleanup?.();
  return attachRateHeaders(
    withCors(
      new Response(responseBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ),
    gate.rateHeaders
  );
}

async function fanoutRefundWebhook(refund: ApiRefund, origin: string) {
  const enabled = Array.from(store.webhooks.values()).filter(
    (w) => w.enabled && w.events.includes("payment.refunded")
  );
  if (enabled.length === 0) return;

  const payload = {
    id: genId("evt"),
    type: "payment.refunded",
    created: Math.floor(Date.now() / 1000),
    data: {
      refund_id: refund.id,
      link_id: refund.link_id,
      amount: refund.amount,
      currency: refund.currency,
      reason: refund.reason,
    },
  };
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);

  await Promise.allSettled(
    enabled.map(async (w) => {
      const sig = signHmac(w.secret, `${ts}.${body}`);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      let delivered = false;
      try {
        const r = await fetch(w.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-aevion-signature": sig,
            "x-aevion-timestamp": String(ts),
            "x-aevion-event": "payment.refunded",
            "x-aevion-webhook": w.id,
            "user-agent": `AEVION-Payments/1.4 (+${origin})`,
          },
          body,
          signal: ctrl.signal,
        });
        delivered = r.status >= 200 && r.status < 300;
      } catch {
        delivered = false;
      } finally {
        clearTimeout(timer);
      }
      if (!delivered) {
        try {
          await enqueueAttempt({
            webhook_id: w.id,
            webhook_url: w.url,
            webhook_secret: w.secret,
            event: "payment.refunded",
            payload: body,
            immediate: false,
          });
        } catch {
          // queue write failed — give up silently
        }
      }
    })
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
