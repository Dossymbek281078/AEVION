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
  } | null;
  const method = body?.method ?? "card";

  link.status = "paid";
  link.paid_at = Math.floor(Date.now() / 1000);
  store.links.set(id, link);

  return withCors(
    Response.json({
      id: link.id,
      status: "paid",
      method,
      paid_at: link.paid_at,
    })
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
