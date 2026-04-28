import type { NextRequest } from "next/server";
import { authError, store, withCors } from "../_lib";

export async function GET(req: NextRequest) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const currency = searchParams.get("currency");
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 25));

  let data = Array.from(store.settlements.values()).sort(
    (a, b) => b.scheduled_for - a.scheduled_for
  );
  if (status) data = data.filter((s) => s.status === status);
  if (currency) data = data.filter((s) => s.currency === currency);
  return withCors(Response.json({ data: data.slice(0, limit), has_more: data.length > limit }));
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
