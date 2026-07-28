import type { NextRequest } from "next/server";
import { getOrigin, store, withCors } from "../../payments/v1/_lib";
import { sendReceiptEmail } from "../../payments/v1/_email";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const link = store.links.get(id);
  if (!link) {
    return withCors(
      Response.json(
        { error: { type: "not_found", message: `No link with id ${id}.` } },
        { status: 404 }
      )
    );
  }
  return withCors(
    Response.json({
      id: link.id,
      amount: link.amount,
      currency: link.currency,
      title: link.title,
      description: link.description,
      settlement: link.settlement,
      status: link.status,
      paid_at: link.paid_at,
      paid_method: link.paid_method ?? null,
      paid_last4: link.paid_last4 ?? null,
    })
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const link = store.links.get(id);
  if (!link) {
    return withCors(
      Response.json(
        { error: { type: "not_found", message: `No link with id ${id}.` } },
        { status: 404 }
      )
    );
  }
  if (link.status !== "active") {
    return withCors(
      Response.json(
        {
          error: {
            type: "invalid_request_error",
            message: `Link is ${link.status}; cannot capture.`,
          },
        },
        { status: 409 }
      )
    );
  }

  const body = (await req.json().catch(() => null)) as {
    method?: string;
    last4?: string;
    payer_email?: string;
  } | null;
  // `method` попадает и в ответ, и в ТЕЛО ПИСЬМА, поэтому не произвольная строка:
  // берём известный способ оплаты, иначе короткое безопасное значение.
  const ALLOWED_METHODS = ["card", "apple-pay", "google-pay", "aec-credit", "bank-transfer"];
  const rawMethod = typeof body?.method === "string" ? body.method.trim().toLowerCase() : "";
  const method = ALLOWED_METHODS.includes(rawMethod) ? rawMethod : "card";

  const last4 = body?.last4 && /^\d{4}$/.test(body.last4) ? body.last4 : undefined;

  // Адрес получателя чека приходит извне, а письмо уходит через реальный Resend
  // от `receipts@aevion.app`. Раньше сюда годилась любая строка — то есть ручка
  // без ключа рассылала письма куда угодно. Теперь только правдоподобный адрес
  // разумной длины; всё остальное — 400, а не тихий пропуск.
  const rawEmail = typeof body?.payer_email === "string" ? body.payer_email.trim() : "";
  if (rawEmail && (rawEmail.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(rawEmail))) {
    return withCors(
      Response.json(
        {
          error: {
            type: "invalid_request_error",
            message: "payer_email must be a valid email address.",
          },
        },
        { status: 400 }
      )
    );
  }
  const email = rawEmail || undefined;

  link.status = "paid";
  link.paid_at = Math.floor(Date.now() / 1000);
  link.paid_method = method;
  if (last4) link.paid_last4 = last4;
  store.links.set(id, link);

  let emailQueued = false;
  if (email) {
    const amountLabel =
      link.currency === "AEC"
        ? `${link.amount.toLocaleString()} AEC`
        : link.currency === "KZT"
          ? `${link.amount.toLocaleString("ru-RU")} ₸`
          : link.currency === "EUR"
            ? `€${link.amount.toFixed(2)}`
            : `$${link.amount.toFixed(2)}`;
    void sendReceiptEmail({
      to: email,
      origin: getOrigin(req),
      link_id: link.id,
      amount_label: amountLabel,
      title: link.title,
      method,
      last4: last4 ?? null,
    });
    emailQueued = true;
  }

  return withCors(
    Response.json({
      id: link.id,
      status: "paid",
      method,
      last4: last4 ?? null,
      paid_at: link.paid_at,
      email_queued: emailQueued,
    })
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
