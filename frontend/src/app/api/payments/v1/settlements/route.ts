import type { NextRequest } from "next/server";
import {
  readLimit, attachRateHeaders, gateRequest, store, withCors } from "../_lib";

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const currency = searchParams.get("currency");
  const limit = readLimit(searchParams.get("limit"), { поумолчанию: 25, максимум: 100 });

  let data = Array.from(store.settlements.values()).sort(
    (a, b) => b.scheduled_for - a.scheduled_for
  );
  if (status) data = data.filter((s) => s.status === status);
  if (currency) data = data.filter((s) => s.currency === currency);
  return attachRateHeaders(
    withCors(
      Response.json({ data: data.slice(0, limit), has_more: data.length > limit })
    ),
    gate.rateHeaders
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
