import type { NextRequest } from "next/server";
import { attachRateHeaders, gateRequest, store, withCors } from "../../_lib";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const link = store.links.get(id);
  if (!link) {
    return attachRateHeaders(
      withCors(
        Response.json(
          { error: { type: "not_found", message: `No link with id ${id}.` } },
          { status: 404 }
        )
      ),
      gate.rateHeaders
    );
  }
  return attachRateHeaders(withCors(Response.json(link)), gate.rateHeaders);
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
