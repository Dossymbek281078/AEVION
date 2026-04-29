import type { NextRequest } from "next/server";
import { store, withCors } from "../../payments/v1/_lib";

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
  } | null;
  const method = body?.method ?? "card";
  const last4 = body?.last4 && /^\d{4}$/.test(body.last4) ? body.last4 : undefined;

  link.status = "paid";
  link.paid_at = Math.floor(Date.now() / 1000);
  link.paid_method = method;
  if (last4) link.paid_last4 = last4;
  store.links.set(id, link);

  return withCors(
    Response.json({
      id: link.id,
      status: "paid",
      method,
      last4: last4 ?? null,
      paid_at: link.paid_at,
    })
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
