import type { NextRequest } from "next/server";
import { getOrigin, store, withCors } from "../../payments/v1/_lib";
import { sendReceiptEmail } from "../../payments/v1/_email";
import { formatPaymentAmount } from "@/lib/paymentAmount";

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
  const method = body?.method ?? "card";
  const last4 = body?.last4 && /^\d{4}$/.test(body.last4) ? body.last4 : undefined;
  const email = body?.payer_email?.trim();

  link.status = "paid";
  link.paid_at = Math.floor(Date.now() / 1000);
  link.paid_method = method;
  if (last4) link.paid_last4 = last4;
  store.links.set(id, link);

  let emailQueued = false;
  if (email) {
    // 31.08.2026. Здесь стояла ТРЕТЬЯ копия форматирования суммы, и она
    // повторяла тот же дефект, что и страница оплаты: сумма приходит в
    // МИНОРНЫХ единицах, а печаталась как есть. Покупатель, заплативший
    // $99.00, получал чек на $9900.00 — цену в сто раз больше. Копий было
    // три, поэтому они и разошлись; теперь показатель валюты один на всех.
    const amountLabel = formatPaymentAmount(link.amount, link.currency);
    // ⚠️ 29.08.2026: было `void sendReceiptEmail(...)` и следом БЕЗУСЛОВНОЕ
    // emailQueued = true. То есть результат отправки выбрасывался, а клиенту
    // в ответе уходило `email_queued: true` даже когда письмо не отправлялось
    // вовсе: при незаданном RESEND_API_KEY функция честно возвращает
    // { ok: false, skipped: true }, и этот ответ никто не читал.
    //
    // Отказ выглядел успехом ровно там, где человек только что заплатил.
    //
    // Ждать здесь безопасно: платёж уже записан выше, и неудача с письмом его
    // не отменяет — меняется только честность поля и появляется след в журнале.
    // Адрес в журнал не пишем, достаточно ссылки: журналы читают не только мы.
    const чек = await sendReceiptEmail({
      to: email,
      origin: getOrigin(req),
      link_id: link.id,
      amount_label: amountLabel,
      title: link.title,
      method,
      last4: last4 ?? null,
    });
    emailQueued = чек.ok;
    if (!чек.ok) {
      console.warn(
        `[pay/${link.id}] чек не отправлен: ` +
          (чек.skipped ? "не задан RESEND_API_KEY" : чек.error ?? "причина не названа"),
      );
    }
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
